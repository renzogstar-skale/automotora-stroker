import type { Stage } from "@prisma/client";
import { db } from "@/lib/db";
import { ACTIVE_STAGES } from "@/lib/labels";
import { oppScope, branchScope, type Actor } from "@/lib/rbac";
import { getSetting } from "./settings";

export type Alert = { kind: string; reason: string; who: string; since: Date; href: string; tone: "red" | "amber" | "blue" };

/** Avisos del equipo: cada uno indica motivo, responsable y antigüedad, y abre el registro correspondiente. */
export async function getAlerts(actor: Actor, limit = 50): Promise<Alert[]> {
  const cfg = await getSetting("notices");
  const now = Date.now();
  const os = oppScope(actor);
  const b = branchScope(actor);
  const vb = b ? { branchId: { in: b } } : {};
  const out: Alert[] = [];
  const follow = await db.opportunity.findMany({
    where: { ...os, deletedAt: null, stage: { in: ACTIVE_STAGES as Stage[] }, nextFollowUpAt: { lt: new Date(now - cfg.followUpGraceHours * 3600e3) } },
    include: { contact: true, seller: true }, take: 40, orderBy: { nextFollowUpAt: "asc" },
  });
  for (const o of follow) out.push({ kind: "Seguimiento vencido", reason: `Seguimiento pendiente con ${o.contact.name}`, who: o.seller?.name ?? "Sin asignar", since: o.nextFollowUpAt!, href: `/panel/crm/${o.id}`, tone: "red" });
  const fresh = await db.opportunity.findMany({
    where: { ...os, deletedAt: null, stage: "NUEVO", createdAt: { lt: new Date(now - cfg.noContactHours * 3600e3) }, activities: { none: { type: { in: ["LLAMADA", "MENSAJE"] } } } },
    include: { contact: true, seller: true }, take: 20,
  });
  for (const o of fresh) out.push({ kind: "Sin contacto", reason: `Lead nuevo sin llamada ni mensaje: ${o.contact.name}`, who: o.seller?.name ?? "Sin asignar", since: o.createdAt, href: `/panel/crm/${o.id}`, tone: "amber" });
  const appts = await db.appointment.findMany({
    where: { ...(actor.role === "VENDEDOR" ? { sellerId: actor.sellerId ?? "-" } : {}), ...vb, status: { in: ["PROGRAMADA", "CONFIRMADA"] }, endAt: { lt: new Date(now) } },
    include: { contact: true, seller: true }, take: 20,
  });
  for (const a of appts) out.push({ kind: "Cita vencida", reason: `Cita sin cerrar con ${a.contact?.name ?? "cliente"}`, who: a.seller?.name ?? "Sin asignar", since: a.endAt, href: `/panel/citas?view=agenda&focus=${a.id}`, tone: "amber" });
  if (actor.role !== "FOTOGRAFO") {
    const res = await db.reservation.findMany({
      where: { status: "ACTIVA", expiresAt: { lt: new Date(now + cfg.reservationWarnHours * 3600e3) }, ...(b ? { vehicle: { branchId: { in: b } } } : {}) },
      include: { vehicle: true, seller: true },
    });
    for (const r of res) out.push({ kind: "Reserva por vencer", reason: `Reserva de ${r.vehicle.brand} ${r.vehicle.model} ${r.vehicle.plate}`, who: r.seller?.name ?? "—", since: r.createdAt, href: `/panel/inventario/${r.vehicleId}`, tone: "amber" });
  }
  const noPhotos = await db.vehicle.findMany({
    where: { ...vb, status: { in: ["DISPONIBLE", "RESERVADO"] }, photos: { none: {} }, stockSince: { lt: new Date(now - cfg.noPhotoDays * 864e5) } },
  });
  for (const v of noPhotos) out.push({ kind: "Faltan fotos", reason: `${v.brand} ${v.model} ${v.plate} sin fotografías`, who: "Fotografía", since: v.stockSince, href: `/panel/albumes/${v.id}`, tone: "blue" });
  if (actor.role === "ADMIN" || actor.role === "FINANZAS" || actor.role === "GERENCIA") {
    const sales = await db.sale.findMany({ where: { ...vb, status: "CONFIRMADA", balanceDueAt: { lt: new Date(now) } }, include: { payments: true, seller: true, contact: true } });
    for (const s of sales) {
      const paid = s.payments.filter((p) => p.status === "REGISTRADO").reduce((a, p) => a + p.amount, 0);
      if (paid < s.finalPrice) out.push({ kind: "Saldo vencido", reason: `Venta #${s.number} de ${s.contact.name} con saldo pendiente`, who: s.seller.name, since: s.balanceDueAt!, href: `/panel/ventas/${s.id}`, tone: "red" });
    }
    const cons = await db.consignment.findMany({ where: { status: "VIGENTE", endDate: { lt: new Date(now + 7 * 864e5) }, ...(b ? { vehicle: { branchId: { in: b } } } : {}) }, include: { vehicle: true, responsible: true } });
    for (const c of cons) out.push({ kind: "Consignación por vencer", reason: `${c.vehicle.brand} ${c.vehicle.model} ${c.vehicle.plate}`, who: c.responsible?.name ?? "—", since: c.startDate, href: `/panel/consignaciones/${c.id}`, tone: "amber" });
  }
  return out.sort((a, b) => a.since.getTime() - b.since.getTime()).slice(0, limit);
}
