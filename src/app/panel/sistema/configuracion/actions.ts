"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { guard } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { run, str, int, type ActionState } from "@/lib/action";
import { getSetting, setSetting } from "@/server/settings";
import { AppError } from "@/server/errors";

const done = () => revalidatePath("/panel/sistema/configuracion");
const check = <T>(s: z.ZodType<T>, v: unknown) => {
  const r = s.safeParse(v);
  if (!r.success) throw new AppError(r.error.issues[0]?.message ?? "Datos no válidos.");
  return r.data;
};

const Company = z.object({
  name: z.string().min(2, "Ingresa la razón social."), rut: z.string().regex(/^\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]$/, "RUT no válido."),
  address: z.string().min(3, "Ingresa la dirección."), phone: z.string().min(6, "Teléfono no válido."), email: z.string().email("Correo no válido."),
});
export async function companyAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("config");
  return run(async () => {
    const v = check(Company, { name: str(fd, "name"), rut: str(fd, "rut"), address: str(fd, "address"), phone: str(fd, "phone"), email: str(fd, "email") });
    const before = await getSetting("company");
    await setSetting("company", v);
    await audit(a, "config.company", "Setting", "company", "Actualizó datos de la automotora", { before, after: v });
    done();
  }, "Datos de la automotora guardados.");
}

const Hours = z.string().max(40);
const Branch = z.object({
  name: z.string().min(2, "Ingresa el nombre de la sucursal."), address: z.string().min(3, "Ingresa la dirección."), comuna: z.string().min(2, "Ingresa la comuna."),
  region: z.string().min(2, "Ingresa la región."), phone: z.string().min(6, "Teléfono no válido."), whatsapp: z.string().min(6, "WhatsApp no válido."), active: z.boolean(),
  hours: z.object({ lunVie: Hours, sab: Hours, dom: Hours }),
});
export async function branchAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("config");
  return run(async () => {
    const id = str(fd, "id");
    const prev = await db.branch.findUnique({ where: { id }, omit: { createdAt: true } });
    if (!prev) throw new AppError("Sucursal no encontrada.", 404);
    const v = check(Branch, {
      name: str(fd, "name"), address: str(fd, "address"), comuna: str(fd, "comuna"), region: str(fd, "region"), phone: str(fd, "phone"),
      whatsapp: str(fd, "whatsapp"), active: fd.get("active") === "on",
      hours: { lunVie: str(fd, "lunVie"), sab: str(fd, "sab"), dom: str(fd, "dom") },
    });
    await db.branch.update({ where: { id }, data: v });
    await audit(a, "config.branch", "Branch", id, `Actualizó la sucursal ${v.name}`, { before: prev, after: v });
    done();
  }, "Sucursal guardada.");
}

const Notices = z.object({
  noContactHours: z.number().int().min(1, "Mínimo 1 hora.").max(720), followUpGraceHours: z.number().int().min(0).max(168),
  staleStockDays: z.number().int().min(1).max(730), noPhotoDays: z.number().int().min(0).max(60), reservationWarnHours: z.number().int().min(1).max(240),
});
export async function noticesAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("config");
  return run(async () => {
    const v = check(Notices, Object.fromEntries(Object.keys(Notices.shape).map((k) => [k, int(fd, k)])));
    const before = await getSetting("notices");
    await setSetting("notices", v);
    await audit(a, "config.notices", "Setting", "notices", "Actualizó preferencias de avisos", { before, after: v });
    done();
  }, "Preferencias de avisos guardadas.");
}
