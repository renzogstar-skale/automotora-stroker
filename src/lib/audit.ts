import { db, type Tx } from "./db";
import type { Actor } from "./rbac";

/** Registra quién hizo el cambio, cuándo y qué registro afectó. */
export function audit(
  actor: Pick<Actor, "id" | "name"> | null, action: string, entity: string, entityId: string, summary: string,
  data?: unknown, tx: Tx | typeof db = db,
) {
  return tx.auditLog.create({
    data: {
      userId: actor?.id ?? null, actorName: actor?.name ?? "Sistema", action, entity, entityId, summary,
      data: data === undefined ? undefined : JSON.parse(JSON.stringify(data)),
    },
  });
}
export async function sendMail(to: string, subject: string, body: string) {
  await db.emailOutbox.create({ data: { to, subject, body } });
  if (process.env.NODE_ENV !== "test") console.log(`[correo simulado] ${to} · ${subject}`);
}
