import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import type { Actor } from "@/lib/rbac";
import { AppError } from "./errors";
import { integrationStatus } from "./integrations";

/**
 * Configuración de Google Calendar (fase de integraciones). Aquí solo se guarda el mapeo y las preferencias;
 * el OAuth y el envío de eventos (Appointment.googleEventId) se activan en la fase de integraciones.
 * Las credenciales del cliente OAuth van en variables de entorno (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET), nunca en la base.
 */
export type GcalConfig = {
  enabled: boolean; direction: "PUSH" | "BIDIRECCIONAL"; types: string[]; reminderMin: number;
  calendars: Record<string, string>; // sellerId → calendarId (correo del calendario)
};
const DEF: GcalConfig = { enabled: false, direction: "PUSH", types: ["TEST_DRIVE", "REUNION", "ENTREGA", "SERVICIO"], reminderMin: 30, calendars: {} };

export async function getGcal() {
  const row = await db.integration.findUnique({ where: { key: "GCAL" } });
  return { status: await integrationStatus("GCAL"), config: { ...DEF, ...((row?.config as Partial<GcalConfig>) ?? {}) }, lastSyncAt: row?.lastSyncAt ?? null, oauthReady: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) };
}

export async function saveGcal(c: GcalConfig, actor: Actor) {
  const bad = Object.values(c.calendars).find((v) => v && !/^[^\s@]+@[^\s@]+$/.test(v));
  if (bad) throw new AppError(`Calendario no válido: ${bad}`);
  if (c.reminderMin < 0 || c.reminderMin > 1440) throw new AppError("Recordatorio entre 0 y 1440 minutos.");
  // El estado de conexión lo gestiona integrations.ts (prueba/desconexión); aquí solo se guarda la configuración.
  const prev = await db.integration.findUnique({ where: { key: "GCAL" } });
  const config = JSON.parse(JSON.stringify({ ...((prev?.config as object) ?? {}), ...c }));
  await db.integration.upsert({ where: { key: "GCAL" }, create: { key: "GCAL", config }, update: { config } });
  await audit(actor, "integration.gcal", "Integration", "GCAL", "Configuración de Google Calendar actualizada");
}
