import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { parseYmd } from "@/lib/format";
import { monthKey, monthName, type Period } from "@/lib/period";
import { signed } from "./categories";
import { salesWithEcon } from "./economics";
import { getSetting } from "./settings";

/**
 * Definiciones financieras únicas (Seguimiento Financiero, Dashboards, Informe CEO, Gestión de fondos):
 * - Monto vendido: suma de precios finales de ventas CONFIRMADAS con fecha de venta en el período (propias y consignadas).
 * - Cobros: dinero recibido (categorías «Cobro de venta/reserva»), neto de reversos, por fecha de pago.
 * - Ingresos del período: ingreso reconocido por venta (propia: precio + adicionales; consignada: precio − liquidación + adicionales)
 *   + «Otros ingresos». Aportes de socios, cobros y comisiones de financiera cobradas son caja, no ingreso nuevo.
 * - Gastos de empresa: gastos directos de venta + preparación de unidades vendidas + comisiones + gastos operativos (categorías de resultado).
 *   Compra de vehículos se reconoce como costo solo al vender (costo de unidades propias vendidas). Cada costo se usa una vez.
 * - Utilidad neta = ingresos − costo de unidades propias vendidas − gastos de empresa. Margen neto = utilidad / ingresos.
 * - Saldo de caja: suma con signo de todos los movimientos realizados de alcance EMPRESA. Movimientos de alcance SOCIO quedan fuera.
 */
export async function financeReport(p: Period, branchIds: string[] | null) {
  const bw = branchIds ? { branchId: { in: branchIds } } : {};
  const sales = await salesWithEcon({ status: "CONFIRMADA", saleDate: { gte: p.from, lt: p.to }, ...bw });
  const mWhere: Prisma.MovementWhereInput = { date: { gte: p.from, lt: p.to }, isPending: false, ...(branchIds ? { OR: [{ branchId: { in: branchIds } }, { branchId: null }] } : {}) };
  const moves = await db.movement.findMany({ where: mWhere, include: { category: true, partner: true }, orderBy: { date: "desc" } });
  const company = moves.filter((m) => m.scope === "EMPRESA");

  const ownSold = sales.filter((s) => s.ownership === "PROPIO");
  const sum = <T,>(a: T[], f: (x: T) => number) => a.reduce((s, x) => s + f(x), 0);
  const saleIncome = sum(sales, (s) => s.econ.income);
  const otherIncome = sum(company.filter((m) => m.category.pnl && m.category.type === "INGRESO"), signed);
  const opex = -sum(company.filter((m) => m.category.pnl && m.category.type === "EGRESO"), signed);
  const cogs = sum(ownSold, (s) => s.costBasis);
  const direct = sum(sales, (s) => s.econ.direct);
  const commissions = sum(sales, (s) => s.econ.commissions);
  const income = saleIncome + otherIncome;
  const expenses = direct + commissions + opex;
  const net = income - cogs - expenses;

  const bucket = (d: Date) => monthKey(d);
  const monthly = p.months.map((m) => {
    const k = monthKey(m);
    const ms = sales.filter((s) => bucket(s.saleDate) === k);
    const mm = company.filter((x) => bucket(x.date) === k);
    const inc = sum(ms, (s) => s.econ.income) + sum(mm.filter((x) => x.category.pnl && x.category.type === "INGRESO"), signed);
    const exp = sum(ms.filter((s) => s.ownership === "PROPIO"), (s) => s.costBasis) + sum(ms, (s) => s.econ.direct + s.econ.commissions) - sum(mm.filter((x) => x.category.pnl && x.category.type === "EGRESO"), signed);
    return {
      key: k, label: monthName(m), ingresos: inc, gastos: exp, utilidad: inc - exp,
      entradas: sum(mm.filter((x) => x.type === "INGRESO"), (x) => x.amount), salidas: sum(mm.filter((x) => x.type === "EGRESO"), (x) => x.amount),
      unidades: ms.length, vendido: sum(ms, (s) => s.finalPrice),
    };
  });

  // Saldo inicial disponible solo si su fecha es anterior o igual al inicio del período.
  const fin = await getSetting("finance");
  const initDate = parseYmd(fin.initialBalanceDate);
  let opening: number | null = null;
  if (initDate <= p.from) {
    const prior = await db.movement.findMany({ where: { scope: "EMPRESA", isPending: false, date: { gte: initDate, lt: p.from }, ...(branchIds ? { OR: [{ branchId: { in: branchIds } }, { branchId: null }] } : {}) }, select: { type: true, amount: true } });
    opening = fin.initialBalance + sum(prior, signed);
  }
  let acc = opening ?? 0;
  const cumulative = monthly.map((m) => ({ label: m.label, saldo: (acc += m.entradas - m.salidas) }));

  const byCat = new Map<string, { name: string; pnl: boolean; amount: number }>();
  for (const m of company.filter((x) => x.category.type === "EGRESO")) {
    const c = byCat.get(m.category.name) ?? { name: m.category.name, pnl: m.category.pnl, amount: 0 };
    c.amount -= signed(m); byCat.set(m.category.name, c);
  }
  const byPartner = new Map<string, { name: string; inside: number; outside: number }>();
  for (const m of moves.filter((x) => x.partner && x.type === "EGRESO")) {
    const c = byPartner.get(m.partner!.name) ?? { name: m.partner!.name, inside: 0, outside: 0 };
    if (m.scope === "EMPRESA") c.inside += m.amount; else c.outside += m.amount;
    byPartner.set(m.partner!.name, c);
  }
  return {
    sales, moves, kpi: { income, expenses, cogs, net, margin: income ? net / income : null, saleIncome, otherIncome, opex, direct, commissions },
    sold: { units: sales.length, amount: sum(sales, (s) => s.finalPrice), profit: sum(sales, (s) => s.econ.profit), own: ownSold.length, consigned: sales.length - ownSold.length },
    incomeBreakdown: [
      { name: "Ventas propias (precio + adicionales)", value: sum(ownSold, (s) => s.finalPrice + s.extraIncome) },
      { name: "Comisión de consignaciones", value: sum(sales.filter((s) => s.ownership === "CONSIGNADO"), (s) => s.finalPrice - s.costBasis + s.extraIncome) },
      { name: "Otros ingresos", value: otherIncome },
    ],
    monthly, opening, cumulative,
    cash: { in: sum(company.filter((x) => x.type === "INGRESO"), (x) => x.amount), out: sum(company.filter((x) => x.type === "EGRESO"), (x) => x.amount) },
    byCategory: [...byCat.values()].filter((c) => c.amount).sort((a, b) => b.amount - a.amount),
    byPartner: [...byPartner.values()],
    lastExpenses: moves.filter((m) => m.type === "EGRESO").slice(0, 8),
    lastIncomes: moves.filter((m) => m.type === "INGRESO").slice(0, 8),
  };
}

/** Cobros pendientes, vencidos, devoluciones por resolver y liquidaciones pendientes (estado actual). */
export async function pendingItems(branchIds: string[] | null) {
  const bw = branchIds ? { branchId: { in: branchIds } } : {};
  const open = (await salesWithEcon({ status: "CONFIRMADA", ...bw })).filter((s) => s.econ.balance > 0);
  const now = new Date();
  const expiredWithPay = await db.reservation.findMany({
    where: { status: { in: ["EXPIRADA", "ANULADA"] }, payments: { some: { status: "REGISTRADO" } }, ...(branchIds ? { vehicle: { branchId: { in: branchIds } } } : {}) },
    include: { contact: true, vehicle: true, payments: true },
  });
  const cons = await db.consignment.findMany({
    where: { status: "VENDIDA", ...(branchIds ? { vehicle: { branchId: { in: branchIds } } } : {}) },
    include: { owner: true, payouts: true, vehicle: { include: { sales: { where: { status: "CONFIRMADA" } } } } },
  });
  const payouts = cons.map((c) => ({ c, due: c.vehicle.sales[0]?.costBasis ?? 0, paid: c.payouts.reduce((a, p) => a + p.amount, 0) })).filter((x) => x.due > x.paid);
  const pendingMoves = await db.movement.findMany({ where: { isPending: true, ...(branchIds ? { OR: [{ branchId: { in: branchIds } }, { branchId: null }] } : {}) }, include: { category: true }, orderBy: { dueDate: "asc" } });
  return {
    receivables: open, overdue: open.filter((s) => s.balanceDueAt && s.balanceDueAt < now),
    refunds: expiredWithPay, payouts, pendingMoves,
  };
}
