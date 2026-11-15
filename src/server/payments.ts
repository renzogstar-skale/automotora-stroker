import { Prisma } from "@prisma/client";
import { db, type Tx } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assert, type Actor } from "@/lib/rbac";
import { AppError, conflict, notFound } from "./errors";
import { catId } from "./categories";

export type PaymentInput = {
  saleId?: string; reservationId?: string; amount: number; method: string; paidAt: Date; idempotencyKey: string;
  /** Anticipo cobrado al confirmar la venta: lo registra quien confirma (permiso de ventas), como el abono de reserva. */
  downPayment?: boolean;
};

/**
 * Registra un cobro una sola vez:
 *  - la clave de idempotencia es única: un reintento devuelve el pago ya registrado;
 *  - el movimiento de caja lleva paymentId único por tipo, así no se duplica;
 *  - la fila de la venta se bloquea (FOR UPDATE) para que dos cobros simultáneos no sobrepasen el saldo.
 *  «Parte de pago» no genera caja: el vehículo recibido entra a inventario.
 */
export async function registerPayment(i: PaymentInput, actor: Actor | null) {
  if (actor) assert(actor, i.reservationId || i.downPayment ? "sales.edit" : "payments");
  if (!i.saleId === !i.reservationId) throw new AppError("El pago debe asociarse a una venta o a una reserva.");
  if (!Number.isInteger(i.amount) || i.amount <= 0) throw new AppError("El monto debe ser un entero positivo.");
  const prev = await db.payment.findUnique({ where: { idempotencyKey: i.idempotencyKey } });
  if (prev) return { payment: prev, duplicate: true };
  try {
    const payment = await db.$transaction(async (t) => {
      let branchId: string | null = null, label = "";
      if (i.saleId) {
        await t.$queryRaw`SELECT id FROM "Sale" WHERE id = ${i.saleId} FOR UPDATE`;
        const s = await t.sale.findUnique({ where: { id: i.saleId }, include: { payments: true, vehicle: true } });
        if (!s) throw notFound("Venta no encontrada.");
        if (s.status === "ANULADA") throw conflict("La venta está anulada.");
        const paid = s.payments.filter((p) => p.status === "REGISTRADO").reduce((a, p) => a + p.amount, 0);
        if (i.amount > s.finalPrice - paid) throw new AppError(`El monto supera el saldo pendiente (${s.finalPrice - paid}).`);
        branchId = s.branchId; label = `Venta #${s.number} · ${s.vehicle.plate}`;
      } else {
        const r = await t.reservation.findUnique({ where: { id: i.reservationId }, include: { vehicle: true } });
        if (!r) throw notFound("Reserva no encontrada.");
        branchId = r.vehicle.branchId; label = `Reserva ${r.vehicle.plate}`;
      }
      const p = await t.payment.create({
        data: { saleId: i.saleId ?? null, reservationId: i.reservationId ?? null, amount: i.amount, method: i.method, paidAt: i.paidAt, idempotencyKey: i.idempotencyKey },
      });
      if (i.method !== "Parte de pago") {
        await t.movement.create({
          data: {
            date: i.paidAt, type: "INGRESO", categoryId: await catId(i.saleId ? "Cobro de venta" : "Cobro de reserva", t), amount: i.amount,
            description: `Cobro ${label} (${i.method})`, tags: [], branchId, saleId: i.saleId ?? null, paymentId: p.id, createdById: actor?.id,
          },
        });
      }
      await audit(actor, "payment.register", "Payment", p.id, `Cobro ${label}: ${i.amount}`, { method: i.method }, t);
      return p;
    });
    return { payment, duplicate: false };
  } catch (e) {
    // Reintento simultáneo: el otro intento ya registró el pago (choque de clave, o tras esperar el bloqueo el saldo quedó en 0).
    if ((e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") || e instanceof AppError) {
      const p = await db.payment.findUnique({ where: { idempotencyKey: i.idempotencyKey } });
      if (p) return { payment: p, duplicate: true };
    }
    throw e;
  }
}

/** Reverso: conserva el pago original (REVERSADO) y crea un movimiento de devolución que lo netea. */
export async function reversePayment(id: string, reason: string, actor: Actor | null, refund = true, tx?: Tx) {
  if (actor) assert(actor, "payments");
  if (!reason.trim()) throw new AppError("Indica el motivo del reverso.");
  const inTx = <T>(fn: (t: Tx) => Promise<T>) => (tx ? fn(tx) : db.$transaction(fn));
  return inTx(async (t) => {
    const u = await t.payment.updateMany({ where: { id, status: "REGISTRADO" }, data: { status: "REVERSADO", reversedAt: new Date(), reverseReason: reason } });
    if (!u.count) return false;
    const orig = await t.movement.findFirst({ where: { paymentId: id, type: "INGRESO" } });
    if (orig) {
      await t.movement.create({
        data: {
          date: new Date(), type: "EGRESO", categoryId: await catId("Devolución a cliente", t), amount: orig.amount, refund,
          description: `Reverso: ${orig.description} · ${reason}`, tags: ["reverso"], branchId: orig.branchId, saleId: orig.saleId,
          paymentId: id, reversalOfId: orig.id, createdById: actor?.id,
        },
      });
    }
    await audit(actor, "payment.reverse", "Payment", id, `Reverso de pago: ${reason}`, undefined, t);
    return true;
  });
}
