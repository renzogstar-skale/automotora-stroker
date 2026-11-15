import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { branchScope, can, type Actor } from "@/lib/rbac";
import { AppError, notFound } from "./errors";
import { getOppForActor } from "./crm";

/** Tareas visibles: las propias; quien supervisa equipo ve las de los usuarios de sus sucursales. */
export function taskScope(a: Actor, all = false): Prisma.TaskWhereInput {
  if (!all || !can(a, "team")) return { assignedToId: a.id };
  const b = branchScope(a);
  return b ? { assignedTo: { branches: { some: { branchId: { in: b } } } } } : {};
}

/** Usuarios a los que el actor puede asignar tareas. */
export function assignableUsers(a: Actor) {
  if (!can(a, "team")) return db.user.findMany({ where: { id: a.id } });
  const b = branchScope(a);
  return db.user.findMany({ where: { active: true, role: { in: ["VENDEDOR", "GERENCIA", "ADMIN"] }, ...(b ? { branches: { some: { branchId: { in: b } } } } : {}) }, orderBy: { name: "asc" } });
}

export async function createTask(i: { title: string; dueAt: Date; assignedToId?: string | null; opportunityId?: string | null }, a: Actor) {
  if (!i.title.trim()) throw new AppError("Escribe la tarea.");
  if (isNaN(i.dueAt.getTime())) throw new AppError("Fecha de vencimiento inválida.");
  const to = i.assignedToId || a.id;
  if (to !== a.id && !(await assignableUsers(a)).some((u) => u.id === to)) throw new AppError("No puedes asignar tareas a ese usuario.", 403, "forbidden");
  if (i.opportunityId) await getOppForActor(i.opportunityId, a);
  const t = await db.task.create({ data: { title: i.title.trim(), dueAt: i.dueAt, assignedToId: to, opportunityId: i.opportunityId || null } });
  if (to !== a.id) await audit(a, "task.assign", "Task", t.id, `Tarea asignada: ${t.title}`);
  return t;
}

export async function setTaskDone(id: string, done: boolean, a: Actor) {
  const t = await db.task.findFirst({ where: { id, ...taskScope(a, true) } });
  if (!t) throw notFound("Tarea no encontrada.");
  await db.task.update({ where: { id }, data: { doneAt: done ? new Date() : null } });
}
