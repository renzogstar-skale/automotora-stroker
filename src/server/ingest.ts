import { z } from "zod";
import type { ApiKey, Source } from "@prisma/client";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/crypto";
import { createLead, upsertContact } from "./crm";
import { createAppointment } from "./appointments";
import { AppError } from "./errors";

export type IngestResult = { status: number; body: Record<string, unknown>; replay?: boolean };
const RATE_PER_MIN = Number(process.env.INGEST_RATE_PER_MIN ?? 60);

const SOURCE_MAP: Record<string, Source> = { web: "WEB", whatsapp: "WHATSAPP", telefono: "TELEFONO", phone: "TELEFONO", facebook: "REDES", instagram: "REDES", redes: "REDES", referido: "REFERIDO", presencial: "PRESENCIAL" };
const apptSchema = z.object({
  start: z.string().datetime({ offset: true }),
  type: z.enum(["test_drive", "reunion", "entrega", "servicio"]).default("reunion"),
  duration_minutes: z.number().int().min(15).max(480).default(60),
  notes: z.string().max(500).optional(),
});
export const leadSchema = z.object({
  external_id: z.string().min(1).max(120),
  name: z.string().min(2).max(120),
  phone: z.string().max(30).optional(), email: z.string().email().optional(), rut: z.string().max(15).optional(),
  region: z.string().max(60).optional(), comuna: z.string().max(60).optional(),
  source: z.string().optional(), type: z.enum(["venta", "consignacion", "piso"]).default("venta"),
  vehicle_plate: z.string().max(10).optional(), interest: z.string().max(300).optional(), budget: z.number().int().nonnegative().optional(),
  payment_method: z.enum(["contado", "financiamiento", "parte_pago"]).optional(), note: z.string().max(1000).optional(),
  branch_code: z.string().optional(), appointment: apptSchema.optional(),
}).refine((x) => x.phone || x.email, { message: "Se requiere phone o email" });
export const apptIngestSchema = apptSchema.extend({
  external_id: z.string().min(1).max(120), lead_id: z.string().optional(), lead_external_id: z.string().optional(),
  vehicle_plate: z.string().max(10).optional(), seller_email: z.string().email().optional(), branch_code: z.string().optional(),
});

export async function authenticate(apiKey: string | null, perm: string): Promise<ApiKey | IngestResult> {
  if (!apiKey) return { status: 401, body: { error: "Falta el encabezado x-api-key." } };
  const k = await db.apiKey.findUnique({ where: { hash: sha256(apiKey) } });
  if (!k) return { status: 401, body: { error: "Clave inválida." } };
  if (k.revokedAt) return { status: 401, body: { error: "Clave revocada." } };
  if (!k.permissions.includes(perm)) return { status: 403, body: { error: `La clave no tiene el permiso ${perm}.` } };
  const recent = await db.ingestLog.count({ where: { apiKeyId: k.id, createdAt: { gt: new Date(Date.now() - 60_000) } } });
  if (recent >= RATE_PER_MIN) return { status: 429, body: { error: "Límite de solicitudes excedido. Reintenta en un minuto." } };
  await db.apiKey.update({ where: { id: k.id }, data: { lastUsedAt: new Date() } });
  return k;
}

async function checkBranch(k: ApiKey, code?: string) {
  if (!code) return null;
  const b = await db.branch.findUnique({ where: { code } });
  if (!b || b.id !== k.branchId) return { status: 403, body: { error: "La sucursal indicada no corresponde a la clave." } } as IngestResult;
  return null;
}
const plateVehicle = async (k: ApiKey, plate?: string) =>
  plate ? db.vehicle.findFirst({ where: { plate: plate.toUpperCase().replace(/[^A-Z0-9]/g, ""), branchId: k.branchId } }) : null;
const apptType = (t: string) => t.toUpperCase() as "TEST_DRIVE" | "REUNION" | "ENTREGA" | "SERVICIO";

/** Ejecuta con idempotencia: misma clave + endpoint + Idempotency-Key (o hash del cuerpo) devuelve la respuesta guardada. */
export async function withIdempotency(k: ApiKey, endpoint: string, idemKey: string | null, raw: string, fn: () => Promise<IngestResult>) {
  const requestHash = sha256(raw);
  const key = `${k.id}:${endpoint}:${idemKey || requestHash}`;
  const prev = await db.idempotencyRecord.findUnique({ where: { key } });
  let r: IngestResult;
  if (prev && prev.requestHash && prev.requestHash !== requestHash)
    r = { status: 422, body: { error: "La Idempotency-Key ya se usó con otro cuerpo." } };
  else if (prev) r = { status: prev.status, body: prev.response as Record<string, unknown>, replay: true };
  else {
    try { r = await fn(); } catch (e) {
      if ((e as { code?: string })?.code === "P2002") r = { status: 409, body: { error: "Solicitud duplicada en curso. Reintenta en unos segundos." } };
      else r = e instanceof AppError ? { status: e.status, body: { error: e.message } } : { status: 500, body: { error: "Error interno." } };
      if (!(e instanceof AppError) && r.status === 500) console.error(e);
    }
    // Solo se memorizan respuestas definitivas: los 5xx, 429 y carreras (409 por P2002) se pueden reintentar.
    const transient = r.status >= 500 || r.status === 429 || r.body.error === "Solicitud duplicada en curso. Reintenta en unos segundos.";
    if (!transient) await db.idempotencyRecord.upsert({ where: { key }, create: { key, requestHash, status: r.status, response: JSON.parse(JSON.stringify(r.body)) }, update: {} });
  }
  // El registro no guarda datos personales: solo estado e identificadores internos.
  await db.ingestLog.create({ data: { apiKeyId: k.id, endpoint, status: r.status, result: r.replay ? `replay ${r.status}` : String(r.body.error ?? r.body.lead_id ?? r.body.appointment_id ?? "ok").slice(0, 120) } });
  return r;
}

export async function ingestLead(k: ApiKey, body: unknown): Promise<IngestResult> {
  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) return { status: 422, body: { error: "Cuerpo inválido.", issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) } };
  const d = parsed.data;
  const bad = await checkBranch(k, d.branch_code);
  if (bad) return bad;
  const vehicle = await plateVehicle(k, d.vehicle_plate);
  const existing = await db.opportunity.findUnique({ where: { branchId_externalId: { branchId: k.branchId, externalId: d.external_id } } });
  const out: Record<string, unknown> = {};
  let oppId: string;
  if (existing) {
    await db.$transaction(async (t) => {
      await upsertContact(t, { name: d.name, phone: d.phone, email: d.email, rut: d.rut, region: d.region, comuna: d.comuna });
      await t.opportunity.update({
        where: { id: existing.id },
        data: { interest: d.interest ?? existing.interest, budget: d.budget ?? existing.budget, vehicleId: vehicle?.id ?? existing.vehicleId },
      });
      await t.activity.create({ data: { type: "SISTEMA", opportunityId: existing.id, contactId: existing.contactId, body: `Actualizado vía n8n${d.note ? `: ${d.note}` : ""}`, userName: "n8n" } });
    });
    oppId = existing.id; out.created = false;
  } else {
    const o = await createLead({
      name: d.name, phone: d.phone, email: d.email, rut: d.rut, region: d.region, comuna: d.comuna,
      type: d.type.toUpperCase() as "VENTA", source: SOURCE_MAP[d.source?.toLowerCase() ?? ""] ?? "N8N", branchId: k.branchId,
      vehicleId: vehicle?.id, interest: d.interest, budget: d.budget, note: d.note, externalId: d.external_id,
      payMethod: d.payment_method ? (d.payment_method.toUpperCase() as "CONTADO") : null,
    }, null);
    oppId = o.id; out.created = true;
  }
  out.lead_id = oppId;
  if (d.appointment) {
    const extId = `lead:${d.external_id}:${d.appointment.start}`;
    const dup = await db.appointment.findUnique({ where: { branchId_externalId: { branchId: k.branchId, externalId: extId } } });
    if (dup) out.appointment_id = dup.id;
    else {
      try {
        const a = await createAppointment({ type: apptType(d.appointment.type), startAt: new Date(d.appointment.start), durationMin: d.appointment.duration_minutes, branchId: k.branchId, opportunityId: oppId, vehicleId: vehicle?.id, notes: d.appointment.notes, externalId: extId }, null);
        out.appointment_id = a.id;
      } catch (e) {
        if (!(e instanceof AppError)) throw e;
        out.appointment_error = e.message;
      }
    }
  }
  return { status: out.created ? 201 : 200, body: out };
}

/** Solo agenda: crea una cita y opcionalmente la vincula a un lead existente. No crea ni modifica leads. */
export async function ingestAppointment(k: ApiKey, body: unknown): Promise<IngestResult> {
  const parsed = apptIngestSchema.safeParse(body);
  if (!parsed.success) return { status: 422, body: { error: "Cuerpo inválido.", issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) } };
  const d = parsed.data;
  const bad = await checkBranch(k, d.branch_code);
  if (bad) return bad;
  const dup = await db.appointment.findUnique({ where: { branchId_externalId: { branchId: k.branchId, externalId: d.external_id } } });
  if (dup) return { status: 200, body: { appointment_id: dup.id, created: false } };
  let opp = null;
  if (d.lead_id || d.lead_external_id) {
    opp = d.lead_id
      ? await db.opportunity.findUnique({ where: { id: d.lead_id } })
      : await db.opportunity.findUnique({ where: { branchId_externalId: { branchId: k.branchId, externalId: d.lead_external_id! } } });
    if (!opp) return { status: 404, body: { error: "Lead no encontrado." } };
    if (opp.branchId !== k.branchId) return { status: 403, body: { error: "El lead pertenece a otra sucursal." } };
  }
  const seller = d.seller_email ? await db.seller.findFirst({ where: { email: d.seller_email, branchId: k.branchId } }) : null;
  const vehicle = await plateVehicle(k, d.vehicle_plate);
  const a = await createAppointment({
    type: apptType(d.type), startAt: new Date(d.start), durationMin: d.duration_minutes, branchId: k.branchId, opportunityId: opp?.id,
    sellerId: seller?.id, vehicleId: vehicle?.id, notes: d.notes, externalId: d.external_id,
  }, null);
  return { status: 201, body: { appointment_id: a.id, created: true, lead_id: opp?.id ?? null } };
}
