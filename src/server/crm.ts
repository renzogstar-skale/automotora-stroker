import type { OppType, PayMethod, Prisma, Source, Stage } from "@prisma/client";
import { db, type Tx } from "@/lib/db";
import { audit } from "@/lib/audit";
import { normPhone, validRut } from "@/lib/format";
import { ACTIVE_STAGES, NEGOTIATION_STAGES, STAGES, STAGE_LABEL } from "@/lib/labels";
import { assertBranch, type Actor } from "@/lib/rbac";
import { AppError, notFound } from "./errors";

export type LeadInput = {
  name: string; phone?: string | null; email?: string | null; rut?: string | null; region?: string | null; comuna?: string | null;
  type?: OppType; source: Source; branchId: string; sellerId?: string | null; vehicleId?: string | null; interest?: string | null;
  budget?: number | null; payMethod?: PayMethod | null; tradeIn?: string | null; note?: string | null; externalId?: string | null;
  nextFollowUpAt?: Date | null;
};

/** Busca contacto por teléfono o correo; si no existe lo crea. Un contacto puede tener varias oportunidades. */
export async function upsertContact(tx: Tx, i: Pick<LeadInput, "name" | "phone" | "email" | "rut" | "region" | "comuna">) {
  const phone = normPhone(i.phone);
  const email = i.email?.trim().toLowerCase() || null;
  const or: Prisma.ContactWhereInput[] = [];
  if (phone) or.push({ phone });
  if (email) or.push({ email });
  const found = or.length ? await tx.contact.findFirst({ where: { OR: or } }) : null;
  if (found) {
    return tx.contact.update({
      where: { id: found.id },
      data: { phone: found.phone ?? phone, email: found.email ?? email, rut: found.rut ?? i.rut, region: found.region ?? i.region, comuna: found.comuna ?? i.comuna },
    });
  }
  return tx.contact.create({ data: { name: i.name.trim(), phone, email, rut: i.rut || null, region: i.region || null, comuna: i.comuna || null } });
}

/** Asignación automática: vendedor activo de la sucursal con menos oportunidades activas. */
async function autoAssign(tx: Tx, branchId: string) {
  const sellers = await tx.seller.findMany({
    where: { branchId, active: true },
    include: { _count: { select: { opportunities: { where: { stage: { in: ACTIVE_STAGES as Stage[] }, deletedAt: null } } } } },
  });
  sellers.sort((a, b) => a._count.opportunities - b._count.opportunities);
  return sellers[0]?.id ?? null;
}

/** El vendedor asignado debe estar activo y pertenecer a la sucursal de la oportunidad; el vehículo, a una sucursal visible. */
export async function checkAssignment(t: Tx | typeof db, branchId: string, sellerId: string | null | undefined, vehicleId: string | null | undefined, actor: Actor | null) {
  if (sellerId) {
    const s = await t.seller.findUnique({ where: { id: sellerId } });
    if (!s || !s.active) throw new AppError("Vendedor no válido o inactivo.");
    if (s.branchId !== branchId) throw new AppError("El vendedor no pertenece a la sucursal de la oportunidad.");
  }
  if (vehicleId) {
    const v = await t.vehicle.findUnique({ where: { id: vehicleId } });
    if (!v) throw new AppError("Vehículo no encontrado.");
    if (actor) assertBranch(actor, v.branchId);
  }
}
export const checkRut = (rut: string | null | undefined) => { if (rut?.trim() && !validRut(rut)) throw new AppError("RUT inválido."); };

export async function createLead(i: LeadInput, actor: Actor | null, tx?: Tx) {
  const run = async (t: Tx) => {
    if (actor) assertBranch(actor, i.branchId);
    if (!i.name?.trim()) throw new AppError("El nombre es obligatorio.");
    if (!i.phone && !i.email) throw new AppError("Ingresa teléfono o correo.");
    checkRut(i.rut);
    if (actor?.role === "VENDEDOR") i = { ...i, sellerId: actor.sellerId };
    await checkAssignment(t, i.branchId, i.sellerId, i.vehicleId, actor);
    const contact = await upsertContact(t, i);
    const sellerId = i.sellerId ?? (actor?.role === "VENDEDOR" ? actor.sellerId : null) ?? (await autoAssign(t, i.branchId));
    const opp = await t.opportunity.create({
      data: {
        type: i.type ?? "VENTA", source: i.source, contactId: contact.id, branchId: i.branchId, sellerId, vehicleId: i.vehicleId || null,
        interest: i.interest || null, budget: i.budget || null, payMethod: i.payMethod || null, tradeIn: i.tradeIn || null,
        externalId: i.externalId || null, nextFollowUpAt: i.nextFollowUpAt ?? new Date(Date.now() + 2 * 3600e3),
        stageHistory: { create: { to: "NUEVO", userId: actor?.id } },
      },
    });
    await t.activity.create({
      data: { type: "SISTEMA", opportunityId: opp.id, contactId: contact.id, body: `Oportunidad creada desde ${i.source}${i.note ? `: ${i.note}` : ""}`, userId: actor?.id, userName: actor?.name ?? "Sistema" },
    });
    return opp;
  };
  return tx ? run(tx) : db.$transaction(run);
}

/** Oportunidad dentro del alcance del usuario. Las de la papelera solo se ven desde la papelera. */
export async function getOppForActor(id: string, actor: Actor, opts: { trashed?: boolean } = {}) {
  const o = await db.opportunity.findUnique({ where: { id } });
  if (!o || !!o.deletedAt !== !!opts.trashed) throw notFound();
  assertBranch(actor, o.branchId);
  if (actor.role === "VENDEDOR" && o.sellerId !== actor.sellerId) throw new AppError("Esta oportunidad pertenece a otro vendedor.", 403, "forbidden");
  return o;
}

/** Cambio de etapa: permite saltar etapas, exige motivo al cancelar y registra historial y auditoría. */
export async function changeStage(id: string, to: Stage, actor: Actor | null, reason?: string | null, tx?: Tx) {
  const run = async (t: Tx) => {
    const o = await t.opportunity.findUnique({ where: { id } });
    if (!o) throw notFound();
    if (!STAGES.some(([k]) => k === to)) throw new AppError("Etapa no válida.");
    if (o.stage === to) return o;
    if (to === "CANCELADO" && !reason?.trim()) throw new AppError("Indica el motivo de cancelación.");
    const closed = to === "CONCRETADO" || to === "CANCELADO";
    const updated = await t.opportunity.update({
      where: { id },
      data: { stage: to, stageChangedAt: new Date(), closedAt: closed ? new Date() : null, cancelReason: to === "CANCELADO" ? reason : o.cancelReason },
    });
    await t.stageChange.create({ data: { opportunityId: id, from: o.stage, to, reason: reason || null, userId: actor?.id } });
    await t.activity.create({
      data: { type: "ETAPA", opportunityId: id, contactId: o.contactId, body: `${STAGE_LABEL[o.stage]} → ${STAGE_LABEL[to]}${reason ? ` · ${reason}` : ""}`, userId: actor?.id, userName: actor?.name ?? "Sistema" },
    });
    await audit(actor, "stage.change", "Opportunity", id, `Etapa ${STAGE_LABEL[o.stage]} → ${STAGE_LABEL[to]}`, { reason }, t);
    return updated;
  };
  return tx ? run(tx) : db.$transaction(run);
}

export async function addActivity(oppId: string, type: "LLAMADA" | "NOTA" | "MENSAJE", body: string, actor: Actor, outcome?: string) {
  if (!["LLAMADA", "NOTA", "MENSAJE"].includes(type)) throw new AppError("Tipo de actividad no válido.");
  const o = await getOppForActor(oppId, actor);
  if (!body.trim()) throw new AppError("Escribe el detalle.");
  return db.activity.create({ data: { type, opportunityId: oppId, contactId: o.contactId, body, outcome: outcome || null, userId: actor.id, userName: actor.name } });
}

export async function trashOpp(id: string, actor: Actor) {
  await getOppForActor(id, actor);
  await db.opportunity.update({ where: { id }, data: { deletedAt: new Date(), deletedById: actor.id } });
  await audit(actor, "opportunity.trash", "Opportunity", id, "Enviada a la papelera");
}
export async function restoreOpp(id: string, actor: Actor) {
  await getOppForActor(id, actor, { trashed: true });
  await db.opportunity.update({ where: { id }, data: { deletedAt: null, deletedById: null } });
  await audit(actor, "opportunity.restore", "Opportunity", id, "Recuperada de la papelera");
}

/**
 * Indicadores CRM. Universo: oportunidades no eliminadas que cumplen los filtros activos
 * (los mismos que alimentan la lista y el tablero, por eso los conteos coinciden).
 */
export async function crmStats(where: Prisma.OpportunityWhereInput) {
  const rows = await db.opportunity.groupBy({ by: ["stage"], where, _count: true });
  const by = Object.fromEntries(rows.map((r) => [r.stage, r._count])) as Record<string, number>;
  const total = rows.reduce((s, r) => s + r._count, 0);
  const won = by.CONCRETADO ?? 0, lost = by.CANCELADO ?? 0;
  const reachedNeg = await db.opportunity.count({
    where: { AND: [where, { OR: [{ stage: { in: NEGOTIATION_STAGES as Stage[] } }, { stageHistory: { some: { to: { in: NEGOTIATION_STAGES as Stage[] } } } }] }] },
  });
  return { total, active: total - won - lost, won, lost, closed: won + lost, noAnswer: by.NO_CONTESTA ?? 0, reachedNeg, byStage: by };
}
