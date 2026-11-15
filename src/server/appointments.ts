import type { ApptType, Prisma } from "@prisma/client";
import { db, type Tx } from "@/lib/db";
import { audit } from "@/lib/audit";
import { APPT_TYPE, STAGE_ORDER } from "@/lib/labels";
import { dateTime } from "@/lib/format";
import { assertBranch, type Actor } from "@/lib/rbac";
import { AppError, conflict, notFound } from "./errors";
import { changeStage } from "./crm";
import { getSetting } from "./settings";

export type ApptInput = {
  type: ApptType; startAt: Date; durationMin?: number; branchId: string; sellerId?: string | null; vehicleId?: string | null;
  contactId?: string | null; opportunityId?: string | null; notes?: string | null; externalId?: string | null;
};

/** Valida cruces de horario del vendedor y del vehículo (citas no canceladas que se solapan). */
export async function checkConflicts(t: Tx | typeof db, i: { startAt: Date; endAt: Date; sellerId?: string | null; vehicleId?: string | null }, excludeId?: string) {
  const overlap: Prisma.AppointmentWhereInput = {
    status: { in: ["PROGRAMADA", "CONFIRMADA"] }, startAt: { lt: i.endAt }, endAt: { gt: i.startAt }, ...(excludeId ? { id: { not: excludeId } } : {}),
  };
  if (i.sellerId) {
    const c = await t.appointment.findFirst({ where: { ...overlap, sellerId: i.sellerId }, include: { seller: true } });
    if (c) throw conflict(`El vendedor ${c.seller?.name} ya tiene una cita a las ${dateTime(c.startAt)}.`);
  }
  if (i.vehicleId) {
    const c = await t.appointment.findFirst({ where: { ...overlap, vehicleId: i.vehicleId } });
    if (c) throw conflict(`El vehículo ya está agendado a las ${dateTime(c.startAt)}.`);
  }
}

export async function createAppointment(i: ApptInput, actor: Actor | null, tx?: Tx) {
  const run = async (t: Tx) => {
    if (actor) assertBranch(actor, i.branchId);
    if (!APPT_TYPE[i.type]) throw new AppError("Tipo de cita no válido.");
    if (isNaN(i.startAt.getTime())) throw new AppError("Fecha u hora inválida.");
    const endAt = new Date(i.startAt.getTime() + (i.durationMin ?? 60) * 60e3);
    let contactId = i.contactId ?? null;
    let sellerId = i.sellerId ?? (actor?.role === "VENDEDOR" ? actor.sellerId : null);
    if (i.opportunityId) {
      const o = await t.opportunity.findUnique({ where: { id: i.opportunityId } });
      if (!o) throw notFound("Oportunidad no encontrada.");
      if (o.branchId !== i.branchId) throw new AppError("La oportunidad pertenece a otra sucursal.", 403, "forbidden");
      contactId ??= o.contactId;
      sellerId ??= o.sellerId;
    }
    await checkConflicts(t, { startAt: i.startAt, endAt, sellerId, vehicleId: i.vehicleId });
    const a = await t.appointment.create({
      data: {
        type: i.type, startAt: i.startAt, endAt, branchId: i.branchId, sellerId, vehicleId: i.vehicleId || null, contactId,
        opportunityId: i.opportunityId || null, notes: i.notes || null, externalId: i.externalId || null,
      },
    });
    if (i.opportunityId) {
      await t.activity.create({ data: { type: "CITA", opportunityId: i.opportunityId, contactId, body: `${APPT_TYPE[i.type]} agendado para ${dateTime(i.startAt)}`, userId: actor?.id, userName: actor?.name ?? "Sistema" } });
      const o = await t.opportunity.findUnique({ where: { id: i.opportunityId } });
      if (o && STAGE_ORDER[o.stage] < STAGE_ORDER.AGENDADO) await changeStage(o.id, "AGENDADO", actor, null, t);
    }
    await audit(actor, "appointment.create", "Appointment", a.id, `${APPT_TYPE[i.type]} agendado para ${dateTime(i.startAt)}`, undefined, t);
    return a;
  };
  return tx ? run(tx) : db.$transaction(run);
}

/** Confirma, completa o cancela. Al completar una cita vinculada a un lead deja un seguimiento y una tarea al vendedor. */
export async function setAppointmentStatus(id: string, action: "confirm" | "complete" | "cancel", actor: Actor, reason?: string) {
  const a = await db.appointment.findUnique({ where: { id }, include: { seller: true } });
  if (!a) throw notFound();
  assertBranch(actor, a.branchId);
  if (actor.role === "VENDEDOR" && a.sellerId !== actor.sellerId) throw new AppError("Cita de otro vendedor.", 403, "forbidden");
  if (a.status === "COMPLETADA" || a.status === "CANCELADA") throw conflict("La cita ya está cerrada.");
  if (action === "confirm" && a.status !== "PROGRAMADA") throw conflict("La cita ya está confirmada.");
  if (action === "cancel" && !reason?.trim()) throw new AppError("Indica el motivo de cancelación.");
  const status = action === "confirm" ? "CONFIRMADA" : action === "complete" ? "COMPLETADA" : "CANCELADA";
  const { followUpAfterApptHours } = await getSetting("team");
  const followAt = new Date(Date.now() + followUpAfterApptHours * 3600e3);
  await db.$transaction(async (t) => {
    await t.appointment.update({ where: { id }, data: { status, cancelReason: action === "cancel" ? reason : null } });
    if (a.opportunityId) {
      await t.activity.create({ data: { type: "CITA", opportunityId: a.opportunityId, contactId: a.contactId, body: `${APPT_TYPE[a.type]} ${status.toLowerCase()}${reason ? ` · ${reason}` : ""}`, userId: actor.id, userName: actor.name } });
      if (action === "complete") {
        const o = await t.opportunity.findUnique({ where: { id: a.opportunityId }, include: { contact: true } });
        if (o && !o.closedAt) {
          if (!o.nextFollowUpAt || o.nextFollowUpAt < new Date() || o.nextFollowUpAt > followAt) await t.opportunity.update({ where: { id: o.id }, data: { nextFollowUpAt: followAt } });
          const owner = a.seller?.userId ?? actor.id;
          await t.task.create({ data: { title: `Seguimiento post ${APPT_TYPE[a.type].toLowerCase()} con ${o.contact.name}`, dueAt: followAt, assignedToId: owner, opportunityId: o.id } });
        }
      }
    }
    await audit(actor, `appointment.${action}`, "Appointment", id, `Cita ${status.toLowerCase()}${reason ? ` · ${reason}` : ""}`, undefined, t);
  });
  return { status, followAt: action === "complete" && a.opportunityId ? followAt : null };
}

/** Historial de la cita (creación, confirmación, reagendamientos, cierre). */
export const apptHistory = (id: string) => db.auditLog.findMany({ where: { entity: "Appointment", entityId: id }, orderBy: { createdAt: "asc" } });

export async function rescheduleAppointment(id: string, startAt: Date, actor: Actor) {
  return db.$transaction(async (t) => {
    const a = await t.appointment.findUnique({ where: { id } });
    if (!a) throw notFound();
    assertBranch(actor, a.branchId);
    if (actor.role === "VENDEDOR" && a.sellerId !== actor.sellerId) throw new AppError("Cita de otro vendedor.", 403, "forbidden");
    if (a.status === "COMPLETADA" || a.status === "CANCELADA") throw conflict("La cita ya está cerrada.");
    if (isNaN(startAt.getTime())) throw new AppError("Fecha u hora inválida.");
    const endAt = new Date(startAt.getTime() + (a.endAt.getTime() - a.startAt.getTime()));
    await checkConflicts(t, { startAt, endAt, sellerId: a.sellerId, vehicleId: a.vehicleId }, id);
    await t.appointment.update({ where: { id }, data: { startAt, endAt, status: "PROGRAMADA", rescheduled: { increment: 1 } } });
    if (a.opportunityId)
      await t.activity.create({ data: { type: "CITA", opportunityId: a.opportunityId, contactId: a.contactId, body: `Cita reagendada: ${dateTime(a.startAt)} → ${dateTime(startAt)}`, userId: actor.id, userName: actor.name } });
    await audit(actor, "appointment.reschedule", "Appointment", id, `Reagendada a ${dateTime(startAt)}`, undefined, t);
  });
}
