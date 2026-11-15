"use client";
import { useState } from "react";
import { ActionForm, Submit } from "@/components/client/forms";
import type { ActionState } from "@/lib/action";
import { Lock, Mail, UserCheck } from "lucide-react";

export type DemoAccess = { accounts: { label: string; email: string }[]; password: string };

/** `demo` lo entrega el servidor solo fuera de producción (o con DEMO_LOGIN=1); así las credenciales no viajan en el bundle. */
export function DemoLoginForm({ action, demo = null }: { action: (s: ActionState, fd: FormData) => Promise<ActionState>; demo?: DemoAccess | null }) {
  const DEMO_ACCOUNTS = demo?.accounts ?? [];
  const DEMO_PASSWORD = demo?.password ?? "";
  const [email, setEmail] = useState(DEMO_ACCOUNTS[0]?.email ?? "");
  const [password, setPassword] = useState(DEMO_PASSWORD);

  return (
    <div className="space-y-4">
      <ActionForm action={action}>
        <div className="space-y-3.5">
          <label className="block">
            <span className="label flex items-center gap-1.5">
              <Mail className="size-3.5 text-muted" /> Correo corporativo
            </span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label className="block">
            <span className="label flex items-center gap-1.5">
              <Lock className="size-3.5 text-muted" /> Contraseña
            </span>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          <Submit className="btn btn-primary w-full h-11 text-sm font-bold shadow-md" pendingText="Iniciando sesión…">
            Iniciar sesión
          </Submit>
        </div>
      </ActionForm>

      {/* Selector de Cuentas Demo (solo entornos de prueba) */}
      {demo && <div className="mt-6 rounded-xl border border-line bg-surface-2/60 p-4 text-xs">
        <p className="font-bold text-ink mb-2 flex items-center gap-1.5">
          <UserCheck className="size-4 text-accent" /> Cuentas demo preconfiguradas:
        </p>
        <div className="flex flex-wrap gap-1.5">
          {DEMO_ACCOUNTS.map((acc) => (
            <button
              key={acc.email}
              type="button"
              onClick={() => {
                setEmail(acc.email);
                setPassword(DEMO_PASSWORD);
              }}
              className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all duration-200 ${
                email === acc.email
                  ? "border-accent bg-accent text-white shadow-xs"
                  : "border-line bg-surface hover:bg-surface-2 text-muted hover:text-ink"
              }`}
            >
              {acc.label}
            </button>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-line/60 pt-2 text-[11px] text-muted">
          <span>Contraseña demo:</span>
          <code className="font-mono font-bold text-ink bg-surface px-2 py-0.5 rounded border border-line">
            {DEMO_PASSWORD}
          </code>
        </div>
      </div>}
    </div>
  );
}
