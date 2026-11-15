import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { randomToken, sha256 } from "@/lib/crypto";
import { assert, type Actor } from "@/lib/rbac";
import { AppError } from "./errors";

export const API_PERMS = ["leads:write", "appointments:write"] as const;

/** Genera una clave por sucursal. El secreto se devuelve una sola vez; se guarda solo su hash. */
export async function createApiKey(name: string, branchId: string, permissions: string[], actor: Actor) {
  assert(actor, "integrations");
  name = name.trim();
  permissions = permissions.filter((p) => (API_PERMS as readonly string[]).includes(p));
  if (name.length < 3 || name.length > 80) throw new AppError("Indica un nombre descriptivo (3 a 80 caracteres).");
  if (!permissions.length) throw new AppError("Elige al menos un permiso.");
  if (!(await db.branch.findUnique({ where: { id: branchId } }))) throw new AppError("Sucursal no válida.");
  const secret = `stk_${randomToken(24)}`;
  const k = await db.apiKey.create({
    data: { name, branchId, permissions, prefix: secret.slice(0, 10), hash: sha256(secret), createdBy: actor.name },
  });
  await audit(actor, "apikey.create", "ApiKey", k.id, `Clave «${name}» creada`);
  return { key: k, secret };
}
export async function revokeApiKey(id: string, actor: Actor) {
  assert(actor, "integrations");
  const k = await db.apiKey.findUnique({ where: { id } });
  if (!k) throw new AppError("Clave no encontrada.", 404);
  if (k.revokedAt) throw new AppError("La clave ya estaba revocada.");
  await db.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
  await audit(actor, "apikey.revoke", "ApiKey", id, "Clave revocada");
}
