"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Stage } from "@prisma/client";
import { guard } from "@/lib/auth";
import { db } from "@/lib/db";
import { run, str, opt, int, type ActionState } from "@/lib/action";
import { fromLocalInput } from "@/lib/format";
import { audit } from "@/lib/audit";
import { addActivity, changeStage, checkAssignment, checkRut, createLead, getOppForActor, restoreOpp, trashOpp } from "@/server/crm";
import { AppError } from "@/server/errors";

export async function moveStageAction(id: string, stage: string, reason?: string): Promise<ActionState> {
  const a = await guard("crm");
  return run(async () => { await getOppForActor(id, a); await changeStage(id, stage as Stage, a, reason); revalidatePath("/panel/crm"); }, "Etapa actualizada.");
}
export async function stageFormAction(_: ActionState, fd: FormData) { return moveStageAction(str(fd, "id"), str(fd, "stage") as Stage, opt(fd, "reason") ?? undefined); }

export async function createLeadAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("crm");
  let id = "";
  const r = await run(async () => {
    const o = await createLead({
      name: str(fd, "name"), phone: opt(fd, "phone"), email: opt(fd, "email"), rut: opt(fd, "rut"), region: opt(fd, "region"), comuna: opt(fd, "comuna"),
      type: (str(fd, "type") || "VENTA") as "VENTA", source: (str(fd, "source") || "PRESENCIAL") as "WEB", branchId: str(fd, "branchId"),
      sellerId: opt(fd, "sellerId"), vehicleId: opt(fd, "vehicleId"), interest: opt(fd, "interest"), budget: int(fd, "budget") || null,
      payMethod: (opt(fd, "payMethod") as "CONTADO") ?? null, tradeIn: opt(fd, "tradeIn"), note: opt(fd, "note"),
      nextFollowUpAt: str(fd, "nextFollowUpAt") ? fromLocalInput(str(fd, "nextFollowUpAt")) : null,
    }, a);
    id = o.id;
  });
  if (r?.error) return r;
  redirect(`/panel/crm/${id}`);
}

export async function updateOppAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("crm");
  return run(async () => {
    const o = await getOppForActor(str(fd, "id"), a);
    const sellerId = opt(fd, "sellerId");
    if (sellerId && sellerId !== o.sellerId && a.role === "VENDEDOR") throw new AppError("Solo gerencia puede reasignar.", 403);
    if (!str(fd, "name")) throw new AppError("El nombre es obligatorio.");
    checkRut(opt(fd, "rut"));
    await checkAssignment(db, o.branchId, sellerId && sellerId !== o.sellerId ? sellerId : null, opt(fd, "vehicleId") !== o.vehicleId ? opt(fd, "vehicleId") : null, a);
    await db.opportunity.update({ where: { id: o.id }, data: {
      interest: opt(fd, "interest"), budget: int(fd, "budget") || null, payMethod: (opt(fd, "payMethod") as "CONTADO") ?? null, tradeIn: opt(fd, "tradeIn"),
      vehicleId: opt(fd, "vehicleId"), sellerId: sellerId ?? o.sellerId, nextFollowUpAt: str(fd, "nextFollowUpAt") ? fromLocalInput(str(fd, "nextFollowUpAt")) : null,
    } });
    await db.contact.update({ where: { id: o.contactId }, data: { name: str(fd, "name"), phone: opt(fd, "phone"), email: opt(fd, "email"), rut: opt(fd, "rut"), region: opt(fd, "region"), comuna: opt(fd, "comuna") } });
    if (sellerId && sellerId !== o.sellerId) {
      await audit(a, "opportunity.reassign", "Opportunity", o.id, "Vendedor reasignado", { from: o.sellerId, to: sellerId });
      const names = await db.seller.findMany({ where: { id: { in: [o.sellerId, sellerId].filter(Boolean) as string[] } }, select: { id: true, name: true } });
      const nm = (id: string | null) => names.find((x) => x.id === id)?.name ?? "Sin asignar";
      await db.activity.create({ data: { type: "SISTEMA", opportunityId: o.id, contactId: o.contactId, body: `Reasignada: ${nm(o.sellerId)} → ${nm(sellerId)}`, userId: a.id, userName: a.name } });
    }
    revalidatePath(`/panel/crm/${o.id}`);
  });
}
export async function activityAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("crm");
  return run(async () => {
    await addActivity(str(fd, "id"), str(fd, "type") as "NOTA", str(fd, "body"), a, opt(fd, "outcome") ?? undefined);
    if (str(fd, "nextFollowUpAt")) await db.opportunity.update({ where: { id: str(fd, "id") }, data: { nextFollowUpAt: fromLocalInput(str(fd, "nextFollowUpAt")) } });
    revalidatePath(`/panel/crm/${str(fd, "id")}`);
  }, "Registrado en la cronología.");
}
export async function trashAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("crm.trash");
  const r = await run(() => trashOpp(str(fd, "id"), a));
  if (r?.error) return r;
  redirect("/panel/crm");
}
export async function restoreAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("crm.trash");
  return run(async () => { await restoreOpp(str(fd, "id"), a); revalidatePath("/panel/crm/papelera"); }, "Recuperada.");
}
export async function taskAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("crm");
  return run(async () => {
    if (!str(fd, "title")) throw new AppError("Escribe la tarea.");
    const oppId = opt(fd, "opportunityId");
    if (oppId) await getOppForActor(oppId, a); // la oportunidad debe estar en el alcance del usuario
    await db.task.create({ data: { title: str(fd, "title"), dueAt: fromLocalInput(str(fd, "dueAt")), assignedToId: a.id, opportunityId: opt(fd, "opportunityId") } });
    revalidatePath("/panel/hoy");
  }, "Tarea creada.");
}
export async function doneTaskAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("crm");
  return run(async () => { await db.task.updateMany({ where: { id: str(fd, "id"), assignedToId: a.id }, data: { doneAt: new Date() } }); revalidatePath("/panel/hoy"); }, "Hecha.");
}
