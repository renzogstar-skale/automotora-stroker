import Link from "next/link";
import { db } from "@/lib/db";
import { branchScope, type Actor } from "@/lib/rbac";
import { sp } from "@/lib/period";
import { ymd } from "@/lib/format";
import { Filter, RotateCcw } from "lucide-react";

type SP = Record<string, string | string[] | undefined>;
export async function visibleBranches(a: Actor) {
  const b = branchScope(a);
  return db.branch.findMany({ where: b ? { id: { in: b } } : {}, orderBy: { name: "asc" } });
}

/** Sucursales efectivas del filtro: la elegida (si es visible) o todas las visibles. */
export function effectiveBranches(a: Actor, s: SP) {
  const chosen = sp(s, "branch");
  const scope = branchScope(a);
  if (chosen && (!scope || scope.includes(chosen))) return [chosen];
  return scope;
}

/** Filtro común de período y sucursal unificado con espaciado 16px, inputs h-10 y bordes de 12px. */
export async function PeriodFilter({
  a,
  s,
  def = "month",
  extra,
  periods = ["month", "6m", "quarter", "year", "custom"],
}: {
  a: Actor;
  s: SP;
  def?: string;
  extra?: React.ReactNode;
  periods?: string[];
}) {
  const branches = await visibleBranches(a);
  const period = sp(s, "period") ?? def;
  const labels: Record<string, string> = {
    month: "Mes",
    "6m": "Últimos 6 meses",
    quarter: "Trimestre",
    year: "Año",
    custom: "Rango personalizado",
  };
  const thisMonth = ymd(new Date()).slice(0, 7);

  return (
    <form className="card mb-6 p-4 sm:p-5" method="get">
      <div className="flex flex-wrap items-end gap-3 sm:gap-4">
        <label className="min-w-36 flex-1 sm:flex-initial">
          <span className="label">Período</span>
          <select name="period" defaultValue={period} className="input">
            {periods.map((p) => (
              <option key={p} value={p}>
                {labels[p]}
              </option>
            ))}
          </select>
        </label>

        <label className="min-w-36 flex-1 sm:flex-initial">
          <span className="label">Mes referencia</span>
          <input
            type="month"
            name="ref"
            defaultValue={sp(s, "ref") ?? thisMonth}
            className="input"
          />
        </label>

        <label className="min-w-36 flex-1 sm:flex-initial">
          <span className="label">Desde</span>
          <input type="date" name="from" defaultValue={sp(s, "from")} className="input" />
        </label>

        <label className="min-w-36 flex-1 sm:flex-initial">
          <span className="label">Hasta</span>
          <input type="date" name="to" defaultValue={sp(s, "to")} className="input" />
        </label>

        {branches.length > 1 && (
          <label className="min-w-44 flex-1 sm:flex-initial">
            <span className="label">Sucursal</span>
            <select name="branch" defaultValue={sp(s, "branch") ?? ""} className="input">
              <option value="">Todas mis sucursales</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {extra}

        <div className="flex items-center gap-2 pt-2 sm:pt-0">
          <button type="submit" className="btn btn-dark">
            <Filter className="size-4" /> Aplicar
          </button>
          <Link href="?" className="btn btn-ghost" title="Restablecer filtros">
            <RotateCcw className="size-4" /> Limpiar
          </Link>
        </div>
      </div>

      <p className="mt-3 text-[11px] text-muted">
        «Mes» y «Trimestre» usan el mes de referencia; «Rango personalizado» usa Desde/Hasta.
      </p>
    </form>
  );
}
