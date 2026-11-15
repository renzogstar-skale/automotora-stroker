import { unstable_rethrow } from "next/navigation";
import { AppError } from "@/server/errors";
import { Forbidden } from "./rbac";

export type ActionState = { ok?: boolean; error?: string; message?: string; data?: unknown } | null;

/** Ejecuta una mutación y traduce errores de negocio/permisos a mensajes para la interfaz. */
export async function run(fn: () => Promise<unknown>, message = "Cambios guardados."): Promise<ActionState> {
  try {
    const data = await fn();
    return { ok: true, message, data: data && typeof data === "object" && "secret" in data ? data : undefined };
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof AppError || e instanceof Forbidden) return { error: e.message };
    console.error(e);
    return { error: "Ocurrió un error inesperado. Intenta nuevamente." };
  }
}
export const str = (fd: FormData, k: string) => (fd.get(k)?.toString().trim() || "");
export const opt = (fd: FormData, k: string) => str(fd, k) || null;
export const int = (fd: FormData, k: string) => { const v = str(fd, k).replace(/[^\d-]/g, ""); return v ? parseInt(v, 10) : 0; };
