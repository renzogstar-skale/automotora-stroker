import Link from "next/link";
import { guard } from "@/lib/auth";
import { db } from "@/lib/db";
import { branchScope } from "@/lib/rbac";
import { sp } from "@/lib/period";
import { ago } from "@/lib/format";
import { teamToday } from "@/server/team";
import { Badge, Card, Empty, Field, Kpi, PageHeader, Table, cx } from "@/components/ui";
import { ActionForm, Submit } from "@/components/client/forms";
import { teamAlertsAction } from "./actions";

export const metadata = { title: "Hoy del equipo" };
type SP = Promise<Record<string, string | string[] | undefined>>;
const REPORT: Record<string, [string, "green" | "amber" | "gray"]> = { ENVIADO: ["Enviado", "green"], BORRADOR: ["Borrador", "amber"], PENDIENTE: ["Pendiente", "gray"] };
const n = (v: number, tone?: "red") => <span className={cx("tabular-nums", v > 0 && tone === "red" && "font-semibold text-red-700 dark:text-red-400", v === 0 && "text-muted")}>{v}</span>;

export default async function Equipo({ searchParams }: { searchParams: SP }) {
  const a = await guard("team");
  const s = await searchParams;
  const b = branchScope(a);
  const [branches, { rows, alerts, cfg }] = await Promise.all([
    db.branch.findMany({ where: b ? { id: { in: b } } : {}, orderBy: { name: "asc" } }),
    teamToday(a, sp(s, "branch")),
  ]);
  const sum = (k: "leadsToday" | "leads7" | "followOverdue" | "tasksOverdue" | "apptOverdue") => rows.reduce((t, r) => t + r[k], 0);
  return (
    <>
      <PageHeader title="Hoy del equipo" desc="Conexión, leads, citas, seguimientos, tareas e informe diario por vendedor."
        actions={branches.length > 1 && (
          <form className="flex gap-1"><select name="branch" defaultValue={sp(s, "branch") ?? ""} className="input h-9 w-44" aria-label="Sucursal"><option value="">Todas las sucursales</option>{branches.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select><button className="btn">Ver</button></form>
        )} />
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Kpi label="Leads hoy" value={sum("leadsToday")} href="/panel/leads" />
        <Kpi label="Leads últimos 7 días" value={sum("leads7")} />
        <Kpi label="Seguimientos vencidos" value={sum("followOverdue")} />
        <Kpi label="Tareas vencidas" value={sum("tasksOverdue")} href="/panel/tareas?tab=vencidas" />
        <Kpi label="Citas sin cerrar" value={sum("apptOverdue")} href="/panel/citas?view=agenda" />
      </div>
      <div className="grid gap-4 xl:grid-cols-4">
        <Card className="xl:col-span-3" title={`Vendedores (${rows.length})`} bodyClass="p-0">
          {rows.length === 0 ? <Empty title="Sin vendedores activos" /> : (
            <Table>
              <thead><tr><th>Vendedor</th><th>Última conexión</th><th className="text-right">Leads hoy</th><th className="text-right">7 días</th><th className="text-right">Citas hoy</th><th className="text-right">Citas vencidas</th><th className="text-right">Seguim. vencidos</th><th className="text-right">Seguim. 7 días</th><th className="text-right">Tareas (vencidas)</th><th>Informe</th><th /></tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.seller.id} data-seller={r.seller.id}>
                  <td><span className="font-medium">{r.seller.name}</span><div className="text-xs text-muted">{r.branch.name}</div></td>
                  <td className="whitespace-nowrap">{!r.hasAccount ? <span className="text-xs text-muted">Sin cuenta</span> : r.lastSeen ? <span className={r.inactive ? "text-red-700 dark:text-red-400" : ""}>{ago(r.lastSeen)}</span> : <Badge tone="red">Nunca</Badge>}</td>
                  <td className="text-right">{n(r.leadsToday)}</td>
                  <td className="text-right">{n(r.leads7)}</td>
                  <td className="text-right">{n(r.apptToday)}</td>
                  <td className="text-right"><Link href={`/panel/citas?view=agenda&seller=${r.seller.id}`}>{n(r.apptOverdue, "red")}</Link></td>
                  <td className="text-right"><Link href={r.crmHref}>{n(r.followOverdue, "red")}</Link></td>
                  <td className="text-right" data-k="followNext">{n(r.followNext)}</td>
                  <td className="text-right" data-k="tasks">{r.hasAccount ? <Link href={`/panel/tareas?user=${r.seller.userId}`}>{n(r.tasksPending)} ({n(r.tasksOverdue, "red")})</Link> : "—"}</td>
                  <td>{r.hasAccount ? <Link href={`/panel/informe-diario?seller=${r.seller.id}`}><Badge tone={REPORT[r.report]?.[1] ?? "gray"}>{REPORT[r.report]?.[0] ?? r.report}</Badge></Link> : "—"}</td>
                  <td><Link className="btn btn-sm whitespace-nowrap" href={r.crmHref}>Ver en CRM</Link></td>
                </tr>
              ))}</tbody>
            </Table>
          )}
        </Card>
        <div className="space-y-4">
          <Card title={`Alertas (${alerts.length})`} bodyClass="p-0">
            {alerts.length === 0 ? <Empty compact title="Sin alertas" /> : <ul>{alerts.map((x, i) => (
              <li key={i} className="border-b border-line px-4 py-2 text-sm last:border-0">
                <Link href={x.href} className="hover:underline"><Badge tone={x.tone}>{x.kind}</Badge> {x.seller}</Link>
                <div className="text-xs text-muted">{x.detail}</div>
              </li>))}</ul>}
          </Card>
          <Card title="Configurar alertas">
            <ActionForm action={teamAlertsAction} className="grid grid-cols-2 gap-2 space-y-0">
              <Field label="Inactividad (horas)" className="col-span-2"><input type="number" name="inactivityHours" min={1} defaultValue={cfg.inactivityHours} className="input" /></Field>
              <Field label="Máx. seguim. vencidos"><input type="number" name="overdueFollowUpsMax" min={0} defaultValue={cfg.overdueFollowUpsMax} className="input" /></Field>
              <Field label="Máx. tareas vencidas"><input type="number" name="overdueTasksMax" min={0} defaultValue={cfg.overdueTasksMax} className="input" /></Field>
              <Field label="Cierre informe (hora)"><input type="number" name="reportDueHour" min={0} max={23} defaultValue={cfg.reportDueHour} className="input" /></Field>
              <Field label="Seguimiento post cita (h)"><input type="number" name="followUpAfterApptHours" min={1} defaultValue={cfg.followUpAfterApptHours} className="input" /></Field>
              <div className="col-span-2 flex justify-end pt-2"><Submit className="btn btn-sm btn-dark">Guardar</Submit></div>
            </ActionForm>
          </Card>
        </div>
      </div>
    </>
  );
}
