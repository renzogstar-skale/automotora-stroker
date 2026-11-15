import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assert, assertBranch, type Actor } from "@/lib/rbac";
import { AppError, conflict, notFound } from "./errors";
import { upsertContact } from "./crm";
import { createVehicle, type VehicleInput } from "./inventory";
import { catId } from "./categories";

export type ConsignmentInput = {
  owner: { name: string; phone?: string; email?: string; rut?: string };
  vehicle: Omit<VehicleInput, "ownership" | "cost" | "condition">;
  modality: "FISICA" | "ONLINE"; agreedPrice: number; days: number; responsibleId?: string | null; appraisalId?: string | null;
  documents?: Record<string, boolean>;
};

export async function createConsignment(i: ConsignmentInput, actor: Actor) {
  assert(actor, "consignments");
  if (i.agreedPrice <= 0 || i.agreedPrice >= i.vehicle.price) throw new AppError("El monto acordado debe ser positivo y menor al precio publicado.");
  return db.$transaction(async (t) => {
    const owner = await upsertContact(t, i.owner);
    const v = await createVehicle({ ...i.vehicle, ownership: "CONSIGNADO", condition: "USADO", cost: i.agreedPrice }, actor, t);
    const c = await t.consignment.create({
      data: {
        ownerId: owner.id, vehicleId: v.id, modality: i.modality, agreedPrice: i.agreedPrice, commission: i.vehicle.price - i.agreedPrice,
        startDate: new Date(), endDate: new Date(Date.now() + i.days * 864e5), responsibleId: i.responsibleId ?? actor.sellerId,
        appraisalId: i.appraisalId || null, documents: i.documents ?? {},
      },
    });
    if (i.appraisalId) await t.appraisal.update({ where: { id: i.appraisalId }, data: { vehicleId: v.id } });
    await audit(actor, "consignment.create", "Consignment", c.id, `Consignación ${v.plate} (${i.modality.toLowerCase()})`, undefined, t);
    return c;
  });
}

/** Saldo por liquidar al propietario: monto acordado en la venta − liquidaciones pagadas. */
export async function settlement(consignmentId: string) {
  const c = await db.consignment.findUnique({ where: { id: consignmentId }, include: { payouts: true, vehicle: { include: { sales: { where: { status: "CONFIRMADA" } } } } } });
  if (!c) throw notFound();
  const sale = c.vehicle.sales[0];
  const due = sale ? sale.costBasis : 0;
  const paid = c.payouts.reduce((a, p) => a + p.amount, 0);
  return { consignment: c, sale, due, paid, pending: due - paid };
}

export async function payOwner(consignmentId: string, amount: number, idempotencyKey: string, actor: Actor) {
  assert(actor, "payments");
  const prev = await db.ownerPayout.findUnique({ where: { idempotencyKey } });
  if (prev) return prev;
  const s = await settlement(consignmentId);
  assertBranch(actor, s.consignment.vehicle.branchId);
  if (!s.sale) throw conflict("La consignación aún no tiene venta confirmada.");
  if (amount <= 0 || amount > s.pending) throw new AppError(`El monto debe estar entre 1 y ${s.pending}.`);
  return db.$transaction(async (t) => {
    // Bloquea la consignación y recalcula lo pagado: dos liquidaciones simultáneas no superan el monto acordado.
    await t.$queryRaw`SELECT id FROM "Consignment" WHERE id = ${consignmentId} FOR UPDATE`;
    const pending = s.due - ((await t.ownerPayout.aggregate({ where: { consignmentId }, _sum: { amount: true } }))._sum.amount ?? 0);
    if (amount > pending) throw new AppError(`El monto debe estar entre 1 y ${pending}.`);
    const p = await t.ownerPayout.create({ data: { consignmentId, amount, paidAt: new Date(), idempotencyKey } });
    await t.movement.create({
      data: {
        date: new Date(), type: "EGRESO", categoryId: await catId("Liquidación a propietario", t), amount, tags: ["consignación"],
        description: `Liquidación ${s.consignment.vehicle.plate} al propietario`, branchId: s.consignment.vehicle.branchId,
        vehicleId: s.consignment.vehicleId, saleId: s.sale!.id, payoutId: p.id, createdById: actor.id,
      },
    });
    if (amount === pending) await t.consignment.update({ where: { id: consignmentId }, data: { status: "CERRADA", closedAt: new Date() } });
    await audit(actor, "consignment.payout", "Consignment", consignmentId, `Liquidación al propietario: ${amount}`, undefined, t);
    return p;
  }).catch(async (e) => {
    // Reintento simultáneo con la misma clave (choque de clave, o tras el bloqueo ya no queda saldo): devuelve la liquidación ya registrada.
    if ((e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") || e instanceof AppError) {
      const p = await db.ownerPayout.findUnique({ where: { idempotencyKey } });
      if (p) return p;
    }
    throw e;
  });
}
