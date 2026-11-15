"use server";
import { revalidatePath } from "next/cache";
import { guard } from "@/lib/auth";
import { run, str, opt, int, type ActionState } from "@/lib/action";
import { dateTime, fromLocalInput } from "@/lib/format";
import { createAppointment, rescheduleAppointment, setAppointmentStatus } from "@/server/appointments";

export async function createApptAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("appointments");
  return run(async () => {
    await createAppointment({
      type: str(fd, "type") as "TEST_DRIVE", startAt: fromLocalInput(str(fd, "startAt")), durationMin: int(fd, "duration") || 60, branchId: str(fd, "branchId"),
      sellerId: opt(fd, "sellerId"), vehicleId: opt(fd, "vehicleId"), opportunityId: opt(fd, "opportunityId"), notes: opt(fd, "notes"),
    }, a);
    refresh();
  }, "Cita creada.");
}
const refresh = () => { for (const p of ["/panel/citas", "/panel/hoy", "/panel/equipo", "/panel/tareas", "/panel/crm/[id]"]) revalidatePath(p, p.includes("[") ? "page" : undefined); };

export async function apptStatusAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("appointments");
  const act = str(fd, "act") as "confirm" | "complete" | "cancel";
  let msg = act === "cancel" ? "Cita cancelada." : act === "confirm" ? "Cita confirmada." : "Cita completada.";
  const r = await run(async () => {
    const res = await setAppointmentStatus(str(fd, "id"), act, a, opt(fd, "reason") ?? undefined);
    if (res.followAt) msg = `Cita completada. Seguimiento agendado para ${dateTime(res.followAt)}.`;
    refresh();
  });
  return r?.ok ? { ...r, message: msg } : r;
}
export async function rescheduleAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("appointments");
  return run(async () => { await rescheduleAppointment(str(fd, "id"), fromLocalInput(str(fd, "startAt")), a); refresh(); }, "Cita reagendada.");
}
