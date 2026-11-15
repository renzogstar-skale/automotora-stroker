"use server";
import { redirect } from "next/navigation";
import { guard } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { run, str, opt, int, type ActionState } from "@/lib/action";
import { normalizePlate } from "@/lib/format";
import { valuate } from "@/server/appraisal";
import { AppError } from "@/server/errors";

export async function appraiseAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("appraisal");
  let id = "";
  const r = await run(async () => {
    const p = normalizePlate(str(fd, "plate"));
    if (!p) throw new AppError("Patente inválida.");
    const manual = fd.get("manual") === "on";
    const base = { brand: str(fd, "brand"), year: int(fd, "year"), km: int(fd, "km"), condition: str(fd, "condition") };
    let val: { min: number; max: number; suggested: number; source: string; sourceDate: Date };
    if (manual) {
      const min = int(fd, "min"), max = int(fd, "max");
      if (!min || !max || min > max) throw new AppError("Ingresa un rango válido (mínimo ≤ máximo).");
      if (!str(fd, "source")) throw new AppError("Indica la fuente de la tasación manual.");
      val = { min, max, suggested: Math.round((min + max) / 2), source: str(fd, "source"), sourceDate: new Date() };
    } else val = valuate(base);
    const ap = await db.appraisal.create({ data: {
      plate: p.plate, kind: p.kind, brand: base.brand, model: str(fd, "model"), version: opt(fd, "version"), year: base.year, km: base.km, condition: base.condition,
      minValue: val.min, maxValue: val.max, suggested: val.suggested, source: val.source, sourceDate: val.sourceDate, isDemo: !manual, manual,
      notes: opt(fd, "notes"), opportunityId: opt(fd, "opportunityId"), createdById: a.id,
    } });
    await audit(a, "appraisal.create", "Appraisal", ap.id, `Tasación ${p.plate}`);
    id = ap.id;
  });
  if (r?.error) return r;
  redirect(`/panel/tasacion?resultado=${id}`);
}
