import Link from "next/link";
import { ActionForm, Submit } from "@/components/client/forms";
import { forgotAction } from "../actions";

export const metadata = { title: "Recuperar contraseña" };
export default function Forgot() {
  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">Recuperar contraseña</h1>
      <p className="mb-5 text-sm text-muted">Te enviaremos un enlace de un solo uso.</p>
      <ActionForm action={forgotAction} resetOnOk>
        <label className="block"><span className="label">Correo</span><input name="email" type="email" required className="input" /></label>
        <Submit className="btn btn-primary w-full" pendingText="Enviando…">Enviar enlace</Submit>
      </ActionForm>
      <p className="mt-4 text-sm"><Link className="link" href="/login">Volver a ingresar</Link>{process.env.NODE_ENV !== "production" && <> · <Link className="link" href="/dev/correos">Bandeja de correos demo</Link></>}</p>
    </>
  );
}
