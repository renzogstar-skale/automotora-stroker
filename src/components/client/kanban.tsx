"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { AlertCircle, Clock, GripVertical } from "lucide-react";
import clsx from "clsx";
import type { ActionState } from "@/lib/action";

type Card = { id: string; name: string; interest: string | null; seller: string; source: string; stage: string; followUp: string | null; overdue: boolean; age: string };
type Col = { key: string; label: string };

/** Kanban: arrastrar en escritorio, selector de etapa en celular (listas por etapa). Cancelar exige motivo. */
export function Kanban({ cards, columns, move, href, totals }: {
  cards: Card[]; columns: Col[]; move: (id: string, stage: string, reason?: string) => Promise<ActionState>; href: string;
  /** Conteo real por etapa en el servidor (mismo universo que lista e indicadores), aunque no se carguen todas las tarjetas. */
  totals: Record<string, number>;
}) {
  const [items, setItems] = useState(cards);
  const loaded = (xs: Card[], k: string) => xs.filter((i) => i.stage === k).length;
  const count = (k: string) => (totals[k] ?? 0) - loaded(cards, k) + loaded(items, k);
  const [drag, setDrag] = useState<string | null>(null);
  const [cancel, setCancel] = useState<{ id: string } | null>(null);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [mobileStage, setMobileStage] = useState(columns[0].key);
  const [pending, start] = useTransition();

  const doMove = (id: string, stage: string, why?: string) => {
    const prev = items;
    setItems((xs) => xs.map((c) => (c.id === id ? { ...c, stage } : c)));
    start(async () => {
      const r = await move(id, stage, why);
      if (r?.error) { setItems(prev); setErr(r.error); } else setErr(null);
    });
  };
  const request = (id: string, stage: string) => {
    if (items.find((c) => c.id === id)?.stage === stage) return;
    if (stage === "CANCELADO") { setCancel({ id }); setReason(""); } else doMove(id, stage);
  };
  const card = (c: Card) => (
    <div key={c.id} draggable onDragStart={() => setDrag(c.id)} onDragEnd={() => setDrag(null)}
      className={clsx("group rounded-lg border border-line bg-surface p-2.5 text-sm shadow-sm", drag === c.id && "opacity-50")}>
      <div className="flex items-start gap-1">
        <GripVertical className="mt-0.5 hidden size-3.5 shrink-0 cursor-grab text-muted lg:block" aria-hidden />
        <Link href={`${href}/${c.id}`} className="min-w-0 flex-1 font-medium hover:text-accent">{c.name}</Link>
      </div>
      {c.interest && <p className="mt-0.5 truncate text-xs text-muted">{c.interest}</p>}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
        <span>{c.seller}</span><span>· {c.source}</span><span>· {c.age}</span>
        {c.followUp && <span className={clsx("inline-flex items-center gap-0.5", c.overdue && "font-medium text-red-700 dark:text-red-400")}>{c.overdue ? <AlertCircle className="size-3" /> : <Clock className="size-3" />}{c.overdue ? "Vencido " : ""}{c.followUp}</span>}
      </div>
      <select aria-label="Mover a etapa" value={c.stage} onChange={(e) => request(c.id, e.target.value)} className="input mt-2 h-7 text-xs lg:hidden">
        {columns.map((col) => <option key={col.key} value={col.key}>{col.label}</option>)}
      </select>
    </div>
  );
  return (
    <div>
      {err && <p role="alert" className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">{err}</p>}
      {pending && <p className="mb-2 text-xs text-muted">Guardando cambio de etapa…</p>}
      <div className="lg:hidden">
        <select className="input mb-2" value={mobileStage} onChange={(e) => setMobileStage(e.target.value)} aria-label="Etapa">
          {columns.map((c) => <option key={c.key} value={c.key}>{c.label} ({count(c.key)})</option>)}
        </select>
        <div className="space-y-2">{items.filter((i) => i.stage === mobileStage).map(card)}{!items.some((i) => i.stage === mobileStage) && <p className="py-6 text-center text-sm text-muted">Sin oportunidades en esta etapa</p>}</div>
      </div>
      <div className="hidden gap-3 overflow-x-auto pb-2 lg:flex">
        {columns.map((col) => {
          const list = items.filter((i) => i.stage === col.key);
          return (
            <div key={col.key} onDragOver={(e) => e.preventDefault()} onDrop={() => drag && request(drag, col.key)}
              className="flex w-64 shrink-0 flex-col rounded-xl bg-surface-2 p-2 ring-1 ring-line">
              <div className="mb-2 flex items-center justify-between px-1 text-xs font-semibold"><span>{col.label}</span><span className="rounded bg-surface px-1.5 tabular-nums text-muted" title={list.length < count(col.key) ? `Mostrando ${list.length}` : undefined}>{count(col.key)}</span></div>
              <div className="flex max-h-[62vh] min-h-24 flex-col gap-2 overflow-y-auto">{list.map(card)}</div>
            </div>
          );
        })}
      </div>
      {cancel && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal aria-label="Motivo de cancelación">
          <form className="card w-full max-w-sm space-y-3 p-4" onSubmit={(e) => { e.preventDefault(); if (reason.trim()) { doMove(cancel.id, "CANCELADO", reason); setCancel(null); } }}>
            <p className="font-semibold">Motivo de cancelación</p>
            <select className="input" value={reason} onChange={(e) => setReason(e.target.value)} required>
              <option value="">Selecciona…</option>
              {["Compró en otra automotora", "Sin aprobación de crédito", "Precio fuera de presupuesto", "Desistió de la compra", "No responde hace 30 días", "Datos de contacto inválidos"].map((r) => <option key={r}>{r}</option>)}
            </select>
            <div className="flex justify-end gap-2"><button type="button" className="btn" onClick={() => setCancel(null)}>Volver</button><button className="btn btn-primary" disabled={!reason}>Cancelar oportunidad</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
