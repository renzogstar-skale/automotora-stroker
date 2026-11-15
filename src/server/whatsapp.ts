import type { Prisma, WaNumber, WaProvider } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { hmacHex, safeEqual } from "@/lib/crypto";
import { assert, assertBranch, branchScope, oppScope, type Actor } from "@/lib/rbac";
import { AppError, notFound } from "./errors";
import { createLead } from "./crm";
import { integrationStatus } from "./integrations";

/**
 * Bandeja de WhatsApp. Cada número autorizado (WaNumber) usa un proveedor: Meta Cloud API o YCloud.
 * Los webhooks se aceptan solo con firma válida y para números registrados; providerMessageId es único,
 * así un reintento del proveedor o un doble envío desde el panel no duplica mensajes.
 */
const digits = (s: string) => s.replace(/\D/g, "");
const PROVIDER_INTEGRATION = { META: "WA_META", YCLOUD: "YCLOUD" } as const;

export function convScope(a: Actor): Prisma.ConversationWhereInput {
  const b = branchScope(a);
  return {
    ...(b ? { number: { branchId: { in: b } } } : {}),
    ...(a.role === "VENDEDOR" ? { OR: [{ assignedToId: a.id }, { assignedToId: null }] } : {}),
  };
}

/** Estado de conexión de un número: desactivado manualmente o el estado de la integración de su proveedor. */
export async function numberStatus(n: Pick<WaNumber, "status" | "provider">) {
  if (n.status === "DESACTIVADO") return "DESACTIVADO";
  return integrationStatus(PROVIDER_INTEGRATION[n.provider]);
}

export async function getConversation(id: string, a: Actor) {
  const c = await db.conversation.findFirst({
    where: { id, ...convScope(a) },
    include: { number: true, assignedTo: true, opportunity: { include: { contact: true, seller: true } }, messages: { orderBy: { sentAt: "asc" } } },
  });
  if (!c) throw notFound("Conversación no encontrada.");
  if (c.unread) await db.conversation.update({ where: { id }, data: { unread: 0 } });
  return c;
}

export async function assignConversation(id: string, userId: string | null, a: Actor) {
  assert(a, "whatsapp");
  const c = await getConversation(id, a);
  if (a.role === "VENDEDOR" && userId !== a.id && !(userId === null && c.assignedToId === a.id))
    throw new AppError("Solo puedes tomar o liberar tus propias conversaciones.", 403);
  if (userId) {
    const u = await db.user.findUnique({ where: { id: userId }, include: { branches: true } });
    if (!u?.active) throw new AppError("Usuario no válido.");
    if (u.role !== "ADMIN" && !u.branches.some((b) => b.branchId === c.number.branchId)) throw new AppError("El usuario no pertenece a la sucursal del número.");
  }
  await db.conversation.update({ where: { id }, data: { assignedToId: userId } });
  await audit(a, "whatsapp.assign", "Conversation", id, userId ? "Conversación asignada" : "Conversación liberada");
}

/** Vincula la conversación a un lead existente (misma sucursal y visible para el usuario) o la desvincula. */
export async function linkConversation(id: string, oppId: string | null, a: Actor) {
  assert(a, "whatsapp");
  const c = await getConversation(id, a);
  if (oppId) {
    const o = await db.opportunity.findFirst({ where: { id: oppId, deletedAt: null, ...oppScope(a) } });
    if (!o) throw notFound("Lead no encontrado.");
    if (o.branchId !== c.number.branchId) throw new AppError("El lead pertenece a otra sucursal.", 403);
    await db.$transaction([
      db.conversation.update({ where: { id }, data: { opportunityId: o.id } }),
      db.activity.create({ data: { type: "SISTEMA", opportunityId: o.id, contactId: o.contactId, body: `Conversación de WhatsApp (${c.number.label}) vinculada`, userId: a.id, userName: a.name } }),
    ]);
  } else await db.conversation.update({ where: { id }, data: { opportunityId: null } });
  await audit(a, "whatsapp.link", "Conversation", id, oppId ? `Vinculada al lead ${oppId}` : "Desvinculada del lead");
}

/** Crea un lead desde la conversación (origen WhatsApp) y lo vincula. */
export async function leadFromConversation(id: string, a: Actor) {
  assert(a, "crm");
  const c = await getConversation(id, a);
  if (c.opportunityId) throw new AppError("La conversación ya está vinculada a un lead.");
  assertBranch(a, c.number.branchId);
  const seller = c.assignedToId ? await db.seller.findUnique({ where: { userId: c.assignedToId } }) : null;
  const o = await createLead({
    name: c.contactName, phone: c.contactPhone, source: "WHATSAPP", branchId: c.number.branchId,
    sellerId: seller?.id ?? (a.role === "VENDEDOR" ? a.sellerId : null), note: c.messages.find((m) => m.direction === "IN")?.body.slice(0, 500),
  }, a);
  await linkConversation(id, o.id, a);
  return o;
}

async function providerSend(n: WaNumber, to: string, body: string): Promise<string> {
  if (n.provider === "META") {
    const r = await fetch(`https://graph.facebook.com/v21.0/${process.env.WA_META_PHONE_NUMBER_ID}/messages`, {
      method: "POST", signal: AbortSignal.timeout(10000),
      headers: { authorization: `Bearer ${process.env.WA_META_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: digits(to), type: "text", text: { body } }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new AppError(`Meta rechazó el envío: ${j?.error?.message ?? r.status}`, 502);
    return j.messages[0].id;
  }
  const r = await fetch("https://api.ycloud.com/v2/whatsapp/messages/sendDirectly", {
    method: "POST", signal: AbortSignal.timeout(10000),
    headers: { "X-API-Key": process.env.YCLOUD_API_KEY!, "content-type": "application/json" },
    body: JSON.stringify({ from: `+${digits(n.phone)}`, to: `+${digits(to)}`, type: "text", text: { body } }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new AppError(`YCloud rechazó el envío: ${j?.error?.message ?? r.status}`, 502);
  return j.wamid ?? j.id;
}

/**
 * Envía un mensaje. `clientId` lo genera el formulario: si el mismo envío se reintenta (doble clic, red),
 * el registro `out:<clientId>` ya existe y no se vuelve a enviar al proveedor.
 */
export async function sendMessage(id: string, body: string, clientId: string, a: Actor) {
  assert(a, "whatsapp");
  const text = body.trim();
  if (!text) throw new AppError("Escribe un mensaje.");
  if (text.length > 4096) throw new AppError("Máximo 4096 caracteres.");
  if (!/^[\w-]{8,64}$/.test(clientId)) throw new AppError("Envío no válido; recarga la página.");
  const c = await getConversation(id, a);
  if (a.role === "VENDEDOR" && c.assignedToId !== a.id) throw new AppError("Toma la conversación antes de responder.", 403);
  const status = await numberStatus(c.number);
  if (status === "DESACTIVADO" || status === "DESCONECTADO") throw new AppError("El número está desconectado; no se puede enviar.");
  if (status === "SIN_CONFIGURAR") throw new AppError("WhatsApp sin configurar: faltan credenciales del proveedor en el servidor.");
  const key = `out:${clientId}`;
  const prev = await db.waMessage.findUnique({ where: { clientKey: key } });
  if (prev) return { message: prev, duplicate: true };
  let m;
  try {
    m = await db.waMessage.create({ data: { conversationId: id, direction: "OUT", body: text, providerMessageId: `pending:${key}`, clientKey: key, status: "PENDIENTE" } });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return { message: await db.waMessage.findUniqueOrThrow({ where: { clientKey: key } }), duplicate: true };
    throw e;
  }
  try {
    const providerId = status === "DEMO" ? `demo-${key}` : await providerSend(c.number, c.contactPhone, text);
    m = await db.waMessage.update({ where: { id: m.id }, data: { providerMessageId: providerId, status: "ENVIADO" } });
  } catch (e) {
    // El registro queda en ERROR con su clientKey: un reintento con el mismo clientId no reenvía.
    if (!(e instanceof AppError)) console.error(e);
    await db.waMessage.update({ where: { id: m.id }, data: { status: "ERROR", providerMessageId: `error:${key}` } });
    throw e instanceof AppError ? e : new AppError("No se pudo enviar el mensaje.", 502);
  }
  await db.conversation.update({ where: { id }, data: { lastMessageAt: m.sentAt } });
  if (c.opportunityId) await db.activity.create({ data: { type: "MENSAJE", opportunityId: c.opportunityId, contactId: c.opportunity?.contactId, body: `WhatsApp enviado: ${text.slice(0, 200)}`, userId: a.id, userName: a.name } });
  return { message: m, duplicate: false };
}

// ---------- Números autorizados ----------

export async function addNumber(i: { phone: string; label: string; provider: WaProvider; branchId: string }, a: Actor) {
  assert(a, "integrations");
  const d = digits(i.phone);
  if (d.length < 8 || d.length > 15) throw new AppError("Teléfono no válido (formato internacional, p. ej. +56912345678).");
  if (!i.label.trim()) throw new AppError("Indica una etiqueta.");
  if (await db.waNumber.findUnique({ where: { phone: `+${d}` } })) throw new AppError("Ese número ya está registrado.");
  const n = await db.waNumber.create({ data: { phone: `+${d}`, label: i.label.trim(), provider: i.provider, branchId: i.branchId, status: "ACTIVO" } });
  await audit(a, "whatsapp.number.add", "WaNumber", n.id, `Número ${n.phone} autorizado (${i.provider})`);
}
export async function setNumberActive(id: string, active: boolean, a: Actor) {
  assert(a, "integrations");
  await db.waNumber.update({ where: { id }, data: { status: active ? "ACTIVO" : "DESACTIVADO" } });
  await audit(a, "whatsapp.number.status", "WaNumber", id, active ? "Número reactivado" : "Número desactivado");
}

// ---------- Webhooks ----------

/** Meta: X-Hub-Signature-256 = "sha256=" + HMAC-SHA256(app secret, cuerpo crudo). */
export function verifyMeta(raw: string, header: string | null) {
  const secret = process.env.WA_META_APP_SECRET;
  if (!secret || !header?.startsWith("sha256=")) return false;
  return safeEqual(header.slice(7), hmacHex(secret, raw));
}
/** YCloud: YCloud-Signature = "t=<unix>,s=<hex>", con s = HMAC-SHA256(secreto del endpoint, "<t>.<cuerpo>"). Tolerancia 5 min. */
export function verifyYcloud(raw: string, header: string | null, now = Date.now()) {
  const secret = process.env.YCLOUD_WEBHOOK_SECRET;
  if (!secret || !header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.trim().split("=", 2) as [string, string]));
  const t = Number(parts.t);
  if (!t || !parts.s || Math.abs(now / 1000 - t) > 300) return false;
  return safeEqual(parts.s, hmacHex(secret, `${parts.t}.${raw}`));
}

export type Inbound = { id: string; from: string; to: string; name?: string; body: string; at?: Date };
export type StatusUpdate = { ids: string[]; status: string };
const STATUS_MAP: Record<string, string> = { sent: "ENVIADO", delivered: "ENTREGADO", read: "LEIDO", failed: "ERROR" };

/** Registra mensajes entrantes. Ignora números no autorizados y mensajes ya registrados (reintentos del proveedor). */
export async function receiveInbound(provider: WaProvider, msgs: Inbound[]) {
  let created = 0, duplicates = 0, ignored = 0;
  for (const m of msgs) {
    const number = (await db.waNumber.findMany({ where: { provider, status: { not: "DESACTIVADO" } } })).find((n) => digits(n.phone) === digits(m.to));
    if (!number) { ignored++; continue; }
    if (await db.waMessage.findUnique({ where: { providerMessageId: m.id } })) { duplicates++; continue; }
    const phone = `+${digits(m.from)}`;
    let conv = await db.conversation.findUnique({ where: { numberId_contactPhone: { numberId: number.id, contactPhone: phone } } });
    if (!conv) {
      // Vínculo automático: lead abierto más reciente del mismo teléfono en la sucursal del número.
      const opp = await db.opportunity.findFirst({
        where: { branchId: number.branchId, closedAt: null, deletedAt: null, contact: { phone: { in: [phone, digits(m.from), `+${digits(m.from).slice(-11)}`] } } },
        include: { seller: true }, orderBy: { createdAt: "desc" },
      });
      conv = await db.conversation.upsert({
        where: { numberId_contactPhone: { numberId: number.id, contactPhone: phone } }, update: {},
        create: { numberId: number.id, contactPhone: phone, contactName: m.name?.slice(0, 120) || phone, opportunityId: opp?.id ?? null, assignedToId: opp?.seller?.userId ?? null },
      });
    }
    try {
      await db.$transaction([
        db.waMessage.create({ data: { conversationId: conv.id, direction: "IN", body: m.body.slice(0, 4096), providerMessageId: m.id, sentAt: m.at ?? new Date(), status: "RECIBIDO" } }),
        db.conversation.update({ where: { id: conv.id }, data: { unread: { increment: 1 }, lastMessageAt: m.at ?? new Date() } }),
      ]);
      created++;
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") { duplicates++; continue; }
      throw e;
    }
  }
  return { created, duplicates, ignored };
}

export async function applyStatuses(updates: StatusUpdate[]) {
  let n = 0;
  for (const u of updates) {
    const status = STATUS_MAP[u.status];
    if (status) n += (await db.waMessage.updateMany({ where: { providerMessageId: { in: u.ids.filter(Boolean) }, direction: "OUT" }, data: { status } })).count;
  }
  return n;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- payloads externos: se leen campo a campo con encadenamiento opcional. */
/** Normaliza el payload de Meta (entry[].changes[].value). */
export function parseMeta(p: any): { inbound: Inbound[]; statuses: StatusUpdate[] } {
  const inbound: Inbound[] = [], statuses: StatusUpdate[] = [];
  for (const e of p?.entry ?? []) for (const ch of e?.changes ?? []) {
    const v = ch?.value ?? {};
    const to = v.metadata?.display_phone_number ?? "";
    for (const m of v.messages ?? [])
      inbound.push({ id: String(m.id), from: String(m.from), to, name: v.contacts?.find((c: any) => c.wa_id === m.from)?.profile?.name, body: m.text?.body ?? `[${m.type}]`, at: m.timestamp ? new Date(Number(m.timestamp) * 1000) : undefined });
    for (const s of v.statuses ?? []) statuses.push({ ids: [String(s.id)], status: s.status });
  }
  return { inbound, statuses };
}
/** Normaliza el payload de YCloud (eventos whatsapp.inbound_message.received / whatsapp.message.updated). */
export function parseYcloud(p: any): { inbound: Inbound[]; statuses: StatusUpdate[] } {
  if (p?.type === "whatsapp.inbound_message.received" && p.whatsappInboundMessage) {
    const m = p.whatsappInboundMessage;
    return { inbound: [{ id: String(m.wamid ?? m.id), from: m.from, to: m.to, name: m.customerProfile?.name, body: m.text?.body ?? `[${m.type}]`, at: m.sendTime ? new Date(m.sendTime) : undefined }], statuses: [] };
  }
  if (p?.type === "whatsapp.message.updated" && p.whatsappMessage)
    return { inbound: [], statuses: [{ ids: [p.whatsappMessage.wamid, p.whatsappMessage.id], status: p.whatsappMessage.status }] };
  return { inbound: [], statuses: [] };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
