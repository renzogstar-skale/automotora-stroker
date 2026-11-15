"use client";
import { useMemo, useState, useTransition } from "react";
import { computeLoan, validateLoan } from "@/lib/loan";
import type { ActionState } from "@/lib/action";

const clp = (n: number) => new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);
const parse = (s: string) => Number(s.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".")) || 0;

export function Calculator({ initialPrice, opps, defaultOpp, save }: { initialPrice?: number; opps: { id: string; name: string }[]; defaultOpp?: string; save: (opp: string, i: ReturnType<typeof toInput>) => Promise<ActionState> }) {
  const [f, setF] = useState({ price: String(initialPrice ?? 15990000), down: "3000000", tradeIn: "0", months: "36", rate: "8,5" });
  const [opp, setOpp] = useState(defaultOpp ?? "");
  const [msg, setMsg] = useState<ActionState>(null);
  const [pending, start] = useTransition();
  const input = toInput(f);
  const errors = validateLoan(input);
  const r = useMemo(() => (errors.length ? null : computeLoan(input)), [f]); // eslint-disable-line react-hooks/exhaustive-deps
  const field = (k: keyof typeof f, label: string, hint?: string) => (
    <label className="block"><span className="label">{label}</span><input className="input" inputMode="decimal" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />{hint && <span className="text-[11px] text-muted">{hint}</span>}</label>
  );
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="card p-4">
        <h2 className="mb-3 text-sm font-semibold">Datos del financiamiento</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {field("price", "Precio del vehículo (CLP)")}{field("down", "Pie inicial (CLP)")}
          {field("tradeIn", "Valor aceptado en parte de pago", "0 si no aplica")}{field("months", "Plazo (meses)", "Entre 6 y 72")}
          {field("rate", "Tasa anual (%)", "Nominal; usa coma decimal")}
        </div>
        {errors.length > 0 && <ul role="alert" className="mt-3 list-disc rounded-lg bg-red-50 py-2 pl-7 pr-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
      </section>
      <section className="card p-4">
        <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold">Resultado del cálculo</h2><span className="rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">Simulación referencial</span></div>
        {r ? (
          <>
            <p className="text-xs text-muted">Cuota mensual</p>
            <p className="text-3xl font-semibold tabular-nums" title={clp(r.cuota)}>{clp(r.cuota)}</p>
            <dl className="mt-3 grid grid-cols-2 gap-y-1.5 text-sm">
              <dt className="text-muted">Total a financiar</dt><dd className="text-right tabular-nums">{clp(r.principal)}</dd>
              <dt className="text-muted">Total de intereses</dt><dd className="text-right tabular-nums">{clp(r.interest)}</dd>
              <dt className="text-muted">Total a pagar por el crédito</dt><dd className="text-right tabular-nums">{clp(r.totalCredit)}</dd>
              <dt className="font-medium">Desembolso total del comprador</dt><dd className="text-right font-semibold tabular-nums">{clp(r.buyerTotal)}</dd>
              <dt className="text-muted">Tasa mensual aplicada</dt><dd className="text-right tabular-nums">{(r.monthlyRate * 100).toLocaleString("es-CL", { maximumFractionDigits: 4 })}%</dd>
            </dl>
            <p className="mt-3 text-[11px] text-muted">Tasa mensual = tasa anual ÷ 12. Cuota fija (amortización francesa); con tasa 0 la cuota es el monto ÷ plazo. Desembolso total = pie + parte de pago + cuotas. No incluye seguros, impuestos, gastos notariales ni comisiones de la financiera.</p>
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
              <select className="input w-60" value={opp} onChange={(e) => setOpp(e.target.value)} aria-label="Oportunidad"><option value="">Guardar en oportunidad…</option>{opps.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
              <button className="btn btn-dark" disabled={!opp || pending} onClick={() => start(async () => setMsg(await save(opp, input)))}>Guardar simulación</button>
              {msg?.error && <span className="text-xs text-red-700">{msg.error}</span>}{msg?.ok && <span className="text-xs text-emerald-700">{msg.message}</span>}
            </div>
          </>
        ) : <p className="text-sm text-muted">Corrige los datos para ver el resultado.</p>}
      </section>
    </div>
  );
}
function toInput(f: { price: string; down: string; tradeIn: string; months: string; rate: string }) {
  return { price: parse(f.price), down: parse(f.down), tradeIn: parse(f.tradeIn), months: Math.round(parse(f.months)), annualRate: parse(f.rate) };
}
