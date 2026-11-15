"use server";
import { revalidatePath } from "next/cache";
import { guard } from "@/lib/auth";
import { db } from "@/lib/db";
import { normPhone, validRut } from "@/lib/format";
import { assertBranch } from "@/lib/rbac";
import { createLead } from "@/server/crm";
import { SOURCE_LABEL } from "@/lib/labels";

export type ImportRow = { nombre?: string; telefono?: string; correo?: string; rut?: string; comuna?: string; interes?: string; presupuesto?: string; origen?: string };
export type RowCheck = { row: number; errors: string[]; duplicate: string | null };
const SOURCES = Object.keys(SOURCE_LABEL);

/** Valida filas y detecta duplicados (en la base y dentro del archivo) sin escribir nada. */
export async function validateImport(rows: ImportRow[]): Promise<RowCheck[]> {
  await guard("leads.import");
  if (rows.length > 2000) return [{ row: 0, errors: ["Máximo 2.000 filas por archivo."], duplicate: null }];
  const phones = rows.map((r) => normPhone(r.telefono)).filter(Boolean) as string[];
  const emails = rows.map((r) => r.correo?.trim().toLowerCase()).filter(Boolean) as string[];
  const existing = await db.contact.findMany({ where: { OR: [{ phone: { in: phones } }, { email: { in: emails } }] }, select: { phone: true, email: true, name: true } });
  const seen = new Map<string, number>();
  return rows.map((r, i) => {
    const errors: string[] = [];
    const phone = normPhone(r.telefono), email = r.correo?.trim().toLowerCase();
    if (!r.nombre?.trim()) errors.push("Falta nombre");
    if (!phone && !email) errors.push("Falta teléfono o correo");
    if (phone && !/^\+56\d{9}$/.test(phone)) errors.push("Teléfono no chileno (+56 9 …)");
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.push("Correo inválido");
    if (r.rut && !validRut(r.rut)) errors.push("RUT inválido");
    if (r.presupuesto && !/^\d[\d.]*$/.test(r.presupuesto.trim())) errors.push("Presupuesto no numérico");
    if (r.origen && !SOURCES.includes(r.origen.toUpperCase())) errors.push(`Origen desconocido (${SOURCES.join(", ")})`);
    const ex = existing.find((c) => (phone && c.phone === phone) || (email && c.email === email));
    const key = phone ?? email ?? `row${i}`;
    const dupFile = seen.get(key);
    seen.set(key, i + 1);
    return { row: i + 1, errors, duplicate: ex ? `Ya existe: ${ex.name}` : dupFile ? `Repetido en fila ${dupFile}` : null };
  });
}

export async function commitImport(rows: ImportRow[], branchId: string, includeDuplicates: boolean) {
  const a = await guard("leads.import");
  assertBranch(a, branchId);
  if (rows.length > 2000) throw new Error("Máximo 2.000 filas por archivo.");
  const checks = await validateImport(rows);
  let created = 0, skipped = 0;
  for (const [i, r] of rows.entries()) {
    const c = checks[i];
    if (c.errors.length || (c.duplicate && (!includeDuplicates || c.duplicate.startsWith("Repetido")))) { skipped++; continue; }
    await createLead({ name: r.nombre!, phone: r.telefono, email: r.correo, rut: r.rut, comuna: r.comuna, interest: r.interes, budget: r.presupuesto ? +r.presupuesto.replace(/\D/g, "") : null, source: (r.origen?.toUpperCase() as "WEB") || "REFERIDO", branchId, note: "Importado desde CSV" }, a);
    created++;
  }
  revalidatePath("/panel/leads");
  return { created, skipped };
}
