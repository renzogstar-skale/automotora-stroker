"use client";
import { useActionState } from "react";
import { Msg, Submit } from "@/components/client/forms";
import type { ActionState } from "@/lib/action";

/** Crea una clave API: el secreto llega una única vez en la respuesta de la acción y no se guarda en el cliente. */
export function KeyForm({ action, branches, perms }: {
  action: (s: ActionState, fd: FormData) => Promise<ActionState>; branches: { id: string; name: string }[]; perms: readonly string[];
}) {
  const [state, formAction] = useActionState(action, null);
  const secret = state?.ok ? (state.data as { secret?: string } | undefined)?.secret : undefined;
  return (
    <form action={formAction} className="space-y-3">
      <Msg state={state} />
      {secret && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950">
          <p className="mb-1 font-semibold">Secreto (se muestra solo esta vez)</p>
          <code data-testid="api-secret" className="block select-all break-all rounded bg-white px-2 py-1 font-mono text-xs dark:bg-black">{secret}</code>
          <p className="mt-1 text-xs text-muted">Úsalo en el encabezado <code>x-api-key</code>. En la base solo queda su hash.</p>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block space-y-1.5"><span className="label">Nombre</span><input name="name" required minLength={3} maxLength={80} className="input" placeholder="n8n Viña" /></label>
        <label className="block space-y-1.5"><span className="label">Sucursal</span><select name="branchId" className="input">{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
        <fieldset className="space-y-1.5"><legend className="label">Permisos</legend>
          <div className="flex flex-wrap gap-3 pt-1 text-sm">{perms.map((p) => <label key={p} className="flex items-center gap-1"><input type="checkbox" name="perms" value={p} defaultChecked />{p}</label>)}</div>
        </fieldset>
      </div>
      <Submit>Crear clave</Submit>
    </form>
  );
}
