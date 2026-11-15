"use server";
import { revalidatePath } from "next/cache";
import { guard } from "@/lib/auth";
import { run, int, opt, str, type ActionState } from "@/lib/action";
import { saveReport } from "@/server/dailyreport";

export async function reportAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("dailyreport");
  const submit = str(fd, "intent") === "send";
  return run(async () => {
    await saveReport(a, str(fd, "day"), {
      manualConsignments: str(fd, "consignments").split("\n"), creditsEntered: int(fd, "creditsEntered"), publications: int(fd, "publications"), notes: opt(fd, "notes"),
    }, submit);
    revalidatePath("/panel/informe-diario");
    revalidatePath("/panel/equipo");
  }, submit ? "Informe enviado a supervisión." : "Borrador guardado.");
}
