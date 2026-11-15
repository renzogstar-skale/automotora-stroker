"use client";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import clsx from "clsx";
import type { ActionState } from "@/lib/action";

export function Submit({ children, className = "btn btn-primary", pendingText = "Guardando…", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" {...rest} className={className} disabled={pending || rest.disabled}>{pending ? <><Loader2 className="size-4 animate-spin" />{pendingText}</> : children}</button>;
}

export function Msg({ state }: { state: ActionState }) {
  if (!state) return null;
  if (state.error) return <p role="alert" className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-300"><AlertCircle className="size-4 shrink-0" />{state.error}</p>;
  if (state.ok && state.message) return <p role="status" className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"><CheckCircle2 className="size-4 shrink-0" />{state.message}</p>;
  return null;
}

/** Formulario con estado de envío, errores de servidor y reinicio opcional tras éxito. Evita doble envío (botón deshabilitado). */
export function ActionForm({ action, children, className, resetOnOk, onOk }: {
  action: (s: ActionState, fd: FormData) => Promise<ActionState>; children: React.ReactNode; className?: string; resetOnOk?: boolean; onOk?: (s: ActionState) => void;
}) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) { if (resetOnOk) ref.current?.reset(); onOk?.(state); } }, [state]); // eslint-disable-line react-hooks/exhaustive-deps
  return <form ref={ref} action={formAction} className={clsx("space-y-3", className)}><Msg state={state} />{children}</form>;
}

/** Botón de acción simple con confirmación inline (sin diálogos del navegador). */
export function InlineAction({ action, label, className = "btn btn-sm", fields, confirm, reasonLabel }: {
  action: (s: ActionState, fd: FormData) => Promise<ActionState>; label: React.ReactNode; className?: string; fields?: Record<string, string>; confirm?: boolean; reasonLabel?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className="inline-flex flex-wrap items-center gap-1.5">
      {fields && Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {reasonLabel && <input name="reason" required placeholder={reasonLabel} className="input h-8 w-44 text-xs" />}
      {confirm && <label className="flex items-center gap-1 text-xs text-muted"><input type="checkbox" required /> Confirmo</label>}
      <Submit className={className} pendingText="…">{label}</Submit>
      {state?.error && <span className="text-xs text-red-700 dark:text-red-400">{state.error}</span>}
      {state?.ok && state.message && <span className="text-xs text-emerald-700 dark:text-emerald-400">{state.message}</span>}
    </form>
  );
}
