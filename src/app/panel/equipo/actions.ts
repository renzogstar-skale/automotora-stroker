"use server";
import { revalidatePath } from "next/cache";
import { guard } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { run, int, type ActionState } from "@/lib/action";
import { setSetting } from "@/server/settings";
import { AppError } from "@/server/errors";

export async function teamAlertsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("team");
  return run(async () => {
    const v = { inactivityHours: int(fd, "inactivityHours"), overdueFollowUpsMax: int(fd, "overdueFollowUpsMax"), overdueTasksMax: int(fd, "overdueTasksMax"), reportDueHour: int(fd, "reportDueHour"), followUpAfterApptHours: int(fd, "followUpAfterApptHours") };
    if (v.inactivityHours < 1 || v.reportDueHour < 0 || v.reportDueHour > 23 || v.overdueFollowUpsMax < 0 || v.overdueTasksMax < 0 || v.followUpAfterApptHours < 1) throw new AppError("Revisa los valores: horas ≥ 1, hora de cierre entre 0 y 23.");
    await setSetting("team", v);
    await audit(a, "settings.team", "Setting", "team", "Alertas del equipo actualizadas", v);
    revalidatePath("/panel/equipo");
  }, "Alertas actualizadas.");
}
