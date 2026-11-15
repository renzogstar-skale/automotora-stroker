import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { signed } from "./categories";

/**
 * Definición única de la economía de una venta (Ventas, Libro, Comisiones, Finanzas y dashboards la usan):
 *  margen bruto (antes de gastos directos) = precio final − costo base + ingresos adicionales
 *    · propio: costo base = costo de adquisición
 *    · consignado: costo base = monto a liquidar al propietario
 *  gastos directos = preparación del vehículo + gastos directos imputados a la venta (neto de reversos)
 *  comisiones = vendedor + captador · reparto = gerencia + socios (ambos según reglas congeladas al cierre)
 *  utilidad final  = margen bruto − gastos directos − comisiones − reparto
 *  ingreso reconocido = propio: precio final + adicionales · consignado: precio − liquidación + adicionales
 */
export const saleInclude = {
  vehicle: { include: { photos: { where: { isCover: true }, take: 1 }, movements: { include: { category: true } } } },
  contact: true, seller: true, branch: true, commissions: { orderBy: { order: "asc" } },
  movements: { include: { category: true } }, payments: true, bookEntry: true,
} satisfies Prisma.SaleInclude;
export type SaleFull = Prisma.SaleGetPayload<{ include: typeof saleInclude }>;

export function econ(s: SaleFull) {
  const prep = -s.vehicle.movements.filter((m) => m.category.name === "Preparación de vehículo").reduce((a, m) => a + signed(m), 0) || 0;
  const directOnly = -s.movements.filter((m) => m.category.name === "Gasto directo de venta").reduce((a, m) => a + signed(m), 0) || 0;
  const margin = s.finalPrice - s.costBasis + s.extraIncome;
  const direct = prep + directOnly;
  const commissions = s.commissions.reduce((a, c) => a + c.amount, 0);
  const isSplit = (c: { rule: unknown }) => ["GERENCIA", "SOCIO"].includes((c.rule as { beneficiary?: string }).beneficiary ?? "");
  const split = s.commissions.filter(isSplit).reduce((a, c) => a + c.amount, 0);
  const paid = s.payments.filter((p) => p.status === "REGISTRADO").reduce((a, p) => a + p.amount, 0);
  const income = s.ownership === "PROPIO" ? s.finalPrice + s.extraIncome : s.finalPrice - s.costBasis + s.extraIncome;
  return { prep, directOnly, direct, margin, commissions, sellerComm: commissions - split, split, profit: margin - direct - commissions, paid, balance: s.finalPrice - paid, pendingFinance: Math.min(s.finalPrice - paid, s.financedAmount), income };
}
export type Econ = ReturnType<typeof econ>;

export async function salesWithEcon(where: Prisma.SaleWhereInput, take?: number) {
  const sales = await db.sale.findMany({ where, include: saleInclude, orderBy: { saleDate: "desc" }, take });
  return sales.map((s) => ({ ...s, econ: econ(s) }));
}

/** Proyección liviana (tipos simples) para rankings y agregados. */
export type SaleLite = { id: string; number: number; sellerId: string; branchId: string; saleDate: Date; finalPrice: number; payMethod: string; creditIncome: number; referredBy: string | null; stockSince: Date; margin: number; profit: number };
export async function salesLite(where: Prisma.SaleWhereInput): Promise<SaleLite[]> {
  const rows = await salesWithEcon(where);
  return rows.map((s) => ({ id: s.id, number: s.number, sellerId: s.sellerId, branchId: s.branchId, saleDate: s.saleDate, finalPrice: s.finalPrice, payMethod: s.payMethod, creditIncome: s.creditIncome, referredBy: s.referredBy, stockSince: s.vehicle.stockSince, margin: s.econ.margin, profit: s.econ.profit }));
}
