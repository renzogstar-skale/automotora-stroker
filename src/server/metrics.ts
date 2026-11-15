import type { Prisma, Stage } from "@prisma/client";
import { db } from "@/lib/db";
import { ACTIVE_STAGES } from "@/lib/labels";
import type { Period } from "@/lib/period";

/** Cobros realizados: pagos REGISTRADOS (no reversados) con dinero (excluye «Parte de pago»), por fecha de pago. */
export async function collections(p: { from: Date; to: Date }, branchIds: string[] | null) {
  const pays = await db.payment.findMany({
    where: {
      status: "REGISTRADO", method: { not: "Parte de pago" }, paidAt: { gte: p.from, lt: p.to },
      ...(branchIds ? { OR: [{ sale: { branchId: { in: branchIds } } }, { reservation: { vehicle: { branchId: { in: branchIds } } } }] } : {}),
    },
    select: { amount: true },
  });
  return { total: pays.reduce((a, x) => a + x.amount, 0), count: pays.length };
}

/**
 * Conversión por cohorte: leads de venta creados en el período (denominador) que llegaron a «Negocio concretado»
 * hasta la fecha de corte (numerador). La fecha de corte es hoy.
 */
export async function conversion(p: Period, scope: Prisma.OpportunityWhereInput) {
  const cohort: Prisma.OpportunityWhereInput = { ...scope, type: "VENTA", deletedAt: null, createdAt: { gte: p.from, lt: p.to } };
  const cutoff = new Date();
  const [den, numr] = await Promise.all([
    db.opportunity.count({ where: cohort }),
    db.opportunity.count({ where: { ...cohort, stage: "CONCRETADO", closedAt: { lte: cutoff } } }),
  ]);
  return { num: numr, den, cutoff };
}

/** Estado actual (no depende del período): inventario y pipeline. */
export async function currentState(branchIds: string[] | null, oppWhere: Prisma.OpportunityWhereInput) {
  const vb = branchIds ? { branchId: { in: branchIds } } : {};
  const [inv, pipeline, appts] = await Promise.all([
    db.vehicle.groupBy({ by: ["status", "ownership"], where: vb, _count: true, _sum: { cost: true } }),
    db.opportunity.groupBy({ by: ["stage"], where: { ...oppWhere, deletedAt: null, stage: { in: ACTIVE_STAGES as Stage[] } }, _count: true }),
    db.appointment.count({ where: { ...vb, status: { in: ["PROGRAMADA", "CONFIRMADA"] }, startAt: { gte: new Date() } } }),
  ]);
  const stock = inv.filter((r) => r.status === "DISPONIBLE" || r.status === "RESERVADO");
  return {
    stockTotal: stock.reduce((a, r) => a + r._count, 0),
    available: inv.filter((r) => r.status === "DISPONIBLE").reduce((a, r) => a + r._count, 0),
    reserved: inv.filter((r) => r.status === "RESERVADO").reduce((a, r) => a + r._count, 0),
    ownStock: stock.filter((r) => r.ownership === "PROPIO").reduce((a, r) => a + r._count, 0),
    consignedStock: stock.filter((r) => r.ownership === "CONSIGNADO").reduce((a, r) => a + r._count, 0),
    invested: stock.filter((r) => r.ownership === "PROPIO").reduce((a, r) => a + (r._sum.cost ?? 0), 0),
    pipeline: Object.fromEntries(pipeline.map((r) => [r.stage, r._count])) as Record<string, number>,
    activeLeads: pipeline.reduce((a, r) => a + r._count, 0),
    upcomingAppts: appts,
  };
}

/** Balance de caja del período: entradas − salidas realizadas de alcance EMPRESA (misma base que Seguimiento Financiero). */
export async function cashBalance(p: { from: Date; to: Date }, branchIds: string[] | null) {
  const rows = await db.movement.findMany({ where: { scope: "EMPRESA", isPending: false, date: { gte: p.from, lt: p.to }, ...(branchIds ? { OR: [{ branchId: { in: branchIds } }, { branchId: null }] } : {}) }, select: { type: true, amount: true } });
  const inflow = rows.filter((m) => m.type === "INGRESO").reduce((t, m) => t + m.amount, 0);
  const outflow = rows.filter((m) => m.type === "EGRESO").reduce((t, m) => t + m.amount, 0);
  return { in: inflow, out: outflow, balance: inflow - outflow };
}

/** Alcance de citas compartido por Citas y dashboards: sucursales visibles (o la elegida) y cartera propia del vendedor. */
export function apptScope(a: { role: string; sellerId: string | null }, branchIds: string[] | null): Prisma.AppointmentWhereInput {
  return { ...(branchIds ? { branchId: { in: branchIds } } : {}), ...(a.role === "VENDEDOR" ? { sellerId: a.sellerId ?? "-" } : {}) };
}

/** Citas pendientes (programadas o confirmadas): total, próximas y vencidas sin cerrar. */
export async function pendingAppts(scope: Prisma.AppointmentWhereInput) {
  const now = new Date();
  const [total, overdue] = await Promise.all([
    db.appointment.count({ where: { ...scope, status: { in: ["PROGRAMADA", "CONFIRMADA"] } } }),
    db.appointment.count({ where: { ...scope, status: { in: ["PROGRAMADA", "CONFIRMADA"] }, endAt: { lt: now } } }),
  ]);
  return { total, overdue, upcoming: total - overdue };
}

type SaleRow = { sellerId: string; finalPrice: number; margin: number; vehicle?: { brand: string; model: string } };
/** Agregados de ventas confirmadas: monto, unidades, ticket promedio y margen bruto (definición de server/economics). */
export function salesSummary(rows: { finalPrice: number; margin: number }[]) {
  const amount = rows.reduce((t, x) => t + x.finalPrice, 0), margin = rows.reduce((t, x) => t + x.margin, 0);
  return { units: rows.length, amount, margin, ticket: rows.length ? amount / rows.length : null, marginRate: amount ? margin / amount : null };
}
/** Ranking de vendedores por margen bruto (mismas ventas que Ranking de vendedores). */
export function marginRanking<S extends { id: string; name: string }>(rows: SaleRow[], sellers: S[]) {
  return sellers.map((s) => {
    const mine = rows.filter((r) => r.sellerId === s.id);
    return { seller: s, ...salesSummary(mine) };
  }).filter((r) => r.units > 0).sort((x, y) => y.margin - x.margin || y.amount - x.amount);
}
/** Modelos más vendidos (marca + modelo) por unidades y, en empate, monto. */
export function topModels(rows: Required<Pick<SaleRow, "vehicle" | "finalPrice">>[], take = 5) {
  const m = new Map<string, { name: string; units: number; amount: number }>();
  for (const r of rows) {
    const k = `${r.vehicle.brand} ${r.vehicle.model}`;
    const c = m.get(k) ?? { name: k, units: 0, amount: 0 };
    c.units++; c.amount += r.finalPrice; m.set(k, c);
  }
  return [...m.values()].sort((x, y) => y.units - x.units || y.amount - x.amount).slice(0, take);
}
