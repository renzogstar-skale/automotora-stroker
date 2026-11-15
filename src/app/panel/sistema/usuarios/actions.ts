"use server";
import { revalidatePath } from "next/cache";
import { guard } from "@/lib/auth";
import { run, str, type ActionState } from "@/lib/action";
import { inviteUser, updateAccess, setActive, revokeSessions, recoverAccess } from "@/server/users";

const access = (fd: FormData) => ({
  role: str(fd, "role"), branchIds: fd.getAll("branchIds").map(String), canPublish: fd.get("canPublish") === "on", seller: str(fd, "seller"),
});
const done = () => revalidatePath("/panel/sistema/usuarios");

export async function inviteAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("users");
  return run(async () => { await inviteUser(a, { ...access(fd), name: str(fd, "name"), email: str(fd, "email") }); done(); }, "Invitación enviada. El enlace vence en 72 horas.");
}
export async function accessAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("users");
  return run(async () => { await updateAccess(a, str(fd, "id"), access(fd)); done(); }, "Permisos actualizados.");
}
export async function deactivateAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("users");
  return run(async () => { await setActive(a, str(fd, "id"), false); done(); }, "Cuenta desactivada y sesiones revocadas.");
}
export async function reactivateAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("users");
  return run(async () => { await setActive(a, str(fd, "id"), true); done(); }, "Cuenta reactivada.");
}
export async function revokeAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("users");
  return run(async () => { await revokeSessions(a, str(fd, "id")); done(); }, "Sesiones cerradas.");
}
export async function recoverAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("users");
  return run(async () => { await recoverAccess(a, str(fd, "id")); done(); }, "Enlace de acceso enviado.");
}
