import Link from "next/link";
import { CalendarClock, Car, CarFront, CircleDollarSign, HandCoins, Hash, Landmark, Search, Users } from "lucide-react";
import { guard } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, oppScope } from "@/lib/rbac";
import { parsePeriod, qs, monthKey, monthName, sp } from "@/lib/period";
import { addDays, clp, clpShort, dateTime, ago, startOfMonth, num } from "@/lib/format";
import { ACTIVE_STAGES, APPT_TYPE, STAGE_LABEL } from "@/lib/labels";
import { salesWithEcon } from "@/server/economics";
import { crmStats } from "@/server/crm";
import { taskScope } from "@/server/tasks";
import { apptScope, cashBalance, collections, currentState, pendingAppts } from "@/server/metrics";
import { getAlerts } from "@/server/alerts";
import { oppWhere } from "./crm/query";
import { Badge, Card, Empty, Kpi, PageHeader, Table } from "@/components/ui";
import { PeriodFilter, effectiveBranches } from "@/components/filters";
import { Bars, Donut } from "@/components/client/charts";

type SP = Promise<Record<string, string | string[] | undefined>>;
export default async function Dashboard({ searchParams }: { searchParams: SP }) {
  const a = await guard("dashboard");
  const s = await searchParams;
  const p = parsePeriod(s, "month");
  const branches = effectiveBranches(a, s);
  const branch = sp(s, "branch") && branches?.length === 1 ? branches[0] : undefined;
  const bw = branches ? { branchId: { in: branches } } : {};
  const mine = a.role === "VENDEDOR" ? { sellerId: a.sellerId ?? "-" } : {};
  const showCash = can(a, "finance") || can(a, "payments");
  const showCrm = can(a, "crm");
  // Mismo universo que CRM (tipo Venta, cartera según permisos); sin CRM, el alcance por sucursal.
  const oWhere = showCrm ? oppWhere(a, { branch }) : { ...oppScope(a), ...bw, deletedAt: null, type: "VENTA" as const };
  const aScope = apptScope(a, branches);
  const tScope = { ...taskScope(a, can(a, "team")), ...(branch && can(a, "team") ? { assignedTo: { branches: { some: { branchId: branch } } } } : {}) };
  const end = addDays(p.to, -1), sixFrom = startOfMonth(end, -5), sixTo = startOfMonth(end, 1);
  const now = new Date();
  const [sales, six, cobros, cash, state, crm, appt, appts, alerts, invByType, tasks, taskOpen, taskOver] = await Promise.all([
    salesWithEcon({ status: "CONFIRMADA", saleDate: { gte: p.from, lt: p.to }, ...bw, ...mine }),
    db.sale.findMany({ where: { status: "CONFIRMADA", saleDate: { gte: sixFrom, lt: sixTo }, ...bw, ...mine }, select: { saleDate: true, finalPrice: true } }),
    showCash ? collections(p, branches) : null,
    showCash ? cashBalance(p, branches) : null,
    currentState(branches, oWhere),
    crmStats(oWhere),
    pendingAppts(aScope),
    db.appointment.findMany({ where: { ...aScope, status: { in: ["PROGRAMADA", "CONFIRMADA"] }, startAt: { gte: now } }, include: { contact: true, seller: true, vehicle: true }, orderBy: { startAt: "asc" }, take: 6 }),
    getAlerts(a, 8),
    db.vehicle.groupBy({ by: ["bodyType"], where: { ...bw, status: { in: ["DISPONIBLE", "RESERVADO"] } }, _count: true }),
    showCrm ? db.task.findMany({ where: { ...tScope, doneAt: null }, include: { assignedTo: true, opportunity: { include: { contact: true } } }, orderBy: { dueAt: "asc" }, take: 6 }) : [],
    showCrm ? db.task.count({ where: { ...tScope, doneAt: null } }) : 0,
    showCrm ? db.task.count({ where: { ...tScope, doneAt: null, dueAt: { lt: now } } }) : 0,
  ]);
  const sold = sales.reduce((t, x) => t + x.finalPrice, 0);
  const trend = Array.from({ length: 6 }, (_, i) => startOfMonth(end, i - 5)).map((m) => {
    const rows = six.filter((x) => monthKey(x.saleDate) === monthKey(m));
    return { label: monthName(m), monto: rows.reduce((t, r) => t + r.finalPrice, 0), unidades: rows.length };
  });
  const pipeline = Object.fromEntries(ACTIVE_STAGES.map((st) => [st, crm.byStage[st] ?? 0]));
  const maxPipe = Math.max(1, ...Object.values(pipeline));
  const q = qs(s);
  // Enlaces a vistas de estado actual: conservan la sucursal (no el período, que esas vistas no usan).
  const join = (path: string, extra?: string) => { const u = [branch && `branch=${branch}`, extra].filter(Boolean).join("&"); return u ? `${path}?${u}` : path; };
  const back = encodeURIComponent(`/panel${q}`);
  return (
    <>
      <PageHeader title="Dashboard principal"
        desc={<>Período: <b className="capitalize">{p.label}</b>. Las tarjetas marcadas <b>Período</b> responden al filtro; las marcadas <b>Hoy</b> muestran el estado actual.</>}
        actions={
          <form action="/panel/buscar" role="search" className="w-full sm:w-72">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted" />
              <input name="q" minLength={2} placeholder="Buscar cliente, patente, folio, venta…" className="input h-10 pl-9" aria-label="Búsqueda global" />
            </label>
          </form>
        } />
      <PeriodFilter a={a} s={s} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        <Kpi scope="period" icon={CircleDollarSign} tone="accent" label="Vendido" value={clpShort(sold)} exact={sold} sub="Ventas confirmadas, precio final" href={`/panel/ventas${q}`} />
        <Kpi scope="period" icon={Hash} label="Unidades vendidas" value={num(sales.length)} sub="Ventas confirmadas" href={`/panel/ventas${q}`} />
        {cobros && <Kpi scope="period" icon={HandCoins} label="Cobros realizados" value={clpShort(cobros.total)} exact={cobros.total} sub={`${cobros.count} pagos, neto de reversos`} href={`/panel/finanzas/movimientos${qs(s, { cat: "cobros" })}`} />}
        {cash && <Kpi scope="period" icon={Landmark} label="Balance de caja" value={clpShort(cash.balance)} exact={cash.balance} sub={`Entradas ${clpShort(cash.in)} − salidas ${clpShort(cash.out)} (empresa)`} href={can(a, "finance") ? `/panel/finanzas/seguimiento${q}` : undefined} />}
        <Kpi scope="now" icon={Car} label="Inventario en stock" value={num(state.stockTotal)} sub={`${state.available} disponibles · ${state.reserved} reservados`} href={join("/panel/inventario")} />
        <Kpi scope="now" icon={CarFront} label="Unidades disponibles" value={num(state.available)} sub="Listas para vender o reservar" href={join("/panel/inventario", "status=DISPONIBLE")} />
        <Kpi scope="now" icon={Users} label="Leads activos" value={num(crm.active)} sub="Oportunidades de venta en etapas abiertas" href={showCrm ? join("/panel/crm") : undefined} />
        <Kpi scope="now" icon={CalendarClock} label="Citas pendientes" value={num(appt.total)} sub={`${appt.upcoming} próximas${appt.overdue ? ` · ${appt.overdue} vencidas sin cerrar` : ""}`} href={can(a, "appointments") ? join("/panel/citas", "view=agenda") : undefined} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-6">
        <Card title="Próximas citas" sub="Hoy" className="lg:col-span-2" action={can(a, "appointments") && <Link href={join("/panel/citas", "view=agenda")} className="text-xs link">Agenda</Link>} bodyClass="p-0">
          {appts.length === 0 ? <Empty compact title="Sin citas próximas" action={can(a, "appointments") && <Link href="/panel/citas?nueva=1" className="btn btn-sm">Agendar cita</Link>} /> : (
            <ul>{appts.map((x) => (
              <li key={x.id}><Link href={`/panel/citas?view=day&focus=${x.id}`} className="flex items-center gap-3 border-b border-line px-4 py-2 text-sm last:border-0 hover:bg-surface-2">
                <span className="w-24 shrink-0 text-xs tabular-nums text-muted">{dateTime(x.startAt)}</span>
                <span className="min-w-0 flex-1 truncate"><b className="font-medium">{APPT_TYPE[x.type]}</b> · {x.contact?.name ?? "Sin cliente"}{x.vehicle && <span className="text-muted"> · {x.vehicle.brand} {x.vehicle.model}</span>}</span>
              </Link></li>))}</ul>)}
        </Card>
        <Card title={`Avisos (${alerts.length})`} sub="Hoy" className="lg:col-span-2" bodyClass="p-0">
          <div id="avisos" />
          {alerts.length === 0 ? <Empty compact title="Todo al día" text="No hay seguimientos, citas ni reservas vencidas." /> : (
            <ul>{alerts.map((x, i) => (
              <li key={i}><Link href={x.href} className="block border-b border-line px-4 py-2 text-sm last:border-0 hover:bg-surface-2">
                <span className="flex items-center gap-2"><Badge tone={x.tone}>{x.kind}</Badge><span className="truncate">{x.reason}</span></span>
                <span className="text-xs text-muted">{x.who} · {ago(x.since)}</span>
              </Link></li>))}</ul>)}
        </Card>
        <Card title={can(a, "team") ? "Tareas del equipo" : "Mis tareas"} sub={`Hoy · ${taskOpen} pendientes${taskOver ? `, ${taskOver} vencidas` : ""}`} className="lg:col-span-2" bodyClass="p-0"
          action={showCrm && <Link href="/panel/tareas" className="text-xs link">Ver tareas</Link>}>
          {tasks.length === 0 ? <Empty compact title={showCrm ? "Sin tareas pendientes" : "Tu rol no gestiona tareas"} action={showCrm && <Link href="/panel/tareas" className="btn btn-sm">Nueva tarea</Link>} /> : (
            <ul>{tasks.map((t) => (
              <li key={t.id}><Link href={t.opportunityId ? `/panel/crm/${t.opportunityId}` : "/panel/tareas"} className="flex items-center gap-3 border-b border-line px-4 py-2 text-sm last:border-0 hover:bg-surface-2">
                <span className="min-w-0 flex-1 truncate">{t.title}{t.opportunity && <span className="text-muted"> · {t.opportunity.contact.name}</span>}<span className="block text-xs text-muted">{t.assignedTo.name}</span></span>
                <span className={`shrink-0 text-xs tabular-nums ${t.dueAt < now ? "text-red-700 dark:text-red-400" : "text-muted"}`}>{dateTime(t.dueAt)}</span>
              </Link></li>))}</ul>)}
        </Card>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Card title="Tendencia de ventas (6 meses)" sub={`Hasta ${monthName(startOfMonth(end))} · monto y unidades en gráficos separados`} className="lg:col-span-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Bars data={trend} series={[{ key: "monto", label: "Monto vendido" }]} yLabel="Monto vendido (CLP)" height={200} />
            <Bars data={trend} series={[{ key: "unidades", label: "Unidades" }]} money={false} yLabel="Unidades vendidas" height={200} />
          </div>
        </Card>
        <Card title="Distribución del inventario" sub="Hoy · disponibles y reservadas por carrocería" className="lg:col-span-2">
          {invByType.length ? <Donut label="Inventario por carrocería" data={invByType.sort((x, y) => y._count - x._count).map((r) => ({ name: r.bodyType, value: r._count }))} /> : <Empty compact title="Sin unidades en stock" />}
        </Card>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Card title="Últimas 5 ventas" sub="Período" className="lg:col-span-3" bodyClass="p-0" action={<Link href={`/panel/ventas${q}`} className="text-xs link">Ver ventas</Link>}>
          {sales.length === 0 ? <Empty compact title="Sin ventas en el período" /> : (
            <Table><thead><tr><th>Venta</th><th>Vehículo</th><th>Vendedor</th><th className="num">Precio</th></tr></thead><tbody>
              {sales.slice(0, 5).map((x) => <tr key={x.id}><td><Link className="link" href={`/panel/ventas/${x.id}?back=${back}`}>#{x.number}</Link> <span className="text-muted">{x.contact.name}</span></td><td>{x.vehicle.brand} {x.vehicle.model}</td><td>{x.seller.name}</td><td className="num">{clp(x.finalPrice)}</td></tr>)}
            </tbody></Table>)}
        </Card>
        <Card title="Pipeline" sub={`Hoy · ${crm.active} oportunidades abiertas por etapa`} className="lg:col-span-2" bodyClass="space-y-1.5">
          {ACTIVE_STAGES.map((st) => {
            const n = pipeline[st];
            const row = (
              <>
                <span className="w-36 shrink-0 truncate text-muted">{STAGE_LABEL[st]}</span>
                <span className="h-2 flex-1 rounded bg-surface-2"><span className="block h-2 rounded bg-[#2a78d6]" style={{ width: `${(n / maxPipe) * 100}%` }} /></span>
                <span className="w-6 text-right tabular-nums">{n}</span>
              </>
            );
            return showCrm
              ? <Link key={st} href={join("/panel/crm", `stage=${st}`)} className="flex items-center gap-2 text-sm hover:opacity-80">{row}</Link>
              : <div key={st} className="flex items-center gap-2 text-sm">{row}</div>;
          })}
        </Card>
      </div>
    </>
  );
}
