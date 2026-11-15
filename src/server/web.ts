import { z } from "zod";
import { resolveCname } from "node:dns/promises";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { sha256 } from "@/lib/crypto";
import { fromLocalInput, normPhone } from "@/lib/format";
import { assert, type Actor } from "@/lib/rbac";
import { createLead } from "./crm";
import { createAppointment } from "./appointments";
import { AppError } from "./errors";
import { DEFAULTS, getSetting, setSetting, type BranchWeb, type WebConfig } from "./settings";

/** Campos aprobados para la vitrina: nunca costo, margen, patente, VIN ni datos del propietario. */
export const publicSelect = {
  id: true, slug: true, stockCode: true, brand: true, model: true, version: true, year: true, km: true, transmission: true, fuel: true, bodyType: true,
  color: true, price: true, status: true, description: true, originalCaption: true, features: true, instagramUrl: true, minDownPayment: true,
  verificationStatus: true, condition: true, featured: true,
  branch: { select: { id: true, name: true, comuna: true, whatsapp: true } },
  photos: { select: { url: true, isCover: true }, orderBy: { order: "asc" } },
} satisfies Prisma.VehicleSelect;
export type PublicVehicle = Prisma.VehicleGetPayload<{ select: typeof publicSelect }>;

export const publicWhere: Prisma.VehicleWhereInput = {
  published: true,
  status: { in: ["DISPONIBLE", "RESERVADO", "VENDIDO", "EN_CONSIGNACION"] },
  verificationStatus: { not: "POR_CONFIRMAR" }
};

export function catalogWhere(q: Record<string, string | undefined>): Prisma.VehicleWhereInput {
  const w: Prisma.VehicleWhereInput = { published: true };
  if (q.estado && ["DISPONIBLE", "RESERVADO", "VENDIDO", "EN_CONSIGNACION"].includes(q.estado)) {
    w.status = q.estado as any;
  } else {
    w.status = { in: ["DISPONIBLE", "RESERVADO", "VENDIDO", "EN_CONSIGNACION"] };
  }
  if (q.marca) w.brand = q.marca;
  if (q.modelo) w.model = { contains: q.modelo, mode: "insensitive" };
  if (q.tipo) w.bodyType = q.tipo;
  if (q.sucursal) w.branchId = q.sucursal;
  if (q.combustible) w.fuel = { equals: q.combustible, mode: "insensitive" };
  if (q.transmision) w.transmission = { equals: q.transmision, mode: "insensitive" };
  if (q.anio && +q.anio) w.year = { gte: +q.anio };
  if (q.precio && +q.precio) w.price = { lte: +q.precio };
  if (q.km && +q.km) w.km = { lte: +q.km };
  if (q.q) w.OR = [{ brand: { contains: q.q, mode: "insensitive" } }, { model: { contains: q.q, mode: "insensitive" } }];
  return w;
}

// ── Configuración del sitio (borrador / publicada) ──

export const fullConfig = (c?: Partial<WebConfig> | null): WebConfig => ({ ...DEFAULTS.web.published, ...(c ?? {}) });

/** Sitio a mostrar: configuración publicada (o borrador en vista previa) + sucursales con sus datos públicos. */
export async function getSite(draft = false) {
  const w = await getSetting("web");
  const cfg = fullConfig(draft && w.draft ? w.draft : w.published);
  const rows = await db.branch.findMany({ where: { active: true }, orderBy: { code: "asc" } });
  const branches = rows.map((b) => {
    const o = cfg.branches[b.id];
    const h = b.hours as Record<string, string>;
    return {
      id: b.id, name: b.name, comuna: b.comuna, region: b.region, visible: o?.visible ?? true,
      address: o?.address ?? b.address, phone: o?.phone ?? b.phone, whatsapp: o?.whatsapp ?? b.whatsapp,
      hours: o?.hours ?? `Lun–Vie ${h.lunVie} · Sáb ${h.sab} · Dom ${h.dom}`,
    };
  });
  return { cfg, branches, isDraft: draft && !!w.draft };
}
export type Site = Awaited<ReturnType<typeof getSite>>;

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color en formato #RRGGBB");
const cfgSchema = z.object({
  logoText: z.string().trim().min(1, "Nombre del logo obligatorio").max(40), logoImage: z.string().max(300),
  accent: hex, secondary: hex, heroTitle: z.string().trim().min(5, "Título de portada muy corto").max(120), heroSubtitle: z.string().max(500),
  heroImage: z.string().max(300), aboutText: z.string().max(1500), phone: z.string().max(30), email: z.union([z.string().email("Correo inválido"), z.literal("")]),
  whatsapp: z.string().min(8, "WhatsApp inválido").max(30), featuredIds: z.array(z.string()).max(12, "Máximo 12 destacados"), showBranches: z.boolean(),
  branches: z.record(z.string(), z.object({ visible: z.boolean(), address: z.string().max(150), phone: z.string().max(30), whatsapp: z.string().max(30), hours: z.string().max(120) })),
  address: z.string().max(300).optional(),
  locationUrl: z.string().max(500).optional(),
  tagline: z.string().max(120).optional(),
  taglineTranslation: z.string().max(150).optional(),
});

export async function saveDraft(cfg: WebConfig, actor: Actor) {
  assert(actor, "web.admin");
  const p = cfgSchema.safeParse(cfg);
  if (!p.success) throw new AppError(p.error.issues[0].message);
  await setSetting("web", { draft: p.data });
  await audit(actor, "web.draft", "Setting", "web", "Borrador de la web guardado");
}
export async function discardDraft(actor: Actor) {
  assert(actor, "web.admin");
  await setSetting("web", { draft: null });
  await audit(actor, "web.discard", "Setting", "web", "Borrador de la web descartado");
}
/** Publica el borrador: reemplaza la configuración pública y actualiza los datos de contacto de cada sucursal. */
export async function publishWeb(actor: Actor) {
  assert(actor, "web.admin");
  const w = await getSetting("web");
  if (!w.draft) throw new AppError("No hay cambios en borrador para publicar.");
  const cfg = fullConfig(w.draft);
  await db.$transaction(async (t) => {
    for (const [id, b] of Object.entries(cfg.branches) as [string, BranchWeb][])
      await t.branch.updateMany({ where: { id }, data: { address: b.address, phone: b.phone, whatsapp: b.whatsapp } });
  });
  await setSetting("web", { published: cfg, draft: null, publishedAt: new Date().toISOString(), status: "PUBLICADO" });
  await audit(actor, "web.publish", "Setting", "web", "Cambios de la web publicados");
}

export const DNS_TARGET = "cname.vercel-dns.com";
/** Verifica que el dominio apunte (CNAME) al hosting. Sin registro queda «PENDIENTE_DNS». */
export async function verifyDomain(domain: string, actor: Actor) {
  assert(actor, "web.admin");
  const d = domain.trim().toLowerCase();
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d)) throw new AppError("Dominio inválido.");
  let status = "PENDIENTE_DNS", detail = "Sin registro CNAME";
  try {
    const c = await resolveCname(d);
    detail = c.join(", ");
    status = c.some((x) => x.endsWith(DNS_TARGET)) ? "ACTIVO" : "DNS_INCORRECTO";
  } catch (e) { detail = (e as { code?: string }).code ?? "Error de DNS"; }
  await setSetting("web", { domain: d, domainStatus: status });
  await audit(actor, "web.domain", "Setting", "web", `Dominio ${d}: ${status} (${detail})`);
  return { status, detail };
}

// ── Métricas ──

export async function webMetrics(days = 30) {
  const from = new Date(Date.now() - days * 864e5);
  const [byType, visitors, contacts, top, daily] = await Promise.all([
    db.webEvent.groupBy({ by: ["type"], where: { createdAt: { gte: from } }, _count: true }),
    db.webEvent.findMany({ where: { createdAt: { gte: from } }, distinct: ["visitor"], select: { visitor: true } }),
    db.formSubmission.groupBy({ by: ["kind"], where: { createdAt: { gte: from }, opportunityId: { not: null } }, _count: true }),
    db.webEvent.groupBy({ by: ["vehicleId"], where: { createdAt: { gte: from }, type: "VEHICLE_VIEW", vehicleId: { not: null } }, _count: true, orderBy: { _count: { vehicleId: "desc" } }, take: 10 }),
    db.$queryRaw<{ d: string; views: bigint; clicks: bigint }[]>`
      SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Santiago', 'YYYY-MM-DD') AS d,
        COUNT(*) FILTER (WHERE type IN ('VIEW','VEHICLE_VIEW')) AS views, COUNT(*) FILTER (WHERE type = 'WHATSAPP_CLICK') AS clicks
      FROM "WebEvent" WHERE "createdAt" >= ${from} GROUP BY 1 ORDER BY 1`,
  ]);
  const n = (t: string) => byType.find((x) => x.type === t)?._count ?? 0;
  const ids = top.map((t) => t.vehicleId!);
  const [vehicles, clicks] = await Promise.all([
    db.vehicle.findMany({ where: { id: { in: ids } }, select: { id: true, brand: true, model: true, year: true, plate: true, status: true, published: true } }),
    db.webEvent.groupBy({ by: ["vehicleId"], where: { createdAt: { gte: from }, type: "WHATSAPP_CLICK", vehicleId: { in: ids } }, _count: true }),
  ]);
  return {
    views: n("VIEW") + n("VEHICLE_VIEW"), visitors: visitors.length, whatsapp: n("WHATSAPP_CLICK"),
    contacts: contacts.reduce((t, c) => t + c._count, 0), contactsByKind: Object.fromEntries(contacts.map((c) => [c.kind, c._count])) as Record<string, number>,
    top: top.flatMap((t) => { const v = vehicles.find((x) => x.id === t.vehicleId); return v ? [{ vehicle: v, views: t._count, clicks: clicks.find((c) => c.vehicleId === t.vehicleId)?._count ?? 0 }] : []; }),
    daily: daily.map((r) => ({ label: r.d.slice(8) + "/" + r.d.slice(5, 7), Vistas: Number(r.views), WhatsApp: Number(r.clicks) })),
  };
}

// ── Formularios ──

const base = z.object({
  name: z.string().trim().min(2, "Ingresa tu nombre").max(100),
  phone: z.string().trim().min(8, "Teléfono inválido").max(20),
  email: z.union([z.string().trim().email("Correo inválido"), z.literal("")]).optional(),
  message: z.string().max(1000).optional(),
  website: z.string().max(0, "spam").optional(), // trampa anti-bots
});
export const formSchemas = {
  CONSULTA: base.extend({ vehicleId: z.string().optional(), payMethod: z.enum(["CONTADO", "FINANCIAMIENTO", "PARTE_PAGO"]).optional() }),
  TEST_DRIVE: base.extend({ vehicleId: z.string(), date: z.string().min(10, "Elige fecha y hora") }),
  CONSIGNACION: base.extend({ brand: z.string().trim().min(2, "Indica la marca"), model: z.string().trim().min(1, "Indica el modelo"), year: z.coerce.number().int().min(1990, "Año inválido").max(2030, "Año inválido"), km: z.coerce.number().int().min(0), expected: z.coerce.number().int().optional(), branchId: z.string().min(1, "Elige una sucursal") }),
};
export type FormKind = keyof typeof formSchemas;

/**
 * Formulario de la vitrina → oportunidad en el CRM con origen, vehículo y sucursal.
 * Duplicados por reintento: el token del formulario es único (doble clic, reenvío, corte de red); además se descarta
 * el mismo tipo + teléfono + vehículo dentro de 10 minutos aunque venga de otra carga de la página.
 */
export async function submitPublicForm(kind: FormKind, input: Record<string, unknown>, token?: string) {
  const parsed = formSchemas[kind].safeParse(input);
  if (!parsed.success) return { ok: false as const, errors: Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])) as Record<string, string> };
  const d = parsed.data as z.infer<(typeof formSchemas)["CONSIGNACION"]> & z.infer<(typeof formSchemas)["TEST_DRIVE"]> & { payMethod?: "CONTADO" };
  const vehicle = d.vehicleId ? await db.vehicle.findFirst({ where: { id: d.vehicleId, ...publicWhere } }) : null;
  if (d.vehicleId && !vehicle) return { ok: false as const, errors: { vehicleId: "El vehículo ya no está disponible." } };
  if (kind === "TEST_DRIVE" && vehicle?.status === "RESERVADO") return { ok: false as const, errors: { vehicleId: "Esta unidad está reservada; déjanos una consulta y te avisamos si se libera." } };
  const branch = vehicle ? null : await db.branch.findFirst({ where: { active: true, ...(d.branchId ? { id: d.branchId } : {}) }, orderBy: { code: "asc" } });
  const branchId = vehicle?.branchId ?? branch?.id;
  if (!branchId) return { ok: false as const, errors: { branchId: "Sucursal inválida." } };
  const phone = normPhone(d.phone) ?? d.phone;
  const ref = d.vehicleId ?? `${d.brand ?? ""} ${d.model ?? ""}`.trim();
  const recent = await db.formSubmission.findFirst({
    where: { kind, createdAt: { gte: new Date(Date.now() - 600_000) }, AND: [{ payload: { path: ["phone"], equals: phone } }, { payload: { path: ["ref"], equals: ref } }] },
  });
  if (recent) return { ok: true as const, duplicate: true, opportunityId: recent.opportunityId };
  const dedupeHash = sha256(`${kind}|${token || `${phone}|${ref}|${Math.floor(Date.now() / 600_000)}`}`);
  try {
    await db.formSubmission.create({ data: { kind, dedupeHash, payload: { ...d, phone, ref, website: undefined } } });
  } catch {
    const prev = await db.formSubmission.findUnique({ where: { dedupeHash } });
    return { ok: true as const, duplicate: true, opportunityId: prev?.opportunityId ?? null };
  }
  const interest = kind === "CONSIGNACION" ? `Consignar ${d.brand} ${d.model} ${d.year}, ${d.km} km${d.expected ? `, espera ${d.expected}` : ""}` : vehicle ? `${vehicle.brand} ${vehicle.model} ${vehicle.year}` : null;
  const origin = { CONSULTA: "Consulta web", TEST_DRIVE: "Solicitud de test drive web", CONSIGNACION: "Formulario de consignación web" }[kind];
  const opp = await createLead({
    name: d.name, phone: d.phone, email: d.email || null, source: "WEB", branchId, vehicleId: vehicle?.id ?? null,
    type: kind === "CONSIGNACION" ? "CONSIGNACION" : "VENTA", interest, payMethod: d.payMethod ?? null,
    note: [origin, kind === "TEST_DRIVE" ? `Solicita test drive ${d.date.replace("T", " ")}` : null, d.message].filter(Boolean).join(" · "),
  }, null);
  if (kind === "TEST_DRIVE") {
    try {
      await createAppointment({ type: "TEST_DRIVE", startAt: fromLocalInput(d.date), branchId, vehicleId: vehicle!.id, opportunityId: opp.id, notes: "Solicitado desde la vitrina" }, null);
    } catch (e) {
      if (!(e instanceof AppError)) throw e;
      await db.activity.create({ data: { type: "SISTEMA", opportunityId: opp.id, body: `No se agendó automáticamente: ${e.message} Coordinar otro horario.`, userName: "Vitrina" } });
    }
  }
  await db.formSubmission.update({ where: { dedupeHash }, data: { opportunityId: opp.id } });
  return { ok: true as const, duplicate: false, opportunityId: opp.id };
}

export async function track(type: "VIEW" | "VEHICLE_VIEW" | "WHATSAPP_CLICK", path: string, visitor: string, vehicleId?: string | null) {
  await db.webEvent.create({ data: { type, path: path.slice(0, 200), visitor: sha256(visitor).slice(0, 16), vehicleId: vehicleId ?? null } });
}
