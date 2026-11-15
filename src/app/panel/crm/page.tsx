import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { guard } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, branchScope } from "@/lib/rbac";
import { sp, qs } from "@/lib/period";
import { STAGES, STAGE_LABEL, STAGE_TONE, SOURCE_LABEL, OPP_TYPE_LABEL } from "@/lib/labels";
import { ago, date, dateTime, nowMs, rate } from "@/lib/format";
import { crmStats } from "@/server/crm";
import { Badge, Card, Empty, Kpi, PageHeader, Pagination, Table, Tabs } from "@/components/ui";
import { Kanban } from "@/components/client/kanban";
import { oppWhere, isGlobal } from "./query";
import { moveStageAction } from "./actions";

type SP = Promise<Record<string, string | string[] | undefined>>;
const KEEP = ["type", "view", "scope", "q", "seller", "branch", "stage", "source", "from", "to"];

export default async function Crm({ searchParams }: { searchParams: SP }) {
  const a = await guard("crm");
  const s = await searchParams;
  const type = sp(s, "type") ?? "VENTA", view = sp(s, "view") ?? "board", page = Math.max(1, +(sp(s, "page") ?? 1));
  const where = oppWhere(a, s);
  const bs = branchScope(a);
  const [stats, sellers, branches, typeCounts] = await Promise.all([
    crmStats(where),
    db.seller.findMany({ where: { active: true, ...(bs ? { branchId: { in: bs } } : {}) }, orderBy: { name: "asc" } }),
    db.branch.findMany({ where: bs ? { id: { in: bs } } : {} }),
    db.opportunity.groupBy({ by: ["type"], where: oppWhere(a, s, { ignoreType: true }), _count: true }),
  ]);
  const tc = Object.fromEntries(typeCounts.map((t) => [t.type, t._count]));
  const now = nowMs();
  const list = await db.opportunity.findMany({
    where, include: { contact: true, seller: true, vehicle: true }, orderBy: [{ nextFollowUpAt: "asc" }, { createdAt: "desc" }],
    skip: view === "list" ? (page - 1) * 25 : 0, take: view === "list" ? 25 : 400,
  });
  const cards = list.map((o) => ({
    id: o.id, name: o.contact.name, interest: o.vehicle ? `${o.vehicle.brand} ${o.vehicle.model} ${o.vehicle.year}` : o.interest, seller: o.seller?.name.split(" ")[0] ?? "Sin asignar",
    source: SOURCE_LABEL[o.source], stage: o.stage, age: ago(o.createdAt), followUp: o.nextFollowUpAt && !o.closedAt ? dateTime(o.nextFollowUpAt).slice(0, 10) : null,
    overdue: !!o.nextFollowUpAt && !o.closedAt && o.nextFollowUpAt.getTime() < now,
  }));
  const closeRate = rate(stats.won, stats.won + stats.lost);
  const negRate = rate(stats.reachedNeg, stats.total);
  const noAnsRate = rate(stats.noAnswer, stats.active);
  const cancelRate = rate(stats.lost, stats.closed);
  const link = (extra: Record<string, string | undefined>) => `/panel/crm${qs(s, extra, KEEP)}`;
  return (
    <>
      <PageHeader title="CRM" desc={isGlobal(a, s) ? "Vista global de tus sucursales" : "Mi cartera"}
        actions={<>
          {can(a, "crm.all") && <div className="flex rounded-lg border border-line p-0.5 text-sm"><Link className={`rounded-md px-2.5 py-1 ${isGlobal(a, s) ? "bg-surface-2 font-medium" : "text-muted"}`} href={link({ scope: undefined })}>Global</Link><Link className={`rounded-md px-2.5 py-1 ${!isGlobal(a, s) ? "bg-surface-2 font-medium" : "text-muted"}`} href={link({ scope: "mine" })}>Mi vista</Link></div>}
          <div className="flex rounded-lg border border-line p-0.5 text-sm"><Link className={`rounded-md px-2.5 py-1 ${view !== "list" ? "bg-surface-2 font-medium" : "text-muted"}`} href={link({ view: undefined, page: undefined })}>Tablero</Link><Link className={`rounded-md px-2.5 py-1 ${view === "list" ? "bg-surface-2 font-medium" : "text-muted"}`} href={link({ view: "list" })}>Lista</Link></div>
          {can(a, "crm.trash") && <Link href="/panel/crm/papelera" className="btn"><Trash2 className="size-4" />Papelera</Link>}
          <Link href={`/panel/crm/nuevo?type=${type}`} className="btn btn-primary"><Plus className="size-4" />Nuevo lead</Link>
        </>} />
      <Tabs items={(["VENTA", "CONSIGNACION", "PISO"] as const).map((t) => ({ href: link({ type: t, page: undefined, stage: undefined }), label: OPP_TYPE_LABEL[t], active: type === t, count: tc[t] ?? 0 }))} />
      <form className="card mb-3 grid grid-cols-2 gap-2 p-3 md:grid-cols-4 xl:grid-cols-8" method="get">
        <input type="hidden" name="type" value={type} /><input type="hidden" name="view" value={view} />{sp(s, "scope") && <input type="hidden" name="scope" value={sp(s, "scope")} />}
        <input name="q" defaultValue={sp(s, "q")} placeholder="Nombre, teléfono, RUT…" className="input col-span-2" aria-label="Buscar" />
        {isGlobal(a, s) && <select name="seller" defaultValue={sp(s, "seller") ?? ""} className="input" aria-label="Vendedor"><option value="">Vendedor</option>{sellers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}
        {branches.length > 1 && <select name="branch" defaultValue={sp(s, "branch") ?? ""} className="input" aria-label="Sucursal"><option value="">Sucursal</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>}
        <select name="stage" defaultValue={sp(s, "stage") ?? ""} className="input" aria-label="Etapa"><option value="">Etapa</option>{STAGES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <select name="source" defaultValue={sp(s, "source") ?? ""} className="input" aria-label="Origen"><option value="">Origen</option>{Object.entries(SOURCE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <input type="date" name="from" defaultValue={sp(s, "from")} className="input" aria-label="Creado desde" />
        <div className="flex gap-2"><input type="date" name="to" defaultValue={sp(s, "to")} className="input" aria-label="Creado hasta" /><button className="btn btn-dark">Filtrar</button></div>
      </form>
      <div className="mb-1 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
        <Kpi label="Total" value={stats.total} sub="Universo de los filtros" />
        <Kpi label="Activos" value={stats.active} sub={`${rate(stats.active, stats.total).detail} del total`} />
        <Kpi label="Concretados" value={stats.won} sub={`${rate(stats.won, stats.total).detail} del total`} href={link({ stage: "CONCRETADO" })} />
        <Kpi label="Efectividad de cierre" value={closeRate.text} sub={`${closeRate.detail} concretados / cerrados`} />
        <Kpi label="Sin respuesta" value={noAnsRate.text} sub={`${noAnsRate.detail} activos en «No contesta»`} href={link({ stage: "NO_CONTESTA" })} />
        <Kpi label="Avance a negociación" value={negRate.text} sub={`${negRate.detail} del total`} />
        <Kpi label="Cancelación" value={cancelRate.text} sub={`${cancelRate.detail} cancelados / cerrados`} href={link({ stage: "CANCELADO" })} />
      </div>
      <p className="mb-4 text-[11px] text-muted">Universo: oportunidades de tipo {OPP_TYPE_LABEL[type].toLowerCase()} no eliminadas que cumplen los filtros activos (los mismos de la lista y el tablero). Efectividad = concretados ÷ (concretados + cancelados). Avance = alcanzaron Negociando o una etapa posterior alguna vez ÷ total. Sin respuesta = en «No contesta» ÷ activos. Cancelación = cancelados ÷ (concretados + cancelados).</p>
      {view === "list" ? (
        <Card bodyClass="p-0">
          {list.length === 0 ? <Empty title="Sin oportunidades con estos filtros" /> : (
            <Table><thead><tr><th>Contacto</th><th>Etapa</th><th>Interés</th><th>Vendedor</th><th>Origen</th><th>Próximo seguimiento</th><th>Creado</th></tr></thead><tbody>
              {list.map((o) => (
                <tr key={o.id}>
                  <td><Link href={`/panel/crm/${o.id}${qs(s, {}, KEEP)}`} className="font-medium hover:text-accent">{o.contact.name}</Link><div className="text-xs text-muted">{o.contact.phone}</div></td>
                  <td><Badge tone={STAGE_TONE[o.stage]}>{STAGE_LABEL[o.stage]}</Badge></td>
                  <td className="max-w-56 truncate">{o.vehicle ? `${o.vehicle.brand} ${o.vehicle.model}` : o.interest}</td>
                  <td>{o.seller?.name ?? "—"}</td><td>{SOURCE_LABEL[o.source]}</td>
                  <td className={o.nextFollowUpAt && !o.closedAt && o.nextFollowUpAt.getTime() < now ? "font-medium text-red-700 dark:text-red-400" : ""}>{o.closedAt ? "—" : dateTime(o.nextFollowUpAt)}</td>
                  <td className="text-muted">{date(o.createdAt)}</td>
                </tr>))}
            </tbody></Table>)}
          <Pagination page={page} pages={Math.ceil(stats.total / 25)} href={(p) => link({ page: String(p) })} />
        </Card>
      ) : (
        <>
          {list.length < stats.total && <p className="mb-2 text-xs text-muted">Mostrando {list.length} de {stats.total} tarjetas (las de seguimiento más próximo). Los contadores de cada columna reflejan el total; usa filtros o la lista para ver el resto.</p>}
          <Kanban key={JSON.stringify(stats.byStage)} cards={cards} columns={STAGES.map(([k, l]) => ({ key: k, label: l }))} move={moveStageAction} href="/panel/crm" totals={stats.byStage} />
        </>
      )}
    </>
  );
}
