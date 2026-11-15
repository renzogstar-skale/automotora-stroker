"use server";
import { revalidatePath } from "next/cache";
import { guard } from "@/lib/auth";
import { db } from "@/lib/db";
import { computeLoan, validateLoan, type LoanInput } from "@/lib/loan";
import { getOppForActor } from "@/server/crm";
import { AppError } from "@/server/errors";
import { run, type ActionState } from "@/lib/action";

export async function saveSimulation(oppId: string, i: LoanInput): Promise<ActionState> {
  const a = await guard("calculator");
  return run(async () => {
    await getOppForActor(oppId, a);
    const errs = validateLoan(i);
    if (errs.length) throw new AppError(errs[0]);
    const r = computeLoan(i);
    await db.financingSimulation.create({ data: { opportunityId: oppId, inputs: { ...i, plazo: i.months, tasa: i.annualRate }, result: r, createdBy: a.name } });
    await db.activity.create({ data: { type: "NOTA", opportunityId: oppId, body: `Simulación de crédito: cuota ${r.cuota} en ${i.months} meses al ${i.annualRate}% anual (referencial)`, userId: a.id, userName: a.name } });
    revalidatePath(`/panel/crm/${oppId}`);
  }, "Simulación guardada en la oportunidad.");
}
