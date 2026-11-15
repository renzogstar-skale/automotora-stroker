"use client";
import { useState, useTransition } from "react";
import { Upload } from "lucide-react";
import type { ImportRow, RowCheck } from "@/app/panel/leads/actions";

/** Parser CSV mínimo (comillas, ; o ,). */
function parseCsv(text: string): ImportRow[] {
  const sep = (text.split("\n")[0].match(/;/g)?.length ?? 0) > (text.split("\n")[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let cur: string[] = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; }
    else if (c === '"') q = true;
    else if (c === sep) { cur.push(f); f = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; cur.push(f); rows.push(cur); cur = []; f = ""; }
    else f += c;
  }
  if (f || cur.length) { cur.push(f); rows.push(cur); }
  const [head, ...body] = rows.filter((r) => r.some((x) => x.trim()));
  const keys = head.map((h) => h.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""));
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i]?.trim() ?? ""])) as ImportRow);
}

export function CsvImport({ branches, validate, commit }: {
  branches: { id: string; name: string }[];
  validate: (rows: ImportRow[]) => Promise<RowCheck[]>;
  commit: (rows: ImportRow[], branchId: string, dup: boolean) => Promise<{ created: number; skipped: number }>;
}) {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [checks, setChecks] = useState<RowCheck[]>([]);
  const [branch, setBranch] = useState(branches[0]?.id ?? "");
  const [dup, setDup] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const onFile = async (f: File) => {
    setDone(null);
    const r = parseCsv(await f.text());
    setRows(r);
    start(async () => setChecks(await validate(r)));
  };
  const bad = checks.filter((c) => c.errors.length).length, dups = checks.filter((c) => !c.errors.length && c.duplicate).length;
  const ok = rows.length - bad - (dup ? checks.filter((c) => c.duplicate?.startsWith("Repetido")).length : dups);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="btn cursor-pointer"><Upload className="size-4" />Elegir archivo CSV<input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} /></label>
        <a className="text-xs link" href={`data:text/csv;charset=utf-8,${encodeURIComponent("nombre,telefono,correo,rut,comuna,interes,presupuesto,origen\nAna Pérez,+56911112222,ana@correo.example,,Ñuñoa,SUV automático,15000000,REDES\n")}`} download="plantilla-leads.csv">Descargar plantilla</a>
      </div>
      {pending && <p className="text-sm text-muted">Validando…</p>}
      {rows.length > 0 && checks.length > 0 && (
        <>
          <p className="text-sm"><b>{rows.length}</b> filas · <span className="text-emerald-700 dark:text-emerald-400">{ok} se importarán</span> · <span className="text-red-700 dark:text-red-400">{bad} con errores</span> · <span className="text-amber-700 dark:text-amber-400">{dups} duplicadas</span></p>
          <div className="max-h-72 overflow-auto rounded-lg border border-line">
            <table className="tbl"><thead><tr><th>#</th><th>Nombre</th><th>Teléfono</th><th>Correo</th><th>Resultado</th></tr></thead><tbody>
              {rows.slice(0, 200).map((r, i) => {
                const c = checks[i];
                return <tr key={i}><td>{i + 1}</td><td>{r.nombre}</td><td>{r.telefono}</td><td>{r.correo}</td>
                  <td className="text-xs">{c.errors.length ? <span className="text-red-700 dark:text-red-400">✕ {c.errors.join("; ")}</span> : c.duplicate ? <span className="text-amber-700 dark:text-amber-400">⚠ {c.duplicate}</span> : <span className="text-emerald-700 dark:text-emerald-400">✓ Válida</span>}</td></tr>;
              })}</tbody></table>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select className="input w-56" value={branch} onChange={(e) => setBranch(e.target.value)} aria-label="Sucursal destino">{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
            <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={dup} onChange={(e) => setDup(e.target.checked)} />Agregar duplicados como nueva oportunidad del contacto existente</label>
            <button className="btn btn-primary" disabled={pending || ok <= 0} onClick={() => start(async () => { const r = await commit(rows, branch, dup); setDone(`Importados ${r.created}; omitidos ${r.skipped}.`); setRows([]); setChecks([]); })}>Importar {ok} filas</button>
          </div>
        </>
      )}
      {done && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">{done}</p>}
    </div>
  );
}
