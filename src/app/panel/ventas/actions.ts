"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { guard } from "@/lib/auth";
import { run, str, opt, int, type ActionState } from "@/lib/action";
import { normalizePlate, parseYmd } from "@/lib/format";
import { annulSale, confirmSale, setDelivery } from "@/server/sales";
import { registerPayment, reversePayment } from "@/server/payments";
import { AppError } from "@/server/errors";

export async function confirmSaleAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("sales.edit");
  let id = "";
  const r = await run(async () => {
    const tiValue = int(fd, "tiValue");
    let tradeIn = null;
    if (tiValue > 0) {
      const p = normalizePlate(str(fd, "tiPlate"));
      if (!p) throw new AppError("Patente del auto en parte de pago inválida.");
      tradeIn = { value: tiValue, plate: p.plate, brand: str(fd, "tiBrand"), model: str(fd, "tiModel"), year: int(fd, "tiYear"), km: int(fd, "tiKm"), appraisalId: opt(fd, "appraisalId") };
    }
    const s = await confirmSale({
      vehicleId: str(fd, "vehicleId"), opportunityId: opt(fd, "opportunityId"), sellerId: opt(fd, "sellerId"), discount: int(fd, "discount"),
      payMethod: str(fd, "payMethod") as "CONTADO", financedAmount: int(fd, "financed"), extraIncome: int(fd, "extraIncome") + int(fd, "creditIncome"), creditIncome: int(fd, "creditIncome"),
      balanceDueAt: str(fd, "balanceDueAt") ? parseYmd(str(fd, "balanceDueAt")) : null, referredBy: opt(fd, "referredBy"), tradeIn,
      idempotencyKey: opt(fd, "key") ?? undefined, downPayment: int(fd, "downPayment") > 0 ? { amount: int(fd, "downPayment"), method: str(fd, "downMethod") || "Transferencia" } : null,
    }, a);
    id = s.id;
  });
  if (r?.error) return r;
  redirect(`/panel/ventas/${id}`);
}
export async function paymentAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("payments");
  return run(async () => {
    const r = await registerPayment({ saleId: str(fd, "saleId"), amount: int(fd, "amount"), method: str(fd, "method"), paidAt: str(fd, "paidAt") ? parseYmd(str(fd, "paidAt"), 12) : new Date(), idempotencyKey: str(fd, "key") }, a);
    revalidatePath(`/panel/ventas/${str(fd, "saleId")}`);
    if (r.duplicate) throw new AppError("Este cobro ya estaba registrado (reintento ignorado).", 409);
  }, "Cobro registrado.");
}
export async function reversePaymentAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("payments");
  return run(async () => { if (!(await reversePayment(str(fd, "id"), str(fd, "reason"), a))) throw new AppError("El pago ya estaba reversado.", 409); revalidatePath("/panel/ventas", "layout"); }, "Pago reversado; se registró la devolución.");
}
export async function annulAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("payments");
  return run(async () => { await annulSale(str(fd, "id"), str(fd, "reason"), a); revalidatePath(`/panel/ventas/${str(fd, "id")}`); }, "Venta anulada.");
}
export async function deliveryAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("sales.edit");
  return run(async () => { await setDelivery(str(fd, "id"), str(fd, "status") as "ENTREGADA", a); revalidatePath(`/panel/ventas/${str(fd, "id")}`); }, "Entrega actualizada.");
}
