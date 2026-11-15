import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { addDays, parseYmd, ymd } from "@/lib/format";
import { branchScope, can, type Actor } from "@/lib/rbac";
import { AppError, conflict } from "./errors";

export type CallRow = { oppId: string | null; contact: string; outcome: string | null; body: string; at: string; source: "CRM" | "MANUAL" };

/** DailyReport.date es @db.Date: se guarda el día de Santiago como medianoche UTC. */
const dbDay = (day: string) => new Date(`${day}T00:00:00Z`);

/** Llamadas registradas en el CRM ese día (por el vendedor o sobre su cartera), separadas en ventas y consignaciones. */
export async function crmCalls(sellerId: string, day: string) {
  const seller = await db.seller.findUniqueOrThrow({ where: { id: sellerId } });
  const d0 = parseYmd(day), d1 = addDays(d0, 1);
  const acts = await db.activity.findMany({
    where: { type: "LLAMADA", createdAt: { gte: d0, lt: d1 }, OR: [{ opportunity: { sellerId } }, ...(seller.userId ? [{ userId: seller.userId }] : [])] },
    include: { opportunity: { include: { contact: true } }, contact: true }, orderBy: { createdAt: "asc" },
  });
  const row = (x: (typeof acts)[number]): CallRow => ({ oppId: x.opportunityId, contact: x.opportunity?.contact.name ?? x.contact?.name ?? "—", outcome: x.outcome, body: x.body, at: x.createdAt.toISOString(), source: "CRM" });
  return {
    calls: acts.filter((x) => x.opportunity?.type !== "CONSIGNACION").map(row),
    consignment: acts.filter((x) => x.opportunity?.type === "CONSIGNACION").map(row),
  };
}

export async function getReport(sellerId: string, day: string) {
  const r = await db.dailyReport.findUnique({ where: { sellerId_date: { sellerId, date: dbDay(day) } } });
  const live = await crmCalls(sellerId, day);
  const sent = r?.status === "ENVIADO";
  const stored = (r?.consignmentCalls as CallRow[] | undefined) ?? [];
  return {
    report: r,
    // Enviado: se muestra la foto guardada. Borrador: llamadas del CRM al momento + consignaciones manuales.
    calls: sent ? (r!.calls as CallRow[]) : live.calls,
    consignment: sent ? stored : [...live.consignment, ...stored.filter((c) => c.source === "MANUAL")],
  };
}

export type ReportInput = { manualConsignments: string[]; creditsEntered: number; publications: number; notes: string | null };

export async function saveReport(actor: Actor, day: string, i: ReportInput, submit: boolean) {
  if (!actor.sellerId) throw new AppError("Solo los vendedores registran informe diario.", 403, "forbidden");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day > ymd(new Date())) throw new AppError("Fecha inválida: no se informa un día futuro.");
  if (i.creditsEntered < 0 || i.publications < 0) throw new AppError("Los créditos y publicaciones no pueden ser negativos.");
  const sellerId = actor.sellerId;
  const date = dbDay(day);
  const cur = await db.dailyReport.findUnique({ where: { sellerId_date: { sellerId, date } } });
  if (cur?.status === "ENVIADO") throw conflict("El informe de ese día ya fue enviado.");
  const live = await crmCalls(sellerId, day);
  const manual: CallRow[] = i.manualConsignments.map((t) => t.trim()).filter(Boolean).map((t) => ({ oppId: null, contact: t, outcome: null, body: t, at: new Date().toISOString(), source: "MANUAL" }));
  const data = {
    calls: JSON.parse(JSON.stringify(live.calls)),
    consignmentCalls: JSON.parse(JSON.stringify(submit ? [...live.consignment, ...manual] : manual)),
    creditsEntered: i.creditsEntered, publications: i.publications, notes: i.notes,
    status: submit ? "ENVIADO" : "BORRADOR", submittedAt: submit ? new Date() : null,
  };
  const r = await db.dailyReport.upsert({ where: { sellerId_date: { sellerId, date } }, create: { sellerId, date, ...data }, update: data });
  if (submit) await audit(actor, "dailyreport.submit", "DailyReport", r.id, `Informe diario ${day} enviado (${live.calls.length} llamadas)`);
  return r;
}

/** Supervisión: vendedores activos de las sucursales del actor con el estado de su informe del día. */
export async function superviseDay(actor: Actor, day: string) {
  if (!can(actor, "dailyreport.supervise")) throw new AppError("Sin permiso de supervisión.", 403, "forbidden");
  const b = branchScope(actor);
  const sellers = await db.seller.findMany({
    where: { active: true, ...(b ? { branchId: { in: b } } : {}) }, include: { branch: true, dailyReports: { where: { date: dbDay(day) } } }, orderBy: [{ branchId: "asc" }, { name: "asc" }],
  });
  return sellers.map((s) => {
    const r = s.dailyReports[0];
    return {
      seller: s, branch: s.branch, report: r ?? null, hasAccount: !!s.userId,
      state: (r?.status === "ENVIADO" ? "ENVIADO" : r ? "BORRADOR" : "PENDIENTE") as "ENVIADO" | "BORRADOR" | "PENDIENTE",
      calls: r?.status === "ENVIADO" ? (r.calls as CallRow[]).length : null,
      consignment: r?.status === "ENVIADO" ? (r.consignmentCalls as CallRow[]).length : null,
    };
  });
}
