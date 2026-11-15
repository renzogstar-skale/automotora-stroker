import Link from "next/link";
import { guard } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, oppScope } from "@/lib/rbac";
import { sp } from "@/lib/period";
import { addDays, dateTime, startOfDay, toLocalInput } from "@/lib/format";
import { assignableUsers, taskScope } from "@/server/tasks";
import { Badge, Card, Empty, Field, Kpi, PageHeader, Table, Tabs } from "@/components/ui";
import { ActionForm, InlineAction, Submit } from "@/components/client/forms";
import { createTaskAction, toggleTaskAction } from "./actions";

export const metadata = { title: "Tareas" };
type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function Tareas({ searchParams }: { searchParams: SP }) {
  const a = await guard("crm");
  const s = await searchParams;
  const sup = can(a, "team");
  const all = sup && sp(s, "scope") !== "mine";
  const tab = sp(s, "tab") ?? "pendientes";
  const user = all ? sp(s, "user") : undefined;
  const base = { ...taskScope(a, all), ...(user ? { assignedToId: user } : {}) };
  const now = new Date(), d1 = addDays(startOfDay(), 1);
  const where = tab === "hechas" ? { ...base, doneAt: { not: null } } : tab === "vencidas" ? { ...base, doneAt: null, dueAt: { lt: now } } : { ...base, doneAt: null };
  const [tasks, nPend, nOver, nToday, users, opps] = await Promise.all([
    db.task.findMany({ where, include: { assignedTo: true, opportunity: { include: { contact: true } } }, orderBy: tab === "hechas" ? { doneAt: "desc" } : { dueAt: "asc" }, take: 200 }),
    db.task.count({ where: { ...base, doneAt: null } }),
    db.task.count({ where: { ...base, doneAt: null, dueAt: { lt: now } } }),
    db.task.count({ where: { ...base, doneAt: null, dueAt: { lt: d1 } } }),
    assignableUsers(a),
    db.opportunity.findMany({ where: { ...oppScope(a), deletedAt: null, closedAt: null }, include: { contact: true }, orderBy: { createdAt: "desc" }, take: 200 }),
  ]);
  const href = (o: Record<string, string | undefined>) =>
    `/panel/tareas?${new URLSearchParams(Object.entries({ tab, scope: sp(s, "scope"), user, ...o }).filter(([, v]) => v) as [string, string][])}`;
  const tabs: [string, string, number?][] = [["pendientes", "Pendientes", nPend], ["vencidas", "Vencidas", nOver], ["hechas", "Hechas"]];
  return (
    <>
      <PageHeader title="Tareas" desc={sup ? "Tareas del equipo: asigna, vincula a un lead y controla vencimientos." : "Tus pendientes, vinculados a tus leads."} />
      <div className="mb-4 grid grid-cols-3 gap-2">
        <Kpi label="Pendientes" value={nPend} href={href({ tab: "pendientes" })} />
        <Kpi label="Para hoy o antes" value={nToday} />
        <Kpi label="Vencidas" value={nOver} href={href({ tab: "vencidas" })} />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <Tabs items={tabs.map(([k, l, n]) => ({ href: href({ tab: k }), label: l, count: n, active: tab === k }))} />
          <Card bodyClass="p-0" title={all ? "Equipo" : "Mis tareas"}
            action={sup && (
              <form className="flex gap-1">
                <input type="hidden" name="tab" value={tab} />
                <select name="scope" defaultValue={all ? "" : "mine"} className="input h-8 w-28 text-xs" aria-label="Alcance"><option value="">Equipo</option><option value="mine">Mías</option></select>
                <select name="user" defaultValue={user ?? ""} className="input h-8 w-36 text-xs" aria-label="Responsable"><option value="">Todos</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
                <button className="btn btn-sm">Ver</button>
              </form>
            )}>
            {tasks.length === 0 ? <Empty compact title={tab === "hechas" ? "Sin tareas hechas" : "Sin tareas pendientes"} /> : (
              <Table>
                <thead><tr><th>Tarea</th><th>Lead</th>{all && <th>Responsable</th>}<th>Vence</th><th /></tr></thead>
                <tbody>{tasks.map((t) => (
                  <tr key={t.id}>
                    <td className={t.doneAt ? "text-muted line-through" : ""}>{t.title}</td>
                    <td>{t.opportunity ? <Link className="link" href={`/panel/crm/${t.opportunityId}`}>{t.opportunity.contact.name}</Link> : "—"}</td>
                    {all && <td>{t.assignedTo.name}</td>}
                    <td className="whitespace-nowrap tabular-nums">{dateTime(t.dueAt)} {!t.doneAt && t.dueAt < now && <Badge tone="red">Vencida</Badge>}</td>
                    <td className="text-right"><InlineAction action={toggleTaskAction} fields={{ id: t.id, done: t.doneAt ? "0" : "1" }} label={t.doneAt ? "Reabrir" : "Hecha"} /></td>
                  </tr>
                ))}</tbody>
              </Table>
            )}
          </Card>
        </div>
        <Card title="Nueva tarea">
          <ActionForm action={createTaskAction} resetOnOk>
            <Field label="Tarea"><input name="title" required className="input" /></Field>
            <Field label="Vence"><input type="datetime-local" name="dueAt" required defaultValue={toLocalInput(addDays(now, 1))} className="input" /></Field>
            {sup && <Field label="Responsable"><select name="assignedToId" defaultValue={a.id} className="input">{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>}
            <Field label="Lead (opcional)"><select name="opportunityId" defaultValue={sp(s, "opp") ?? ""} className="input"><option value="">— Sin vincular —</option>{opps.map((o) => <option key={o.id} value={o.id}>{o.contact.name}</option>)}</select></Field>
            <div className="flex justify-end"><Submit>Crear tarea</Submit></div>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
