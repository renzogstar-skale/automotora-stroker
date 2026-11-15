"use server";
import { revalidatePath } from "next/cache";
import { guard } from "@/lib/auth";
import { run, int, str, type ActionState } from "@/lib/action";
import { saveGcal } from "@/server/gcal";
import { createApiKey, revokeApiKey } from "@/server/apikeys";
import { disconnectIntegration, testIntegration, type IntegrationKey } from "@/server/integrations";

const refresh = () => revalidatePath("/panel/sistema/integraciones");

export async function gcalAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("integrations");
  return run(async () => {
    const calendars: Record<string, string> = {};
    for (const [k, v] of fd.entries()) if (k.startsWith("cal_") && v.toString().trim()) calendars[k.slice(4)] = v.toString().trim();
    await saveGcal({
      enabled: fd.get("enabled") === "on", direction: str(fd, "direction") === "BIDIRECCIONAL" ? "BIDIRECCIONAL" : "PUSH",
      types: fd.getAll("types").map(String), reminderMin: int(fd, "reminderMin"), calendars,
    }, a);
    revalidatePath("/panel/sistema/integraciones");
    revalidatePath("/panel/citas");
  }, "Configuración de Google Calendar guardada.");
}

export async function testAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("integrations");
  let msg = "";
  const r = await run(async () => { try { msg = await testIntegration(str(fd, "key") as IntegrationKey, a); } finally { refresh(); } });
  return r?.ok ? { ok: true, message: msg } : r;
}
export async function disconnectAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("integrations");
  return run(async () => { await disconnectIntegration(str(fd, "key") as IntegrationKey, a); refresh(); }, "Integración desconectada.");
}

export async function createKeyAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("integrations");
  return run(async () => {
    const { key, secret } = await createApiKey(str(fd, "name"), str(fd, "branchId"), fd.getAll("perms").map(String), a);
    refresh();
    return { secret, prefix: key.prefix };
  }, "Clave creada. Cópiala ahora: no se volverá a mostrar.");
}
export async function revokeKeyAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("integrations");
  return run(async () => { await revokeApiKey(str(fd, "id"), a); refresh(); }, "Clave revocada.");
}
