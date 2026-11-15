"use server";
import { revalidatePath } from "next/cache";
import { guard } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { run, str, opt, int, type ActionState } from "@/lib/action";
import { parseYmd } from "@/lib/format";
import { AppError, conflict } from "@/server/errors";

export async function movementAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("finance");
  return run(async () => {
    const cat = await db.category.findUniqueOrThrow({ where: { id: str(fd, "categoryId") } });
    const amount = int(fd, "amount");
    if (amount <= 0) throw new AppError("El monto debe ser positivo.");
    if (cat.name === "Gasto directo de venta" && !opt(fd, "saleId")) throw new AppError("Un gasto directo debe asociarse a una venta (número).");
    if (cat.name === "Preparación de vehículo") throw new AppError("Registra la preparación desde la ficha del vehículo.");
    let saleId: string | null = null;
    if (opt(fd, "saleId")) { const s = await db.sale.findUnique({ where: { number: int(fd, "saleId") } }); if (!s) throw new AppError("Venta no encontrada."); saleId = s.id; }
    const pending = fd.get("pending") === "on";
    const m = await db.movement.create({ data: {
      date: pending ? new Date() : parseYmd(str(fd, "date"), 12), type: cat.type, categoryId: cat.id, amount, description: str(fd, "description") || cat.name,
      tags: str(fd, "tags").split(",").map((t) => t.trim()).filter(Boolean), scope: str(fd, "scope") || "EMPRESA", partnerId: opt(fd, "partnerId"),
      branchId: opt(fd, "branchId"), saleId, isPending: pending, dueDate: pending && str(fd, "date") ? parseYmd(str(fd, "date"), 12) : null,
      pozo: cat.name === "Fondo de ahorro (pozo)", refund: fd.get("refund") === "on", createdById: a.id,
    } });
    await audit(a, "movement.create", "Movement", m.id, `${cat.type === "INGRESO" ? "Ingreso" : "Egreso"} ${cat.name} ${amount}${pending ? " (pendiente)" : ""}`);
    revalidatePath("/panel/finanzas/movimientos");
  }, "Movimiento registrado.");
}
/** Anular un movimiento crea su reverso (no se borra) para conservar el historial. */
export async function reverseMovementAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("finance");
  return run(async () => {
    const m = await db.movement.findUniqueOrThrow({ where: { id: str(fd, "id") }, include: { reversedBy: true } });
    if (m.reversedBy || m.reversalOfId) throw conflict("Este movimiento ya fue reversado o es un reverso.");
    if (m.paymentId || m.payoutId) throw new AppError("Los cobros y liquidaciones se reversan desde la venta o la consignación.");
    await db.movement.create({ data: { date: new Date(), type: m.type === "INGRESO" ? "EGRESO" : "INGRESO", categoryId: m.categoryId, amount: m.amount, description: `Reverso: ${m.description} · ${str(fd, "reason")}`, tags: ["reverso"], scope: m.scope, partnerId: m.partnerId, branchId: m.branchId, saleId: m.saleId, vehicleId: m.vehicleId, reversalOfId: m.id, createdById: a.id } });
    await audit(a, "movement.reverse", "Movement", m.id, `Reverso: ${str(fd, "reason")}`);
    revalidatePath("/panel/finanzas/movimientos");
  }, "Movimiento reversado.");
}
export async function settlePendingAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("finance");
  return run(async () => {
    const u = await db.movement.updateMany({ where: { id: str(fd, "id"), isPending: true }, data: { isPending: false, date: new Date() } });
    if (!u.count) throw conflict("Ya estaba realizado.");
    await audit(a, "movement.settle", "Movement", str(fd, "id"), "Pendiente marcado como realizado");
    revalidatePath("/panel/finanzas/movimientos");
  }, "Marcado como realizado.");
}
export async function ruleAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("commissions");
  return run(async () => {
    const data = { name: str(fd, "name"), beneficiary: str(fd, "beneficiary"), beneficiaryName: opt(fd, "beneficiaryName"), kind: str(fd, "kind"), value: Number(str(fd, "value").replace(",", ".")), base: str(fd, "base"), appliesTo: str(fd, "appliesTo"), order: int(fd, "order"), validFrom: parseYmd(str(fd, "validFrom")), validTo: str(fd, "validTo") ? parseYmd(str(fd, "validTo")) : null, active: fd.get("active") === "on" };
    if (!data.name || !(data.value > 0)) throw new AppError("Nombre y valor son obligatorios.");
    if (data.kind === "PORCENTAJE" && data.value > 100) throw new AppError("El porcentaje no puede superar 100.");
    const id = opt(fd, "id");
    const r = id ? await db.commissionRule.update({ where: { id }, data }) : await db.commissionRule.create({ data });
    await audit(a, id ? "commission.update" : "commission.create", "CommissionRule", r.id, `Regla ${r.name}`);
    revalidatePath("/panel/finanzas/comisiones");
  }, "Regla guardada. Aplica a ventas futuras; las cerradas conservan su snapshot.");
}
export async function payCommissionAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("commissions");
  return run(async () => {
    const c = await db.saleCommission.findUniqueOrThrow({ where: { id: str(fd, "id") }, include: { sale: true } });
    if (c.paidAt) throw conflict("Ya está pagada.");
    const cat = await db.category.findUniqueOrThrow({ where: { name: "Comisiones pagadas" } });
    await db.$transaction([
      db.saleCommission.update({ where: { id: c.id }, data: { paidAt: new Date() } }),
      db.movement.create({ data: { date: new Date(), type: "EGRESO", categoryId: cat.id, amount: c.amount, description: `Comisión ${c.beneficiary} venta #${c.sale.number}`, tags: ["comisiones"], branchId: c.sale.branchId, saleId: c.saleId, createdById: a.id } }),
    ]);
    await audit(a, "commission.pay", "SaleCommission", c.id, `Pago comisión ${c.amount}`);
    revalidatePath("/panel/finanzas/comisiones");
  }, "Comisión pagada.");
}
