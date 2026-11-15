import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assert, type Actor } from "@/lib/rbac";
import { AppError } from "./errors";

/**
 * Integraciones externas. Las credenciales viven solo en variables de entorno del servidor; la base guarda
 * estado, última sincronización y último error. Sin credenciales: «Modo demo» (datos simulados) si el modo demo
 * está activo, o «Sin configurar» en caso contrario.
 */
export type IntegrationKey = "META_ADS" | "WA_META" | "YCLOUD" | "GA" | "GCAL";
type Def = { name: string; desc: string; env: string[]; test: () => Promise<string> };

const GRAPH = "https://graph.facebook.com/v21.0";
const env = (k: string) => process.env[k] ?? "";

/** Modo demo: por defecto activo fuera de producción. INTEGRATIONS_DEMO=0/1 lo fuerza. */
export const demoMode = () => (process.env.INTEGRATIONS_DEMO ? process.env.INTEGRATIONS_DEMO === "1" : process.env.NODE_ENV !== "production");

async function call(url: string, init: RequestInit = {}) {
  const r = await fetch(url, { ...init, signal: AbortSignal.timeout(8000), cache: "no-store" });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new AppError(`El proveedor respondió ${r.status}: ${String(body?.error?.message ?? body?.message ?? r.statusText).slice(0, 160)}`, 502);
  return body;
}

export const INTEGRATIONS: Record<IntegrationKey, Def> = {
  META_ADS: {
    name: "Meta Ads", desc: "Campañas y formularios de leads de Facebook e Instagram.", env: ["META_ADS_ACCESS_TOKEN", "META_AD_ACCOUNT_ID"],
    test: async () => (await call(`${GRAPH}/act_${env("META_AD_ACCOUNT_ID")}?fields=name&access_token=${env("META_ADS_ACCESS_TOKEN")}`)).name ?? "Cuenta publicitaria accesible",
  },
  WA_META: {
    name: "Meta WhatsApp", desc: "WhatsApp Business Cloud API (números con proveedor Meta).", env: ["WA_META_TOKEN", "WA_META_PHONE_NUMBER_ID", "WA_META_APP_SECRET", "WA_META_VERIFY_TOKEN"],
    test: async () => `Número ${(await call(`${GRAPH}/${env("WA_META_PHONE_NUMBER_ID")}?fields=display_phone_number`, { headers: { authorization: `Bearer ${env("WA_META_TOKEN")}` } })).display_phone_number}`,
  },
  YCLOUD: {
    name: "YCloud", desc: "Proveedor BSP de WhatsApp Business (números con proveedor YCloud).", env: ["YCLOUD_API_KEY", "YCLOUD_WEBHOOK_SECRET"],
    test: async () => `${(await call("https://api.ycloud.com/v2/whatsapp/phoneNumbers?limit=10", { headers: { "X-API-Key": env("YCLOUD_API_KEY") } })).items?.length ?? 0} números en la cuenta`,
  },
  GA: {
    name: "Google Analytics", desc: "GA4 Measurement Protocol para eventos de la vitrina.", env: ["GA_MEASUREMENT_ID", "GA_API_SECRET"],
    test: async () => {
      const r = await call(`https://www.google-analytics.com/debug/mp/collect?measurement_id=${env("GA_MEASUREMENT_ID")}&api_secret=${env("GA_API_SECRET")}`, {
        method: "POST", body: JSON.stringify({ client_id: "stroker.test", events: [{ name: "connection_test" }] }),
      });
      if (r.validationMessages?.length) throw new AppError(`GA rechazó el evento: ${r.validationMessages[0].description}`, 502);
      return "Evento de prueba validado";
    },
  },
  GCAL: {
    name: "Google Calendar", desc: "Envío de citas al calendario de cada vendedor.", env: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN"],
    test: async () => {
      await call("https://oauth2.googleapis.com/token", {
        method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: env("GOOGLE_CLIENT_ID"), client_secret: env("GOOGLE_CLIENT_SECRET"), refresh_token: env("GOOGLE_REFRESH_TOKEN"), grant_type: "refresh_token" }),
      });
      return "Token OAuth renovado";
    },
  },
};
export const INTEGRATION_KEYS = Object.keys(INTEGRATIONS) as IntegrationKey[];

export const missingEnv = (k: IntegrationKey) => INTEGRATIONS[k].env.filter((e) => !process.env[e]);

/** Datos simulados para el modo demo (no salen del servidor ni llaman a proveedores). */
async function demoSample(k: IntegrationKey) {
  const since = new Date(Date.now() - 7 * 864e5);
  switch (k) {
    case "META_ADS": return `${await db.opportunity.count({ where: { source: "REDES", createdAt: { gt: since } } })} leads de redes en 7 días (simulado)`;
    case "WA_META": case "YCLOUD": return `${await db.waNumber.count({ where: { provider: k === "WA_META" ? "META" : "YCLOUD" } })} número(s) autorizados (simulado)`;
    case "GA": return `${await db.webEvent.count({ where: { createdAt: { gt: since } } })} eventos web en 7 días (simulado)`;
    case "GCAL": return `${await db.appointment.count({ where: { startAt: { gt: new Date() }, status: { in: ["PROGRAMADA", "CONFIRMADA"] } } })} citas próximas listas para enviar (simulado)`;
  }
}

/** Estado efectivo: desconexión manual > credenciales faltantes (demo / sin configurar) > resultado de la última prueba. */
export async function getIntegrations() {
  const rows = await db.integration.findMany({ where: { key: { in: INTEGRATION_KEYS } } });
  return INTEGRATION_KEYS.map((key) => {
    const row = rows.find((r) => r.key === key);
    const missing = missingEnv(key);
    let status = row?.status ?? "SIN_CONFIGURAR";
    if (status !== "DESCONECTADO") {
      if (missing.length) status = demoMode() ? "DEMO" : "SIN_CONFIGURAR";
      else if (status === "DEMO" || status === "SIN_CONFIGURAR") status = "DESCONECTADO";
    }
    const { name, desc } = INTEGRATIONS[key];
    const cfg = (row?.config ?? {}) as { sample?: string };
    return { key, name, desc, status, missing, live: !missing.length, lastSyncAt: row?.lastSyncAt ?? null, lastError: row?.lastError ?? null, sample: cfg.sample ?? null };
  });
}
export async function integrationStatus(k: IntegrationKey) {
  return (await getIntegrations()).find((i) => i.key === k)!.status;
}

async function save(key: IntegrationKey, data: { status: string; lastSyncAt?: Date; lastError?: string | null; sample?: string }) {
  const prev = await db.integration.findUnique({ where: { key } });
  const config = { ...((prev?.config as object) ?? {}), ...(data.sample !== undefined ? { sample: data.sample } : {}) };
  const d = { status: data.status, lastError: data.lastError ?? null, config, ...(data.lastSyncAt ? { lastSyncAt: data.lastSyncAt } : {}) };
  await db.integration.upsert({ where: { key }, create: { key, ...d }, update: d });
}

export async function testIntegration(key: IntegrationKey, actor: Actor) {
  assert(actor, "integrations");
  const def = INTEGRATIONS[key];
  if (!def) throw new AppError("Integración desconocida.");
  const missing = missingEnv(key);
  let result: { ok: boolean; msg: string };
  if (missing.length) {
    if (!demoMode()) {
      await save(key, { status: "SIN_CONFIGURAR", lastError: `Faltan variables: ${missing.join(", ")}` });
      throw new AppError(`${def.name} sin configurar: faltan ${missing.join(", ")} en el servidor.`);
    }
    const sample = await demoSample(key);
    await save(key, { status: "DEMO", lastSyncAt: new Date(), sample });
    result = { ok: true, msg: `Prueba simulada correcta: ${sample}.` };
  } else {
    try {
      const msg = await def.test();
      await save(key, { status: "CONECTADO", lastSyncAt: new Date(), sample: msg });
      result = { ok: true, msg: `Conexión correcta: ${msg}.` };
    } catch (e) {
      const msg = e instanceof AppError ? e.message : "No se pudo contactar al proveedor.";
      await save(key, { status: "ERROR", lastError: msg });
      result = { ok: false, msg };
    }
  }
  await audit(actor, "integration.test", "Integration", key, `${def.name}: ${result.msg}`);
  if (!result.ok) throw new AppError(result.msg, 502);
  return result.msg;
}

/** Desconecta: deja de usar la integración hasta una nueva prueba. Las variables de entorno se retiran en el servidor. */
export async function disconnectIntegration(key: IntegrationKey, actor: Actor) {
  assert(actor, "integrations");
  if (!INTEGRATIONS[key]) throw new AppError("Integración desconocida.");
  await save(key, { status: "DESCONECTADO" });
  await audit(actor, "integration.disconnect", "Integration", key, `${INTEGRATIONS[key].name} desconectada`);
}
