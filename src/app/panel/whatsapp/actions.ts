"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { guard } from "@/lib/auth";
import { run, opt, str, type ActionState } from "@/lib/action";
import { addNumber, assignConversation, leadFromConversation, linkConversation, sendMessage, setNumberActive } from "@/server/whatsapp";

const refresh = () => revalidatePath("/panel/whatsapp");

export async function sendAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("whatsapp");
  return run(async () => { await sendMessage(str(fd, "id"), str(fd, "body"), str(fd, "clientId"), a); refresh(); }, "Mensaje enviado.");
}
export async function assignAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("whatsapp");
  return run(async () => { await assignConversation(str(fd, "id"), opt(fd, "userId"), a); refresh(); }, "Asignación actualizada.");
}
export async function linkAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("whatsapp");
  return run(async () => { await linkConversation(str(fd, "id"), opt(fd, "oppId"), a); refresh(); }, "Vínculo actualizado.");
}
export async function leadAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("whatsapp");
  let id = "";
  const r = await run(async () => { id = (await leadFromConversation(str(fd, "id"), a)).id; refresh(); }, "Lead creado y vinculado.");
  if (r?.ok) redirect(`/panel/crm/${id}`);
  return r;
}
export async function addNumberAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("integrations");
  return run(async () => {
    await addNumber({ phone: str(fd, "phone"), label: str(fd, "label"), provider: str(fd, "provider") === "YCLOUD" ? "YCLOUD" : "META", branchId: str(fd, "branchId") }, a);
    refresh();
  }, "Número autorizado.");
}
export async function numberStatusAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("integrations");
  return run(async () => { await setNumberActive(str(fd, "id"), str(fd, "active") === "1", a); refresh(); }, "Estado actualizado.");
}
