import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db, type Tx } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assert, assertBranch, type Actor } from "@/lib/rbac";
import { AppError, conflict, notFound } from "./errors";
import { changeStage } from "./crm";
import { registerPayment } from "./payments";
import { STAGE_ORDER } from "@/lib/labels";

export const slugify = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export type VehicleInput = {
  branchId: string; brand: string; model: string; version: string; year: number; plate: string; vin?: string | null; km: number;
  transmission: string; fuel: string; bodyType: string; color: string; condition: "NUEVO" | "USADO"; ownership?: "PROPIO" | "CONSIGNADO";
  price: number; cost: number; description?: string | null; featured?: boolean;
};

export async function createVehicle(i: VehicleInput, actor: Actor | null, t: Tx | typeof db = db) {
  if (actor) { assert(actor, "inventory.edit"); assertBranch(actor, i.branchId); }
  if (i.price <= 0 || i.cost < 0) throw new AppError("Precio y costo deben ser positivos.");
  const exists = await t.vehicle.findUnique({ where: { plate: i.plate } });
  if (exists) throw conflict(`La patente ${i.plate} ya existe en inventario.`);
  const v = await t.vehicle.create({
    // El slug es público: no incluye la patente.
    data: { ...i, ownership: i.ownership ?? "PROPIO", slug: `${slugify(`${i.brand}-${i.model}-${i.year}`)}-${randomBytes(3).toString("hex")}` },
  });
  await audit(actor, "vehicle.create", "Vehicle", v.id, `Ingreso ${i.brand} ${i.model} ${i.plate}`, undefined, t);
  return v;
}

/** Publicar exige permiso, fotos con portada y unidad disponible o reservada. */
export async function setPublished(id: string, publish: boolean, actor: Actor) {
  assert(actor, "web.publish");
  const v = await db.vehicle.findUnique({ where: { id }, include: { photos: true } });
  if (!v) throw notFound();
  assertBranch(actor, v.branchId);
  if (publish) {
    if (!["DISPONIBLE", "RESERVADO"].includes(v.status)) throw new AppError("Solo se publican unidades disponibles o reservadas.");
    if (!v.photos.length) throw new AppError("Carga al menos una fotografía antes de publicar.");
    if (!v.photos.some((p) => p.isCover)) throw new AppError("Elige una foto de portada.");
  }
  await db.vehicle.update({ where: { id }, data: { published: publish, publishedAt: publish ? new Date() : v.publishedAt } });
  await audit(actor, publish ? "vehicle.publish" : "vehicle.unpublish", "Vehicle", id, `${publish ? "Publicado" : "Despublicado"} ${v.plate}`);
}

/** Libera reservas vencidas. Se ejecuta al consultar inventario y desde /api/cron/reservas. */
export async function expireReservations(vehicleId?: string) {
  const due = await db.reservation.findMany({ where: { status: "ACTIVA", expiresAt: { lt: new Date() }, ...(vehicleId ? { vehicleId } : {}) } });
  for (const r of due) {
    await db.$transaction(async (t) => {
      const u = await t.reservation.updateMany({ where: { id: r.id, status: "ACTIVA" }, data: { status: "EXPIRADA", endedAt: new Date(), endReason: "Plazo vencido" } });
      if (!u.count) return;
      await t.vehicle.updateMany({ where: { id: r.vehicleId, status: "RESERVADO" }, data: { status: "DISPONIBLE" } });
      await audit(null, "reservation.expire", "Reservation", r.id, "Reserva expirada automáticamente", undefined, t);
    });
  }
  return due.length;
}

export type ReserveInput = {
  vehicleId: string; contactId?: string | null; opportunityId?: string | null; amount: number; days: number;
  method?: string; idempotencyKey: string;
};

/**
 * Reserva atómica: el UPDATE condicional (status = DISPONIBLE) bloquea la fila; si dos solicitudes llegan a la vez,
 * la segunda reevalúa la condición tras el commit de la primera y no afecta filas, por lo que responde conflicto.
 * Respaldo: índice único parcial «una reserva ACTIVA por vehículo».
 */
export async function reserveVehicle(i: ReserveInput, actor: Actor) {
  assert(actor, "sales.edit");
  await expireReservations(i.vehicleId);
  const prior = await db.payment.findUnique({ where: { idempotencyKey: i.idempotencyKey }, include: { reservation: true } });
  if (prior?.reservation) return prior.reservation;
  if (i.days < 1 || i.days > 30) throw new AppError("La vigencia debe estar entre 1 y 30 días.");
  if (i.amount < 0) throw new AppError("Monto inválido.");
  const res = await db.$transaction(async (t) => {
    const v = await t.vehicle.findUnique({ where: { id: i.vehicleId } });
    if (!v) throw notFound("Vehículo no encontrado.");
    assertBranch(actor, v.branchId);
    let contactId = i.contactId ?? null, sellerId = actor.sellerId;
    if (i.opportunityId) {
      const o = await t.opportunity.findUnique({ where: { id: i.opportunityId } });
      if (!o) throw notFound("Oportunidad no encontrada.");
      contactId = o.contactId; sellerId = o.sellerId ?? sellerId;
    }
    if (!contactId) throw new AppError("Selecciona el cliente o la oportunidad.");
    const lock = await t.vehicle.updateMany({ where: { id: v.id, status: "DISPONIBLE" }, data: { status: "RESERVADO" } });
    if (!lock.count) throw conflict(v.status === "RESERVADO" ? "La unidad ya tiene una reserva activa." : "La unidad no está disponible para reservar.");
    const r = await t.reservation.create({
      data: { vehicleId: v.id, contactId, opportunityId: i.opportunityId || null, sellerId, amount: i.amount, expiresAt: new Date(Date.now() + i.days * 864e5) },
    }).catch((e) => { throw (e as { code?: string }).code === "P2002" ? conflict("La unidad ya tiene una reserva activa.") : e; });
    if (i.opportunityId) {
      const o = await t.opportunity.findUnique({ where: { id: i.opportunityId } });
      if (o && STAGE_ORDER[o.stage] < STAGE_ORDER.PARA_CIERRE) await changeStage(o.id, "PARA_CIERRE", actor, "Reserva registrada", t);
    }
    await audit(actor, "reservation.create", "Reservation", r.id, `Reserva ${v.plate} por ${i.amount}`, { vehicleId: v.id }, t);
    return r;
  });
  if (i.amount > 0)
    await registerPayment({ reservationId: res.id, amount: i.amount, method: i.method ?? "Transferencia", paidAt: new Date(), idempotencyKey: i.idempotencyKey }, actor);
  return res;
}

export async function cancelReservation(id: string, reason: string, actor: Actor) {
  assert(actor, "sales.edit");
  if (!reason.trim()) throw new AppError("Indica el motivo.");
  await db.$transaction(async (t) => {
    const r = await t.reservation.findUnique({ where: { id }, include: { vehicle: true } });
    if (!r) throw notFound();
    assertBranch(actor, r.vehicle.branchId);
    const u = await t.reservation.updateMany({ where: { id, status: "ACTIVA" }, data: { status: "ANULADA", endedAt: new Date(), endReason: reason } });
    if (!u.count) throw conflict("La reserva ya no está activa.");
    await t.vehicle.updateMany({ where: { id: r.vehicleId, status: "RESERVADO" }, data: { status: "DISPONIBLE" } });
    await audit(actor, "reservation.cancel", "Reservation", id, `Reserva anulada: ${reason}`, undefined, t);
  });
}

/** Retiro: despublica, anula la reserva activa y cierra la consignación como retirada. */
export async function retireVehicle(id: string, reason: string, actor: Actor) {
  assert(actor, "inventory.edit");
  await db.$transaction(async (t) => {
    const v = await t.vehicle.findUnique({ where: { id }, include: { consignment: true } });
    if (!v) throw notFound();
    assertBranch(actor, v.branchId);
    if (v.status === "VENDIDO") throw conflict("Un vehículo vendido no se puede retirar; anula la venta primero.");
    await t.vehicle.update({ where: { id }, data: { status: "RETIRADO", published: false } });
    await t.reservation.updateMany({ where: { vehicleId: id, status: "ACTIVA" }, data: { status: "ANULADA", endedAt: new Date(), endReason: "Vehículo retirado" } });
    if (v.consignment) await t.consignment.update({ where: { id: v.consignment.id }, data: { status: "RETIRADA", closedAt: new Date() } });
    await audit(actor, "vehicle.retire", "Vehicle", id, `Retirado ${v.plate}: ${reason}`, { wasPublished: v.published }, t);
  });
}

export function vehicleWhere(q: Record<string, string | undefined>): Prisma.VehicleWhereInput {
  const w: Prisma.VehicleWhereInput = {};
  if (q.q) w.OR = ["brand", "model", "version", "plate", "vin"].map((f) => ({ [f]: { contains: q.q, mode: "insensitive" } }));
  if (q.status) w.status = q.status as never;
  if (q.condition) w.condition = q.condition as never;
  if (q.ownership) w.ownership = q.ownership as never;
  if (q.branch) w.branchId = q.branch;
  if (q.brand) w.brand = q.brand;
  if (q.fuel) w.fuel = q.fuel;
  if (q.transmission) w.transmission = q.transmission;
  if (q.yearMin || q.yearMax) w.year = { gte: q.yearMin ? +q.yearMin : undefined, lte: q.yearMax ? +q.yearMax : undefined };
  if (q.priceMax) w.price = { lte: +q.priceMax };
  return w;
}
