"use server";
import { revalidatePath } from "next/cache";
import { guard } from "@/lib/auth";
import { run, opt, str, type ActionState } from "@/lib/action";
import { fromLocalInput } from "@/lib/format";
import { createTask, setTaskDone } from "@/server/tasks";

const refresh = () => { for (const p of ["/panel/tareas", "/panel/hoy", "/panel/equipo"]) revalidatePath(p); };

export async function createTaskAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("crm");
  return run(async () => {
    await createTask({ title: str(fd, "title"), dueAt: fromLocalInput(str(fd, "dueAt")), assignedToId: opt(fd, "assignedToId"), opportunityId: opt(fd, "opportunityId") }, a);
    refresh();
  }, "Tarea creada.");
}
export async function toggleTaskAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("crm");
  const done = str(fd, "done") === "1";
  return run(async () => { await setTaskDone(str(fd, "id"), done, a); refresh(); }, done ? "Hecha." : "Reabierta.");
}
