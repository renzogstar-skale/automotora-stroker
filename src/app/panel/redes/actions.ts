"use server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { guard } from "@/lib/auth";
import { run, opt, str, type ActionState } from "@/lib/action";
import { fromLocalInput } from "@/lib/format";
import { AppError } from "@/server/errors";
import { connectAccount, createAccount, createPost, deletePost, disconnectAccount, publishPost, schedulePost, unschedulePost } from "@/server/social";

const refresh = () => revalidatePath("/panel/redes");

export async function accountAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("social");
  return run(async () => { await createAccount({ network: str(fd, "network"), kind: str(fd, "kind"), handle: str(fd, "handle") }, a); refresh(); }, "Cuenta agregada.");
}
export async function connectAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("social");
  const h = await headers();
  let url: string | null = null;
  const r = await run(async () => { url = (await connectAccount(str(fd, "id"), a, `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`)).url; refresh(); }, "Cuenta conectada (modo demo).");
  if (r?.ok && url) redirect(url);
  return r;
}
export async function disconnectAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("social");
  return run(async () => { await disconnectAccount(str(fd, "id"), a); refresh(); }, "Cuenta desconectada.");
}
export async function postAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("social");
  const mode = str(fd, "mode") === "schedule" ? "schedule" : str(fd, "mode") === "publish" ? "publish" : "draft";
  return run(async () => {
    const at = str(fd, "scheduledAt");
    const p = await createPost({ accountId: str(fd, "accountId"), vehicleId: opt(fd, "vehicleId"), text: str(fd, "text"), mode, scheduledAt: at ? fromLocalInput(at) : null }, a);
    refresh();
    if (p.status === "ERROR") throw new AppError(`Guardada con error: ${p.error}`);
  }, mode === "draft" ? "Borrador guardado." : mode === "schedule" ? "Publicación programada." : "Publicada.");
}
export async function publishAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("social");
  return run(async () => { try { await publishPost(str(fd, "id"), a); } finally { refresh(); } }, "Publicada.");
}
export async function scheduleAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("social");
  return run(async () => { await schedulePost(str(fd, "id"), fromLocalInput(str(fd, "at")), a); refresh(); }, "Programada.");
}
export async function unscheduleAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("social");
  return run(async () => { await unschedulePost(str(fd, "id"), a); refresh(); }, "Vuelve a borrador.");
}
export async function deleteAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("social");
  return run(async () => { await deletePost(str(fd, "id"), a); refresh(); }, "Eliminada.");
}
