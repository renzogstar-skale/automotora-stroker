import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, CalendarCog } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { guard } from "@/lib/auth";
import { db } from "@/lib/db";
import { branchWhere, can } from "@/lib/rbac";
import { sp } from "@/lib/period";
import { addDays, dateTime, dayLabel, parseYmd, rate, startOfDay, startOfMonth, time, toLocalInput, ymd, date } from "@/lib/format";
import { APPT_STATUS, APPT_TYPE, INTEGRATION_STATUS } from "@/lib/labels";
import { apptHistory } from "@/server/appointments";
import { getGcal } from "@/server/gcal";
import { apptScope } from "@/server/metrics";
import { effectiveBranches, visibleBranches } from "@/components/filters";
import { Card, Empty, Kpi, PageHeader, StatusBadge, cx } from "@/components/ui";
import { ActionForm, InlineAction, Submit } from "@/components/client/forms";
import { ApptForm } from "./appt-form";
import { apptStatusAction, rescheduleAction } from "./actions";

type SP = Promise<Record<string, string | string[] | undefined>>;
const VIEWS = [["month", "Mes"], ["week", "Semana"], ["day", "Día"], ["agenda", "Agenda"]] as const;

export default async function Citas({ searchParams }: { searchParams: SP }) {
  const a = await guard("appointments");
  const s = await searchParams;
  const view = sp(s, "view") ?? "week";
  const ref = sp(s, "d") ? parseYmd(sp(s, "d")!) : startOfDay();
  const branches = effectiveBranches(a, s), branch = sp(s, "branch") && branches?.length === 1 ? branches[0] : undefined;
  const scope: Prisma.AppointmentWhereInput = { ...apptScope(a, branches), ...(sp(s, "seller") ? { sellerId: sp(s, "seller") } : {}) };
  const dow = (new Date(ref.getTime() + 12 * 36e5).getUTCDay() + 6) % 7;
  let from: Date, to: Date, prev: Date, next: Date;
  if (view === "month") { from = startOfMonth(ref); to = startOfMonth(ref, 1); prev = startOfMonth(ref, -1); next = to; }
  else if (view === "day") { from = startOfDay(ref); to = addDays(from, 1); prev = addDays(from, -1); next = to; }
  else if (view === "agenda") { from = startOfDay(); to = addDays(from, 30); prev = from; next = from; }
  else { from = addDays(startOfDay(ref), -dow); to = addDays(from, 7); prev = addDays(from, -7); next = to; }
  const today = startOfDay(), mStart = startOfMonth();
  const [appts, kToday, kWeek, kPending, monthRows, canceled, overdue, focus, sellers, upcoming, history, gcal] = await Promise.all([
    db.appointment.findMany({ where: { ...scope, startAt: { gte: view === "month" ? addDays(from, -7) : from, lt: view === "month" ? addDays(to, 7) : to } }, include: { contact: true, seller: true, vehicle: true }, orderBy: { startAt: "asc" } }),
    db.appointment.count({ where: { ...scope, startAt: { gte: today, lt: addDays(today, 1) }, status: { not: "CANCELADA" } } }),
    db.appointment.count({ where: { ...scope, startAt: { gte: today, lt: addDays(today, 7) }, status: { not: "CANCELADA" } } }),
    db.appointment.count({ where: { ...scope, status: { in: ["PROGRAMADA", "CONFIRMADA"] } } }),
    db.appointment.groupBy({ by: ["status"], where: { ...scope, startAt: { gte: mStart, lt: startOfMonth(new Date(), 1) } }, _count: true }),
    db.appointment.findMany({ where: { ...scope, status: "CANCELADA" }, include: { contact: true }, orderBy: { startAt: "desc" }, take: 8 }),
    db.appointment.findMany({ where: { ...scope, status: { in: ["PROGRAMADA", "CONFIRMADA"] }, endAt: { lt: new Date() } }, include: { contact: true, seller: true }, orderBy: { startAt: "asc" } }),
    sp(s, "focus") ? db.appointment.findFirst({ where: { ...scope, id: sp(s, "focus") }, include: { contact: true, seller: true, vehicle: true, opportunity: true } }) : null,
    a.role === "VENDEDOR" ? [] : db.seller.findMany({ where: { active: true, ...branchWhere(a) } }),
    db.appointment.findMany({ where: { ...scope, status: { in: ["PROGRAMADA", "CONFIRMADA"] }, startAt: { gte: new Date() } }, include: { contact: true, seller: true }, orderBy: { startAt: "asc" }, take: 6 }),
    sp(s, "focus") ? apptHistory(sp(s, "focus")!) : [],
    getGcal(),
  ]);
  const mc = Object.fromEntries(monthRows.map((r) => [r.status, r._count])) as Record<string, number>;
  const mTotal = monthRows.reduce((t, r) => t + r._count, 0);
  const cancelRate = rate(mc.CANCELADA ?? 0, mTotal);
  const href = (o: Record<string, string>) => `/panel/citas?${new URLSearchParams({ view, d: ymd(ref), ...(sp(s, "seller") ? { seller: sp(s, "seller")! } : {}), ...(branch ? { branch } : {}), ...o })}`;
  const branchOpts = await visibleBranches(a);
  const chip = (x: (typeof appts)[number]) => (
    <Link key={x.id} href={href({ focus: x.id })} className={cx("block truncate rounded px-1.5 py-0.5 text-[11px]", x.status === "CANCELADA" ? "bg-surface-2 text-muted line-through" : x.status === "COMPLETADA" ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" : "bg-sky-50 text-sky-900 dark:bg-sky-950 dark:text-sky-200")}>
      {time(x.startAt)} {APPT_TYPE[x.type]} · {x.contact?.name ?? "—"}
    </Link>
  );
  const days = view === "month"
    ? Array.from({ length: 42 }, (_, i) => addDays(addDays(from, -((new Date(from.getTime() + 12 * 36e5).getUTCDay() + 6) % 7)), i))
    : view === "week" ? Array.from({ length: 7 }, (_, i) => addDays(from, i)) : [from];
  const byDay = (d: Date) => appts.filter((x) => ymd(x.startAt) === ymd(d));
  return (
    <>
      <PageHeader title="Citas" desc="Test drive, reuniones, entregas y servicio. Se valida el cruce de horario del vendedor y del vehículo."
        actions={<><Link href="/panel/sistema/integraciones#GCAL" className="btn"><CalendarCog className="size-4" />Google Calendar</Link><Link href={href({ nueva: "1" })} className="btn btn-primary"><Plus className="size-4" />Nueva cita</Link></>} />
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Hoy" value={kToday} href="/panel/citas?view=day" />
        <Kpi label="Próximos 7 días" value={kWeek} href="/panel/citas?view=week" />
        <Kpi label="Pendientes (programadas o confirmadas)" value={kPending} sub={overdue.length ? `${overdue.length} vencidas sin cerrar` : undefined} href="/panel/citas?view=agenda" />
        <Kpi label="Completadas este mes" value={mc.COMPLETADA ?? 0} />
        <Kpi label="Canceladas este mes" value={mc.CANCELADA ?? 0} />
        <Kpi label="Tasa de cancelación del mes" value={cancelRate.text} sub={`${cancelRate.detail} citas del mes`} />
      </div>
      {(sp(s, "nueva") || sp(s, "opp")) && <Card title="Nueva cita" className="mb-4"><ApptForm a={a} oppId={sp(s, "opp")} /></Card>}
      {focus && (
        <Card title={`${APPT_TYPE[focus.type]} · ${dateTime(focus.startAt)}`} className="mb-4" action={<Link href={href({})} className="text-xs link">Cerrar</Link>}>
          <div className="flex flex-wrap items-start gap-6 text-sm">
            <div className="space-y-1">
              <p><StatusBadge map={APPT_STATUS} value={focus.status} /> {focus.rescheduled > 0 && <span className="text-xs text-muted">Reagendada {focus.rescheduled} vez/veces</span>}</p>
              <p>Cliente: {focus.opportunity ? <Link className="link" href={`/panel/crm/${focus.opportunityId}`}>{focus.contact?.name}</Link> : focus.contact?.name ?? "—"}</p>
              <p>Vendedor: {focus.seller?.name ?? "—"} · Vehículo: {focus.vehicle ? `${focus.vehicle.brand} ${focus.vehicle.model} ${focus.vehicle.plate}` : "—"}</p>
              {focus.notes && <p className="text-muted">{focus.notes}</p>}
              {focus.cancelReason && <p className="text-muted">Motivo: {focus.cancelReason}</p>}
            </div>
            {history.length > 0 && (
              <div className="min-w-56 text-xs">
                <p className="mb-1 font-medium">Historial</p>
                <ol className="space-y-1 border-l border-line pl-3">{history.map((h) => <li key={h.id}><span className="text-muted tabular-nums">{dateTime(h.createdAt)}</span> · {h.summary} <span className="text-muted">({h.actorName})</span></li>)}</ol>
              </div>
            )}
            {["PROGRAMADA", "CONFIRMADA"].includes(focus.status) && (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-2">
                  {focus.status === "PROGRAMADA" && <InlineAction action={apptStatusAction} fields={{ id: focus.id, act: "confirm" }} label="Confirmar" />}
                  <InlineAction action={apptStatusAction} fields={{ id: focus.id, act: "complete" }} label="Marcar completada" className="btn btn-sm btn-dark" />
                </div>
                <InlineAction action={apptStatusAction} fields={{ id: focus.id, act: "cancel" }} label="Cancelar cita" reasonLabel="Motivo de cancelación" className="btn btn-sm btn-danger" />
                <ActionForm action={rescheduleAction} className="flex flex-wrap items-center gap-2 space-y-0">
                  <input type="hidden" name="id" value={focus.id} />
                  <input type="datetime-local" name="startAt" required defaultValue={toLocalInput(focus.startAt)} className="input h-8 w-52 text-xs" aria-label="Nueva fecha" />
                  <Submit className="btn btn-sm">Reagendar</Submit>
                </ActionForm>
              </div>
            )}
          </div>
        </Card>
      )}
      <div className="grid gap-4 xl:grid-cols-4">
        <Card className="xl:col-span-3" bodyClass="p-3"
          title={<div className="flex items-center gap-2">
            {view !== "agenda" && <Link href={href({ d: ymd(prev) })} className="btn btn-ghost btn-sm" aria-label="Anterior"><ChevronLeft className="size-4" /></Link>}
            <span className="capitalize">{view === "month" ? new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric", timeZone: "America/Santiago" }).format(addDays(from, 1)) : view === "agenda" ? "Próximos 30 días" : `${date(from)}${view === "week" ? ` – ${date(addDays(to, -1))}` : ""}`}</span>
            {view !== "agenda" && <Link href={href({ d: ymd(next) })} className="btn btn-ghost btn-sm" aria-label="Siguiente"><ChevronRight className="size-4" /></Link>}
            <Link href={href({ d: ymd(new Date()) })} className="btn btn-sm">Hoy</Link>
          </div>}
          action={<div className="flex flex-wrap gap-1">
            {(sellers.length > 0 || branchOpts.length > 1) && <form className="flex gap-1"><input type="hidden" name="view" value={view} />{branchOpts.length > 1 && <select name="branch" defaultValue={branch ?? ""} className="input h-8 w-36 text-xs" aria-label="Sucursal"><option value="">Todas mis sucursales</option>{branchOpts.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}{sellers.length > 0 && <select name="seller" defaultValue={sp(s, "seller") ?? ""} className="input h-8 w-36 text-xs" aria-label="Vendedor"><option value="">Todos</option>{sellers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}<button className="btn btn-sm ml-1">Ver</button></form>}
            {VIEWS.map(([k, l]) => <Link key={k} href={`/panel/citas?view=${k}&d=${ymd(ref)}`} className={cx("btn btn-sm", view === k && "btn-dark")}>{l}</Link>)}
          </div>}>
          {view === "month" && (
            <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg bg-line text-xs">
              {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => <div key={d} className="bg-surface-2 px-2 py-1 font-medium text-muted">{d}</div>)}
              {days.map((d) => {
                const list = byDay(d), out = d < from || d >= to, isToday = ymd(d) === ymd(new Date());
                return (
                  <div key={d.toISOString()} className={cx("min-h-20 space-y-0.5 bg-surface p-1 sm:min-h-24", out && "opacity-45")}>
                    <Link href={`/panel/citas?view=day&d=${ymd(d)}`} className={cx("inline-grid size-5 place-items-center rounded-full text-[11px]", isToday && "bg-accent text-white")}>{+ymd(d).slice(8)}</Link>
                    <div className="hidden space-y-0.5 sm:block">{list.slice(0, 3).map(chip)}{list.length > 3 && <p className="text-[11px] text-muted">+{list.length - 3} más</p>}</div>
                    {list.length > 0 && <p className="text-[11px] text-accent sm:hidden">{list.length} cita(s)</p>}
                  </div>
                );
              })}
            </div>
          )}
          {view === "week" && (
            <div className="grid gap-2 md:grid-cols-7">
              {days.map((d) => (
                <div key={d.toISOString()} className="min-w-0 rounded-lg border border-line p-1.5">
                  <Link href={`/panel/citas?view=day&d=${ymd(d)}`} className={cx("mb-1 block text-xs font-medium capitalize", ymd(d) === ymd(new Date()) && "text-accent")}>{dayLabel(d)}</Link>
                  <div className="space-y-1">{byDay(d).map(chip)}{byDay(d).length === 0 && <p className="text-[11px] text-muted">—</p>}</div>
                </div>
              ))}
            </div>
          )}
          {(view === "day" || view === "agenda") && (
            appts.length === 0 ? <Empty title="Sin citas" action={<Link href={href({ nueva: "1" })} className="btn btn-sm">Agendar</Link>} /> : (
              <ul className="divide-y divide-line">
                {appts.map((x) => (
                  <li key={x.id}><Link href={href({ focus: x.id })} className="flex flex-wrap items-center gap-3 px-1 py-2 text-sm hover:bg-surface-2">
                    <span className="w-32 shrink-0 tabular-nums text-muted">{view === "agenda" ? dateTime(x.startAt) : `${time(x.startAt)}–${time(x.endAt)}`}</span>
                    <span className="min-w-0 flex-1"><b className="font-medium">{APPT_TYPE[x.type]}</b> · {x.contact?.name ?? "—"} {x.vehicle && <span className="text-muted">· {x.vehicle.brand} {x.vehicle.model}</span>}</span>
                    <span className="text-xs text-muted">{x.seller?.name}</span><StatusBadge map={APPT_STATUS} value={x.status} />
                  </Link></li>))}
              </ul>)
          )}
        </Card>
        <div className="space-y-4">
          <Card title="Próximas citas" bodyClass="p-0">
            {upcoming.length === 0 ? <Empty compact title="Sin citas próximas" /> : <ul>{upcoming.map((x) => <li key={x.id} className="border-b border-line px-4 py-2 text-sm last:border-0"><Link className="link" href={href({ focus: x.id })}>{APPT_TYPE[x.type]} · {x.contact?.name ?? "—"}</Link><div className="text-xs text-muted">{dateTime(x.startAt)} · {x.seller?.name ?? "Sin vendedor"}</div></li>)}</ul>}
          </Card>
          <Card title={`Vencidas sin cerrar (${overdue.length})`} bodyClass="p-0">
            {overdue.length === 0 ? <Empty compact title="Ninguna" /> : <ul>{overdue.slice(0, 8).map((x) => <li key={x.id} className="border-b border-line px-4 py-2 text-sm last:border-0"><Link className="link" href={href({ focus: x.id })}>{x.contact?.name ?? "—"}</Link><div className="text-xs text-muted">{dateTime(x.startAt)} · {x.seller?.name}</div></li>)}</ul>}
          </Card>
          <Card title="Historial de canceladas" bodyClass="p-0">
            {canceled.length === 0 ? <Empty compact title="Sin cancelaciones" /> : <ul>{canceled.map((x) => <li key={x.id} className="border-b border-line px-4 py-2 text-sm last:border-0">{x.contact?.name ?? "—"} · {date(x.startAt)}<div className="text-xs text-muted">{x.cancelReason}</div></li>)}</ul>}
          </Card>
          {can(a, "integrations") && <Card title="Google Calendar"><p className="text-sm text-muted">Sincroniza las citas con el calendario de cada vendedor. Estado: <b>{INTEGRATION_STATUS[gcal.status]?.[0] ?? gcal.status}</b>{gcal.config.enabled && ` · ${Object.values(gcal.config.calendars).filter(Boolean).length} calendario(s) mapeados`}.</p><Link href="/panel/sistema/integraciones#GCAL" className="btn btn-sm mt-2">Configurar</Link></Card>}
        </div>
      </div>
    </>
  );
}
