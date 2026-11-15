import { ActionForm, Submit } from "@/components/client/forms";
import { resetAction } from "../actions";

export const metadata = { title: "Nueva contraseña" };
export default async function Reset({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">Crea tu contraseña</h1>
      <p className="mb-5 text-sm text-muted">Mínimo 10 caracteres. Al guardar se cierran las demás sesiones.</p>
      <ActionForm action={resetAction}>
        <input type="hidden" name="token" value={token} />
        <label className="block"><span className="label">Nueva contraseña</span><input name="password" type="password" minLength={10} required className="input" autoComplete="new-password" /></label>
        <label className="block"><span className="label">Repite la contraseña</span><input name="password2" type="password" minLength={10} required className="input" autoComplete="new-password" /></label>
        <Submit className="btn btn-primary w-full">Guardar y entrar</Submit>
      </ActionForm>
    </>
  );
}
