"use server";
import { submitPublicForm, type FormKind } from "@/server/web";

export type PublicFormState = { ok?: boolean; message?: string; errors?: Record<string, string>; error?: string } | null;

const KINDS: FormKind[] = ["CONSULTA", "TEST_DRIVE", "CONSIGNACION"];
const OK: Record<FormKind, string> = {
  CONSULTA: "¡Gracias! Recibimos tu consulta y un ejecutivo te contactará pronto.",
  TEST_DRIVE: "¡Listo! Recibimos tu solicitud de test drive; te confirmaremos el horario.",
  CONSIGNACION: "¡Gracias! Recibimos los datos de tu auto; te llamaremos para coordinar la tasación.",
};

export async function publicFormAction(_: PublicFormState, fd: FormData): Promise<PublicFormState> {
  const kind = fd.get("kind") as FormKind;
  if (!KINDS.includes(kind)) return { error: "Formulario inválido." };
  const input = Object.fromEntries([...fd.entries()].filter(([k, v]) => typeof v === "string" && v !== "" && !["kind", "token"].includes(k)));
  if (fd.get("website")) input.website = String(fd.get("website"));
  try {
    const r = await submitPublicForm(kind, input, String(fd.get("token") ?? ""));
    if (!r.ok) return r.errors.website ? { ok: true, message: OK[kind] } : { errors: r.errors, error: "Revisa los campos marcados." };
    return { ok: true, message: OK[kind] };
  } catch (e) {
    console.error(e);
    return { error: "No pudimos enviar tu solicitud. Intenta nuevamente o escríbenos por WhatsApp." };
  }
}
