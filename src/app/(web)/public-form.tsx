"use client";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { publicFormAction, type PublicFormState } from "./actions";

function Send({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="btn btn-primary w-full h-11 text-sm font-bold shadow-md hover:shadow-lg transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer"
      disabled={pending}
    >
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          <span>Enviando solicitud…</span>
        </>
      ) : (
        label
      )}
    </button>
  );
}

export type FieldDef = {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: [string, string][];
  placeholder?: string;
  full?: boolean;
  min?: string;
};

/** Formulario de la vitrina. El token se genera al cargar la página: reintentos y doble clic no duplican la oportunidad. */
export function PublicForm({
  kind,
  token,
  fields,
  hidden,
  submit,
}: {
  kind: string;
  token: string;
  fields: FieldDef[];
  hidden?: Record<string, string>;
  submit: string;
}) {
  const [state, action] = useActionState<PublicFormState, FormData>(publicFormAction, null);

  if (state?.ok) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-sm text-emerald-950 dark:text-emerald-200 animate-in fade-in duration-300 shadow-sm"
      >
        <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-emerald-600 text-white shadow-sm">
          <CheckCircle2 className="size-5" />
        </div>
        <div className="space-y-1">
          <p className="font-bold text-base text-emerald-900 dark:text-emerald-100">
            ¡Solicitud Recibida con Éxito!
          </p>
          <p className="text-xs text-emerald-800/90 dark:text-emerald-200/90 leading-relaxed">
            {state.message}
          </p>
          <span className="inline-block text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 mt-1">
            Un asesor de Automotora Stroker se comunicará contigo a la brevedad.
          </span>
        </div>
      </div>
    );
  }

  const err = state?.errors ?? {};
  return (
    <form action={action} className="grid gap-3.5 sm:grid-cols-2" noValidate>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="token" value={token} />
      {Object.entries(hidden ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />

      {state?.error && (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-xl border border-red-500/30 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-xs font-semibold text-red-800 dark:text-red-300 sm:col-span-2 flex items-center gap-2"
        >
          <AlertCircle className="size-4 shrink-0 text-red-600 dark:text-red-400" />
          <span>{err.vehicleId ?? state.error}</span>
        </div>
      )}

      {fields.map((f) => (
        <label key={f.name} className={f.full || f.type === "textarea" ? "sm:col-span-2" : undefined}>
          <span className="label">
            {f.label}
            {f.required && " *"}
          </span>
          {f.options ? (
            <select
              name={f.name}
              required={f.required}
              className="input transition-all"
              aria-invalid={!!err[f.name]}
            >
              {f.options.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          ) : f.type === "textarea" ? (
            <textarea
              name={f.name}
              rows={3}
              placeholder={f.placeholder}
              className="input h-auto py-2.5 transition-all"
              aria-invalid={!!err[f.name]}
            />
          ) : (
            <input
              name={f.name}
              type={f.type ?? "text"}
              required={f.required}
              placeholder={f.placeholder}
              min={f.min}
              className="input transition-all"
              aria-invalid={!!err[f.name]}
            />
          )}
          {err[f.name] && <span className="mt-1 block text-xs text-red-700 font-medium">{err[f.name]}</span>}
        </label>
      ))}

      <div className="sm:col-span-2 pt-1">
        <Send label={submit} />
        <p className="mt-1.5 text-[11px] text-muted">
          Tus datos serán tratados de forma confidencial conforme a la legislación vigente.
        </p>
      </div>
    </form>
  );
}
