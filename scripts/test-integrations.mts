// Ingesta n8n/agenda (creación, reintento, idempotencia, conflicto, clave revocada, sucursal, límite), webhooks de WhatsApp
// (firma y duplicados), envío sin duplicar e integraciones (demo / sin configurar). Requiere `npm run dev`.
// Uso: APP_URL=http://localhost:3000 npx tsx scripts/test-integrations.mts
import "dotenv/config";
import { db } from "../src/lib/db";
import { hmacHex, randomToken } from "../src/lib/crypto";
import type { Actor } from "../src/lib/rbac";
import { createApiKey, revokeApiKey } from "../src/server/apikeys";
import { sendMessage } from "../src/server/whatsapp";
import { disconnectIntegration, getIntegrations, testIntegration } from "../src/server/integrations";

const BASE = process.env.APP_URL ?? "http://localhost:3000";
let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, info = "") => { if (cond) pass++; else fail++; console.log(`${cond ? "PASS" : "FAIL"}  ${name}${info && !cond ? ` — ${info}` : ""}`); };

async function actor(email: string): Promise<Actor> {
  const u = await db.user.findUniqueOrThrow({ where: { email }, include: { branches: true, seller: true } });
  return { id: u.id, name: u.name, email: u.email, role: u.role, canPublish: u.canPublish, branchIds: u.branches.map((b) => b.branchId), sellerId: u.seller?.id ?? null };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function post(path: string, body: unknown, key?: string, headers: Record<string, string> = {}): Promise<{ status: number; json: any; replay: boolean }> {
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  const r = await fetch(BASE + path, { method: "POST", body: raw, headers: { "content-type": "application/json", ...(key ? { "x-api-key": key } : {}), ...headers } });
  const text = await r.text();
  let json = {};
  try { json = JSON.parse(text); } catch { json = { text: text.slice(0, 200) }; }
  return { status: r.status, json, replay: r.headers.get("idempotent-replay") === "true" };
}

const run = randomToken(4).replace(/[^a-z0-9]/gi, "x");
const admin = await actor("dueno@stroker.demo");
const SCL = await db.branch.findUniqueOrThrow({ where: { code: "SCL" } });
const VIN = await db.branch.findUniqueOrThrow({ where: { code: "VIN" } });
const keySCL = (await createApiKey(`test ${run} SCL`, SCL.id, ["leads:write", "appointments:write"], admin)).secret;
const keyVIN = (await createApiKey(`test ${run} VIN`, VIN.id, ["leads:write", "appointments:write"], admin)).secret;
const keyLeadsOnly = (await createApiKey(`test ${run} solo leads`, SCL.id, ["leads:write"], admin)).secret;
const seller = await db.seller.findFirstOrThrow({ where: { branchId: SCL.id, active: true } });
// Hora futura aleatoria (día +45..+75, horario hábil) para no chocar con citas de corridas anteriores.
const base = new Date(Date.now() + (45 + Math.floor(Math.random() * 30)) * 864e5);
base.setUTCHours(13 + Math.floor(Math.random() * 7), [0, 15, 30, 45][Math.floor(Math.random() * 4)], 0, 0);
const start = base.toISOString();
const phone = `+5699${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;

console.log("\n— Ingesta de leads —");
const lead = { external_id: `ext-${run}`, name: "Prueba Integración", phone, source: "facebook", interest: "SUV", appointment: { start, type: "test_drive", duration_minutes: 60 } };
const c1 = await post("/api/n8n-lead-ingest", lead, keySCL);
ok("Creación de lead → 201 con lead_id y cita", c1.status === 201 && c1.json.created === true && !!c1.json.lead_id && !!c1.json.appointment_id, JSON.stringify(c1.json));
const c2 = await post("/api/n8n-lead-ingest", lead, keySCL);
ok("Reintento idéntico → misma respuesta (replay)", c2.status === 201 && c2.replay && c2.json.lead_id === c1.json.lead_id && c2.json.appointment_id === c1.json.appointment_id, JSON.stringify(c2));
ok("Reintento no duplica lead ni cita", (await db.opportunity.count({ where: { externalId: `ext-${run}` } })) === 1 && (await db.appointment.count({ where: { opportunityId: c1.json.lead_id } })) === 1);
const c3 = await post("/api/n8n-lead-ingest", { ...lead, interest: "SUV 7 asientos", appointment: undefined }, keySCL);
ok("Mismo external_id con cambios → 200 actualiza (created=false)", c3.status === 200 && c3.json.created === false && c3.json.lead_id === c1.json.lead_id, JSON.stringify(c3));
ok("Actualización aplicada", (await db.opportunity.findUnique({ where: { id: c1.json.lead_id } }))?.interest === "SUV 7 asientos");
const idem = `idem-${run}`;
const i1 = await post("/api/n8n-lead-ingest", { ...lead, external_id: `ext-${run}-b`, appointment: undefined }, keySCL, { "idempotency-key": idem });
const i2 = await post("/api/n8n-lead-ingest", { ...lead, external_id: `ext-${run}-c`, appointment: undefined }, keySCL, { "idempotency-key": idem });
ok("Idempotency-Key reutilizada con otro cuerpo → 422", i1.status === 201 && i2.status === 422, `${i1.status}/${i2.status} ${JSON.stringify(i2.json)}`);
const v1 = await post("/api/n8n-lead-ingest", { external_id: "x" }, keySCL);
ok("Cuerpo inválido → 422 con detalle", v1.status === 422 && Array.isArray(v1.json.issues));
ok("JSON inválido → 400", (await post("/api/n8n-lead-ingest", "{no-json", keySCL)).status === 400);
ok("Sin x-api-key → 401", (await post("/api/n8n-lead-ingest", lead)).status === 401);
ok("Clave inexistente → 401", (await post("/api/n8n-lead-ingest", lead, "stk_inventada")).status === 401);

console.log("\n— Conflicto de agenda —");
const sStart = new Date(base.getTime() + 2 * 864e5).toISOString();
const a1 = await post("/api/appointment-ingest", { external_id: `appt-${run}-1`, start: sStart, type: "reunion", seller_email: seller.email }, keySCL);
ok("Cita con vendedor → 201", a1.status === 201 && a1.json.created === true, JSON.stringify(a1.json));
const a2 = await post("/api/appointment-ingest", { external_id: `appt-${run}-2`, start: sStart, type: "reunion", seller_email: seller.email }, keySCL);
ok("Misma hora y vendedor → 409 conflicto", a2.status === 409, JSON.stringify(a2.json));
const a2b = await post("/api/appointment-ingest", { external_id: `appt-${run}-2`, start: sStart, type: "reunion", seller_email: seller.email }, keySCL);
ok("Reintento del conflicto → mismo 409 (replay, sin crear)", a2b.status === 409 && a2b.replay && (await db.appointment.count({ where: { externalId: `appt-${run}-2` } })) === 0);
const a3 = await post("/api/appointment-ingest", { external_id: `appt-${run}-3`, start: new Date(base.getTime() + 3 * 864e5).toISOString(), lead_external_id: `ext-${run}` }, keySCL);
ok("Cita vinculada a lead existente por lead_external_id → 201", a3.status === 201 && a3.json.lead_id === c1.json.lead_id, JSON.stringify(a3.json));
const a3b = await post("/api/appointment-ingest", { external_id: `appt-${run}-3`, start: new Date(base.getTime() + 3 * 864e5).toISOString(), notes: "cambio" }, keySCL);
ok("Mismo external_id de cita → 200 sin duplicar", a3b.status === 200 && a3b.json.created === false && a3b.json.appointment_id === a3.json.appointment_id);
ok("appointment-ingest no crea leads (lead inexistente → 404)", (await post("/api/appointment-ingest", { external_id: `appt-${run}-4`, start: sStart, lead_external_id: "no-existe" }, keySCL)).status === 404);

console.log("\n— Restricción por sucursal —");
ok("branch_code de otra sucursal → 403", (await post("/api/n8n-lead-ingest", { ...lead, external_id: `ext-${run}-e`, branch_code: "VIN" }, keySCL)).status === 403);
const vinLead = await post("/api/n8n-lead-ingest", { ...lead, external_id: `ext-${run}`, appointment: undefined }, keyVIN);
const vinOpp = await db.opportunity.findUnique({ where: { id: vinLead.json.lead_id } });
ok("Clave de Viña crea el lead en Viña (sucursal derivada de la clave)", vinLead.status === 201 && vinOpp?.branchId === VIN.id, JSON.stringify(vinLead.json));
ok("Mismo external_id en otra sucursal es otro lead", vinLead.json.lead_id !== c1.json.lead_id);
const x1 = await post("/api/appointment-ingest", { external_id: `appt-${run}-x`, start: sStart, lead_id: vinLead.json.lead_id }, keySCL);
ok("Clave de Santiago no puede citar un lead de Viña (lead_id) → 403", x1.status === 403, JSON.stringify(x1.json));
ok("Clave sin appointments:write → 403", (await post("/api/appointment-ingest", { external_id: `appt-${run}-z`, start: sStart }, keyLeadsOnly)).status === 403);

console.log("\n— Clave revocada —");
const revoked = await createApiKey(`test ${run} revocar`, SCL.id, ["leads:write"], admin);
ok("Antes de revocar → 201", (await post("/api/n8n-lead-ingest", { ...lead, external_id: `ext-${run}-r1`, appointment: undefined }, revoked.secret)).status === 201);
await revokeApiKey(revoked.key.id, admin);
const rv = await post("/api/n8n-lead-ingest", { ...lead, external_id: `ext-${run}-r2`, appointment: undefined }, revoked.secret);
ok("Después de revocar → 401 «Clave revocada»", rv.status === 401 && /revocada/i.test(rv.json.error), JSON.stringify(rv.json));
ok("El secreto no se guarda en claro (solo hash y prefijo)", !(await db.apiKey.findFirst({ where: { hash: revoked.secret } })) && revoked.key.hash !== revoked.secret);

console.log("\n— Límite de solicitudes —");
const rl = (await createApiKey(`test ${run} límite`, SCL.id, ["leads:write"], admin)).secret;
const limit = Number(process.env.INGEST_RATE_PER_MIN ?? 60);
let got429 = false;
for (let i = 0; i <= limit && !got429; i++) got429 = (await post("/api/n8n-lead-ingest", { external_id: `rl${i}` }, rl)).status === 429;
ok(`Más de ${limit} solicitudes/min → 429`, got429);

console.log("\n— Webhooks de WhatsApp —");
const sclNum = await db.waNumber.findFirstOrThrow({ where: { provider: "META", branchId: SCL.id } });
const vinNum = await db.waNumber.findFirstOrThrow({ where: { provider: "YCLOUD" } });
const wamid = `wamid.${run}`;
const metaBody = JSON.stringify({ object: "whatsapp_business_account", entry: [{ changes: [{ value: { metadata: { display_phone_number: sclNum.phone.replace("+", ""), phone_number_id: "1" }, contacts: [{ wa_id: phone.slice(1), profile: { name: "Cliente Webhook" } }], messages: [{ id: wamid, from: phone.slice(1), timestamp: String(Math.floor(Date.now() / 1000)), type: "text", text: { body: "Hola, ¿sigue disponible?" } }] } }] }] });
const metaSig = `sha256=${hmacHex(process.env.WA_META_APP_SECRET!, metaBody)}`;
const m1 = await post("/api/webhooks/whatsapp/meta", metaBody, undefined, { "x-hub-signature-256": metaSig });
ok("Meta firmado → mensaje creado", m1.status === 200 && m1.json.created === 1, JSON.stringify(m1.json));
const m2 = await post("/api/webhooks/whatsapp/meta", metaBody, undefined, { "x-hub-signature-256": metaSig });
ok("Reintento de Meta → duplicado ignorado", m2.status === 200 && m2.json.created === 0 && m2.json.duplicates === 1, JSON.stringify(m2.json));
ok("Un solo mensaje guardado", (await db.waMessage.count({ where: { providerMessageId: wamid } })) === 1);
const conv = await db.conversation.findFirst({ where: { numberId: sclNum.id, contactPhone: phone } });
const newest = await db.opportunity.findFirst({ where: { branchId: SCL.id, closedAt: null, deletedAt: null, contact: { phone } }, orderBy: { createdAt: "desc" } });
ok("Conversación vinculada automáticamente al lead abierto más reciente del teléfono", !!conv?.opportunityId && conv.opportunityId === newest?.id, `${conv?.opportunityId} vs ${newest?.id}`);
ok("Firma inválida → 401", (await post("/api/webhooks/whatsapp/meta", metaBody, undefined, { "x-hub-signature-256": "sha256=00" })).status === 401);
const other = metaBody.replace(sclNum.phone.replace("+", ""), "56900000000").replace(wamid, `${wamid}.otro`);
const m3 = await post("/api/webhooks/whatsapp/meta", other, undefined, { "x-hub-signature-256": `sha256=${hmacHex(process.env.WA_META_APP_SECRET!, other)}` });
ok("Número no autorizado → ignorado", m3.status === 200 && m3.json.ignored === 1);
const yBody = JSON.stringify({ type: "whatsapp.inbound_message.received", whatsappInboundMessage: { id: `yc-${run}`, wamid: `wamid.yc.${run}`, from: phone, to: vinNum.phone, customerProfile: { name: "Cliente YCloud" }, type: "text", text: { body: "Hola Viña" } } });
const t = Math.floor(Date.now() / 1000);
const y1 = await post("/api/webhooks/whatsapp/ycloud", yBody, undefined, { "ycloud-signature": `t=${t},s=${hmacHex(process.env.YCLOUD_WEBHOOK_SECRET!, `${t}.${yBody}`)}` });
ok("YCloud firmado → mensaje creado", y1.status === 200 && y1.json.created === 1, JSON.stringify(y1.json));
const told = t - 900;
ok("YCloud con timestamp vencido → 401", (await post("/api/webhooks/whatsapp/ycloud", yBody, undefined, { "ycloud-signature": `t=${told},s=${hmacHex(process.env.YCLOUD_WEBHOOK_SECRET!, `${told}.${yBody}`)}` })).status === 401);

console.log("\n— Envío desde el panel sin duplicar —");
const clientId = `test${run}abcd`;
const s1 = await sendMessage(conv!.id, "Sí, sigue disponible", clientId, admin);
const s2 = await sendMessage(conv!.id, "Sí, sigue disponible", clientId, admin);
ok("Doble envío con el mismo clientId → un solo mensaje", !s1.duplicate && s2.duplicate && s1.message.id === s2.message.id);
ok("En demo el envío queda ENVIADO (simulado)", s1.message.status === "ENVIADO" && s1.message.providerMessageId.startsWith("demo-"));

console.log("\n— Integraciones —");
const st = await getIntegrations();
ok("5 tarjetas: Meta Ads, Meta WhatsApp, YCloud, GA, GCal", st.map((i) => i.key).join() === "META_ADS,WA_META,YCLOUD,GA,GCAL");
ok("Sin credenciales en demo → «Modo demo»", st.every((i) => i.status === "DEMO" || i.status === "DESCONECTADO"), st.map((i) => `${i.key}:${i.status}`).join(" "));
const msg = await testIntegration("GA", admin);
ok("Prueba de conexión simulada registra última sincronización", /simulad/i.test(msg) && !!(await getIntegrations()).find((i) => i.key === "GA")?.lastSyncAt);
await disconnectIntegration("META_ADS", admin);
ok("Desconectar → «Desconectado»", (await getIntegrations()).find((i) => i.key === "META_ADS")?.status === "DESCONECTADO");
await testIntegration("META_ADS", admin);
process.env.INTEGRATIONS_DEMO = "0";
ok("Sin modo demo y sin credenciales → «Sin configurar»", (await getIntegrations()).every((i) => i.status === "SIN_CONFIGURAR"));
let blocked = false;
try { await testIntegration("GA", admin); } catch (e) { blocked = /sin configurar/i.test((e as Error).message); }
ok("Prueba sin credenciales fuera de demo → error «sin configurar»", blocked);
delete process.env.INTEGRATIONS_DEMO;
await testIntegration("GA", admin);

console.log(`\n${pass} PASS, ${fail} FAIL`);
await db.$disconnect();
process.exit(fail ? 1 : 0);
