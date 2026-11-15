import type { Tx } from "@/lib/db";
import { db } from "@/lib/db";

/** Categorías del sistema. pnl=false: solo caja (se reconocen en la utilidad a través de la venta o no son resultado). */
export const SYSTEM_CATEGORIES = [
  { name: "Cobro de venta", type: "INGRESO", pnl: false },
  { name: "Cobro de reserva", type: "INGRESO", pnl: false },
  { name: "Comisión de financiera", type: "INGRESO", pnl: false },
  { name: "Aporte de socio", type: "INGRESO", pnl: false },
  { name: "Otros ingresos", type: "INGRESO", pnl: true },
  { name: "Compra de vehículo", type: "EGRESO", pnl: false },
  { name: "Preparación de vehículo", type: "EGRESO", pnl: false },
  { name: "Gasto directo de venta", type: "EGRESO", pnl: false },
  { name: "Liquidación a propietario", type: "EGRESO", pnl: false },
  { name: "Comisiones pagadas", type: "EGRESO", pnl: false },
  { name: "Devolución a cliente", type: "EGRESO", pnl: false },
  { name: "Retiro de socio", type: "EGRESO", pnl: false },
  { name: "Fondo de ahorro (pozo)", type: "EGRESO", pnl: false },
  { name: "Arriendo", type: "EGRESO", pnl: true },
  { name: "Sueldos", type: "EGRESO", pnl: true },
  { name: "Publicidad", type: "EGRESO", pnl: true },
  { name: "Servicios básicos", type: "EGRESO", pnl: true },
  { name: "Gastos generales", type: "EGRESO", pnl: true },
] as const;
export type CategoryName = (typeof SYSTEM_CATEGORIES)[number]["name"];

// Sin caché en memoria: si las categorías se recrean (p. ej. recarga de la demo), un id guardado violaría la FK.
export async function catId(name: CategoryName, t: Tx | typeof db = db) {
  const c = await t.category.findUnique({ where: { name }, select: { id: true } });
  if (!c) throw new Error(`Categoría ${name} no existe: ejecuta el seed.`);
  return c.id;
}
/** Monto con signo: ingreso suma, egreso resta. Los reversos tienen tipo opuesto y se netean solos. */
export const signed = (m: { type: string; amount: number }) => (m.type === "INGRESO" ? m.amount : -m.amount);
