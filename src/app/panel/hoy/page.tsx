import Link from "next/link";
import { guard } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, oppScope, branchWhere } from "@/lib/rbac";
import { ACTIVE_STAGES, APPT_TYPE, STAGE_LABEL } from "@/lib/labels";
import { addDays, dateTime, nowMs, startOfDay, time, toLocalInput } from "@/lib/format";
import type { Stage } from "@prisma/client";
import { Badge, Card, Empty, Field, PageHeader } from "@/components/ui";
import { ActionForm, InlineAction, Submit } from "@/components/client/forms";
import { doneTaskAction, taskAction } from "../crm/actions";

/** Vista móvil prioritaria: lo que el usuario debe hacer hoy. */
export default async function Today() {
  const a = await guard();
  if (!can(a, "crm")) return <Card><Empty title="Sin agenda comercial" text="Tu rol no gestiona oportunidades." action={can(a, "albums") ? <Link className="btn" href="/panel/albumes">Ir a Álbumes</Link> : <Link className="btn" href="/panel">Ir al inicio</Link>} /></Card>;
  const d0 = startOfDay(), d1 = addDays(d0, 1);
  const [follow, appts, tasks, fresh] = await Promise.all([
    db.opportunity.findMany({ where: { ...oppScope(a), deletedAt: null, stage: { in: ACTIVE_STAGES as Stage[] }, nextFollowUpAt: { lt: d1 } }, include: { contact: true }, orderBy: { nextFollowUpAt: "asc" }, take: 30 }),
    db.appointment.findMany({ where: { ...branchWhere(a), ...(a.role === "VENDEDOR" ? { sellerId: a.sellerId ?? "-" } : {}), startAt: { gte: d0, lt: d1 }, status: { not: "CANCELADA" } }, include: { contact: true, vehicle: true }, orderBy: { startAt: "asc" } }),
    db.task.findMany({ where: { assignedToId: a.id, doneAt: null }, include: { opportunity: { include: { contact: true } } }, orderBy: { dueAt: "asc" } }),
    db.opportunity.findMany({ where: { ...oppScope(a), deletedAt: null, stage: "NUEVO" }, include: { contact: true }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  const now = nowMs();
  return (
    <>
      <PageHeader title={`Hola, ${a.name.split(" ")[0]}`} desc="Tu día: citas, seguimientos, leads nuevos y tareas." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={`Citas de hoy (${appts.length})`} bodyClass="p-0" action={<Link className="text-xs link" href="/panel/citas?view=day">Agenda</Link>}>
          {appts.length === 0 ? <Empty compact title="Sin citas hoy" /> : <ul>{appts.map((x) => <li key={x.id}><Link href={`/panel/citas?view=day&focus=${x.id}`} className="flex gap-3 border-b border-line px-4 py-2.5 text-sm last:border-0 hover:bg-surface-2"><span className="w-12 font-semibold tabular-nums">{time(x.startAt)}</span><span>{APPT_TYPE[x.type]} · {x.contact?.name}{x.vehicle && <span className="text-muted"> · {x.vehicle.brand} {x.vehicle.model}</span>}</span></Link></li>)}</ul>}
        </Card>
        <Card title={`Seguimientos para hoy o vencidos (${follow.length})`} bodyClass="p-0">
          {follow.length === 0 ? <Empty compact title="Al día" /> : <ul>{follow.map((o) => <li key={o.id}><Link href={`/panel/crm/${o.id}`} className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5 text-sm last:border-0 hover:bg-surface-2"><span>{o.contact.name} <span className="text-xs text-muted">· {STAGE_LABEL[o.stage]}</span></span>{o.nextFollowUpAt!.getTime() < now ? <Badge tone="red">Vencido</Badge> : <Badge tone="blue">{time(o.nextFollowUpAt!)}</Badge>}</Link></li>)}</ul>}
        </Card>
        <Card title={`Leads nuevos sin gestionar (${fresh.length})`} bodyClass="p-0">
          {fresh.length === 0 ? <Empty compact title="Ninguno" /> : <ul>{fresh.map((o) => <li key={o.id}><Link href={`/panel/crm/${o.id}`} className="block border-b border-line px-4 py-2.5 text-sm last:border-0 hover:bg-surface-2">{o.contact.name} <span className="text-xs text-muted">· {o.contact.phone} · {dateTime(o.createdAt)}</span></Link></li>)}</ul>}
        </Card>
        <Card title={`Tareas (${tasks.length})`} action={<Link className="text-xs link" href="/panel/tareas">Ver todas</Link>}>
          <div id="tareas" />
          <ul className="mb-3 space-y-1.5">{tasks.map((t) => <li key={t.id} className="flex items-center justify-between gap-2 text-sm"><span>{t.title}{t.opportunity && <span className="text-xs text-muted"> · {t.opportunity.contact.name}</span>} <span className={`text-xs ${t.dueAt.getTime() < now ? "text-red-700 dark:text-red-400" : "text-muted"}`}>{dateTime(t.dueAt)}</span></span><InlineAction action={doneTaskAction} fields={{ id: t.id }} label="Hecha" /></li>)}</ul>
          <ActionForm action={taskAction} resetOnOk className="grid grid-cols-3 gap-2 space-y-0">
            <Field label="Nueva tarea" className="col-span-2"><input name="title" required className="input" /></Field>
            <Field label="Para"><input type="datetime-local" name="dueAt" defaultValue={toLocalInput(addDays(new Date(), 0))} className="input" /></Field>
            <div className="col-span-3 flex justify-end"><Submit className="btn btn-sm btn-dark">Agregar</Submit></div>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
