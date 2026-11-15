import type { Stage } from "@prisma/client";
import { db } from "@/lib/db";
import { ACTIVE_STAGES } from "@/lib/labels";
import { addDays, sclParts, startOfDay, ymd } from "@/lib/format";
import { branchScope, type Actor } from "@/lib/rbac";
import { getSetting } from "./settings";

export type TeamAlert = { sellerId: string; seller: string; branchId: string; kind: string; detail: string; href: string; tone: "red" | "amber" };

const count = <K extends string>(rows: { _count: number }[], key: K) =>
  Object.fromEntries((rows as unknown as (Record<K, string | null> & { _count: number })[]).map((r) => [r[key] ?? "", r._count])) as Record<string, number>;

/** Estado del equipo comercial hoy, por vendedor activo de las sucursales visibles. */
export async function teamToday(actor: Actor, branchId?: string) {
  const cfg = await getSetting("team");
  const b = branchScope(actor);
  const branches = branchId ? (b && !b.includes(branchId) ? [] : [branchId]) : b;
  const bw = branches ? { branchId: { in: branches } } : {};
  const now = new Date(), d0 = startOfDay(), d7 = addDays(d0, -6), in7 = addDays(now, 7);
  const sellers = await db.seller.findMany({ where: { active: true, ...bw }, include: { user: true, branch: true }, orderBy: [{ branchId: "asc" }, { name: "asc" }] });
  const ids = sellers.map((s) => s.id), userIds = sellers.flatMap((s) => (s.userId ? [s.userId] : []));
  const activeOpp = { sellerId: { in: ids }, deletedAt: null, stage: { in: ACTIVE_STAGES as Stage[] } };
  const [lToday, l7, apptOver, apptToday, fuOver, fuNext, tPend, tOver, lastAct, reports] = await Promise.all([
    db.opportunity.groupBy({ by: ["sellerId"], where: { sellerId: { in: ids }, deletedAt: null, createdAt: { gte: d0 } }, _count: true }),
    db.opportunity.groupBy({ by: ["sellerId"], where: { sellerId: { in: ids }, deletedAt: null, createdAt: { gte: d7 } }, _count: true }),
    db.appointment.groupBy({ by: ["sellerId"], where: { sellerId: { in: ids }, status: { in: ["PROGRAMADA", "CONFIRMADA"] }, endAt: { lt: now } }, _count: true }),
    db.appointment.groupBy({ by: ["sellerId"], where: { sellerId: { in: ids }, status: { not: "CANCELADA" }, startAt: { gte: d0, lt: addDays(d0, 1) } }, _count: true }),
    db.opportunity.groupBy({ by: ["sellerId"], where: { ...activeOpp, nextFollowUpAt: { lt: now } }, _count: true }),
    db.opportunity.groupBy({ by: ["sellerId"], where: { ...activeOpp, nextFollowUpAt: { gte: now, lt: in7 } }, _count: true }),
    db.task.groupBy({ by: ["assignedToId"], where: { assignedToId: { in: userIds }, doneAt: null }, _count: true }),
    db.task.groupBy({ by: ["assignedToId"], where: { assignedToId: { in: userIds }, doneAt: null, dueAt: { lt: now } }, _count: true }),
    db.activity.groupBy({ by: ["userId"], where: { userId: { in: userIds } }, _max: { createdAt: true } }),
    db.dailyReport.findMany({ where: { sellerId: { in: ids }, date: new Date(`${ymd(now)}T00:00:00Z`) } }),
  ]);
  const c = {
    lToday: count(lToday, "sellerId"), l7: count(l7, "sellerId"), apptOver: count(apptOver, "sellerId"), apptToday: count(apptToday, "sellerId"),
    fuOver: count(fuOver, "sellerId"), fuNext: count(fuNext, "sellerId"), tPend: count(tPend, "assignedToId"), tOver: count(tOver, "assignedToId"),
  };
  const lastActBy = Object.fromEntries(lastAct.map((r) => [r.userId ?? "", r._max.createdAt]));
  const reportBy = Object.fromEntries(reports.map((r) => [r.sellerId, r.status]));
  const pastDue = sclParts(now).h >= cfg.reportDueHour;
  const alerts: TeamAlert[] = [];
  const rows = sellers.map((s) => {
    const seen = s.user?.lastSeenAt ?? null, act = s.userId ? lastActBy[s.userId] ?? null : null;
    const last = [seen, act].filter(Boolean).sort((x, y) => y!.getTime() - x!.getTime())[0] ?? null;
    const r = {
      seller: s, branch: s.branch, hasAccount: !!s.userId, lastSeen: seen, lastActivity: act,
      inactive: !!s.userId && (!last || now.getTime() - last.getTime() > cfg.inactivityHours * 3600e3),
      leadsToday: c.lToday[s.id] ?? 0, leads7: c.l7[s.id] ?? 0, apptToday: c.apptToday[s.id] ?? 0, apptOverdue: c.apptOver[s.id] ?? 0,
      followOverdue: c.fuOver[s.id] ?? 0, followNext: c.fuNext[s.id] ?? 0,
      tasksPending: s.userId ? c.tPend[s.userId] ?? 0 : 0, tasksOverdue: s.userId ? c.tOver[s.userId] ?? 0 : 0,
      report: (reportBy[s.id] ?? "PENDIENTE") as string,
      crmHref: `/panel/crm?scope=all&seller=${s.id}`,
    };
    const push = (kind: string, detail: string, href: string, tone: "red" | "amber" = "amber") => alerts.push({ sellerId: s.id, seller: s.name, branchId: s.branchId, kind, detail, href, tone });
    if (r.inactive) push("Inactividad", last ? `Sin conexión ni actividad en más de ${cfg.inactivityHours} h` : "Nunca se ha conectado", r.crmHref, "red");
    if (r.followOverdue > cfg.overdueFollowUpsMax) push("Seguimientos vencidos", `${r.followOverdue} vencidos (máx. ${cfg.overdueFollowUpsMax})`, r.crmHref, "red");
    if (r.tasksOverdue > cfg.overdueTasksMax) push("Tareas vencidas", `${r.tasksOverdue} vencidas (máx. ${cfg.overdueTasksMax})`, `/panel/tareas?tab=vencidas&user=${s.userId}`);
    if (r.apptOverdue > 0) push("Citas sin cerrar", `${r.apptOverdue} cita(s) pasada(s) sin completar ni cancelar`, `/panel/citas?view=agenda&seller=${s.id}`);
    if (s.userId && pastDue && r.report !== "ENVIADO") push("Informe diario", `Sin enviar después de las ${cfg.reportDueHour}:00`, `/panel/informe-diario?seller=${s.id}`);
    return r;
  });
  return { rows, alerts, cfg };
}
export type TeamRow = Awaited<ReturnType<typeof teamToday>>["rows"][number];
