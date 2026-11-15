import "server-only";
import { z } from "zod";
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { audit, sendMail } from "@/lib/audit";
import { randomToken, sha256 } from "@/lib/crypto";
import { assert, Forbidden, type Actor } from "@/lib/rbac";
import { AppError, conflict, notFound } from "./errors";

const ROLES = ["ADMIN", "GERENCIA", "VENDEDOR", "FINANZAS", "FOTOGRAFO"] as const;

/** Emite un enlace de un solo uso (invitación 72 h, recuperación 1 h). Invalida los enlaces previos del mismo tipo. */
export async function issueToken(userId: string, email: string, kind: "RESET" | "INVITE") {
  const token = randomToken();
  await db.authToken.updateMany({ where: { userId, kind, usedAt: null }, data: { usedAt: new Date() } });
  await db.authToken.create({ data: { kind, tokenHash: sha256(token), userId, expiresAt: new Date(Date.now() + (kind === "INVITE" ? 72 : 1) * 3600e3) } });
  const url = `${process.env.APP_URL ?? "http://localhost:3000"}/restablecer?token=${token}`;
  await sendMail(email, kind === "INVITE" ? "Invitación a Stroker Gestión" : "Restablece tu contraseña", `Abre este enlace para ${kind === "INVITE" ? "activar tu cuenta" : "crear una nueva contraseña"}: ${url}`);
}

/** Vínculo con la ficha comercial: "new" crea una ficha, "" la quita, otro valor = Seller.id (identificador estable). */
const AccessInput = z.object({
  role: z.enum(ROLES),
  branchIds: z.array(z.string().min(1)).min(1, "Asigna al menos una sucursal."),
  canPublish: z.boolean(),
  seller: z.string(),
});
const InviteInput = AccessInput.extend({
  name: z.string().trim().min(3, "Ingresa el nombre completo."),
  email: z.string().trim().toLowerCase().email("Correo no válido."),
});
export type AccessInput = z.infer<typeof AccessInput>;
export type InviteInput = z.infer<typeof InviteInput>;

const parse = <T>(s: z.ZodType<T>, v: unknown) => {
  const r = s.safeParse(v);
  if (!r.success) throw new AppError(r.error.issues[0]?.message ?? "Datos no válidos.");
  return r.data;
};

async function checkBranches(ids: string[]) {
  const n = await db.branch.count({ where: { id: { in: ids } } });
  if (n !== new Set(ids).size) throw new AppError("Sucursal no válida.");
}

/** Resuelve la ficha de vendedor a vincular. Un vendedor siempre necesita ficha (de ella depende su cartera). */
async function resolveSeller(userId: string, name: string, email: string, i: AccessInput) {
  if (i.role === "VENDEDOR" && !i.seller) throw new AppError("Un vendedor debe tener ficha comercial: elige una existente o crea una nueva.");
  if (!i.seller) return null;
  if (i.seller === "new") {
    const s = await db.seller.create({ data: { userId, name, email, phone: "", branchId: i.branchIds[0] } });
    return s.id;
  }
  const s = await db.seller.findUnique({ where: { id: i.seller } });
  if (!s) throw notFound("Ficha de vendedor no encontrada.");
  if (s.userId && s.userId !== userId) throw conflict("Esa ficha ya está vinculada a otra cuenta.");
  if (!i.branchIds.includes(s.branchId)) throw new AppError("La ficha pertenece a una sucursal que no está asignada a la cuenta.");
  if (s.userId !== userId) await db.seller.update({ where: { id: s.id }, data: { userId } });
  return s.id;
}

async function adminsLeft(excludeId: string) {
  return db.user.count({ where: { role: "ADMIN", active: true, id: { not: excludeId } } });
}

export async function inviteUser(actor: Actor, raw: unknown) {
  assert(actor, "users");
  const i = parse(InviteInput, raw);
  await checkBranches(i.branchIds);
  if (await db.user.findUnique({ where: { email: i.email } })) throw conflict("Ya existe una cuenta con ese correo.");
  const u = await db.user.create({
    data: { name: i.name, email: i.email, role: i.role, canPublish: i.canPublish, branches: { create: i.branchIds.map((branchId) => ({ branchId })) } },
  });
  try {
    const sellerId = await resolveSeller(u.id, u.name, u.email, i);
    await issueToken(u.id, u.email, "INVITE");
    await audit(actor, "user.invite", "User", u.id, `Invitó a ${u.name} (${i.role})`, { role: i.role, branchIds: i.branchIds, canPublish: i.canPublish, sellerId });
  } catch (e) {
    await db.seller.updateMany({ where: { userId: u.id }, data: { userId: null } });
    await db.user.delete({ where: { id: u.id } }); // sin historial aún: deshace la cuenta a medio crear
    throw e;
  }
  return u;
}

/** Cambia rol, sucursales, permiso de publicación y ficha vinculada. Queda en auditoría con antes/después. */
export async function updateAccess(actor: Actor, userId: string, raw: unknown) {
  assert(actor, "users");
  const i = parse(AccessInput, raw);
  await checkBranches(i.branchIds);
  const u = await db.user.findUnique({ where: { id: userId }, include: { branches: true, seller: true } });
  if (!u) throw notFound("Cuenta no encontrada.");
  if (u.id === actor.id && i.role !== u.role) throw new Forbidden("No puedes cambiar tu propio rol.");
  if (u.role === "ADMIN" && i.role !== "ADMIN" && u.active && (await adminsLeft(u.id)) === 0) throw conflict("Debe quedar al menos un administrador activo.");
  const before = { role: u.role, branchIds: u.branches.map((b) => b.branchId).sort(), canPublish: u.canPublish, sellerId: u.seller?.id ?? null };
  if (u.seller && u.seller.id !== i.seller) await db.seller.update({ where: { id: u.seller.id }, data: { userId: null } });
  const sellerId = await resolveSeller(u.id, u.name, u.email, i);
  await db.$transaction([
    db.userBranch.deleteMany({ where: { userId } }),
    db.userBranch.createMany({ data: i.branchIds.map((branchId) => ({ userId, branchId })) }),
    db.user.update({ where: { id: userId }, data: { role: i.role as Role, canPublish: i.canPublish } }),
  ]);
  const after = { role: i.role, branchIds: [...i.branchIds].sort(), canPublish: i.canPublish, sellerId };
  const changed = (Object.keys(after) as (keyof typeof after)[]).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
  if (changed.length) await audit(actor, "user.permissions", "User", userId, `Cambió ${changed.join(", ")} de ${u.name}`, { before, after });
  return changed;
}

/** Desactivar revoca sesiones y enlaces pendientes; la cuenta y su historial se conservan. */
export async function setActive(actor: Actor, userId: string, active: boolean) {
  assert(actor, "users");
  const u = await db.user.findUnique({ where: { id: userId } });
  if (!u) throw notFound("Cuenta no encontrada.");
  if (u.active === active) return 0;
  if (!active && u.id === actor.id) throw new Forbidden("No puedes desactivar tu propia cuenta.");
  if (!active && u.role === "ADMIN" && (await adminsLeft(u.id)) === 0) throw conflict("Debe quedar al menos un administrador activo.");
  const now = new Date();
  let revoked = 0;
  await db.$transaction(async (t) => {
    await t.user.update({ where: { id: userId }, data: { active } });
    if (active) return;
    revoked = (await t.session.updateMany({ where: { userId, revokedAt: null, expiresAt: { gt: now } }, data: { revokedAt: now } })).count;
    await t.authToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: now } });
  });
  await audit(actor, active ? "user.reactivate" : "user.deactivate", "User", userId,
    active ? `Reactivó la cuenta de ${u.name}` : `Desactivó la cuenta de ${u.name} (${revoked} sesiones revocadas)`, { revokedSessions: revoked });
  return revoked;
}

export async function revokeSessions(actor: Actor, userId: string) {
  assert(actor, "users");
  const u = await db.user.findUnique({ where: { id: userId } });
  if (!u) throw notFound("Cuenta no encontrada.");
  const r = await db.session.updateMany({ where: { userId, revokedAt: null, expiresAt: { gt: new Date() } }, data: { revokedAt: new Date() } });
  await audit(actor, "user.sessions_revoke", "User", userId, `Cerró ${r.count} sesiones de ${u.name}`);
  return r.count;
}

/** Recuperación de acceso: reenvía invitación si nunca la activó; si no, enlace de restablecimiento. */
export async function recoverAccess(actor: Actor, userId: string) {
  assert(actor, "users");
  const u = await db.user.findUnique({ where: { id: userId } });
  if (!u) throw notFound("Cuenta no encontrada.");
  if (!u.active) throw new AppError("Reactiva la cuenta antes de enviar un enlace de acceso.");
  const kind = u.passwordHash ? "RESET" : "INVITE";
  await issueToken(u.id, u.email, kind);
  await audit(actor, "user.access_recovery", "User", userId, kind === "INVITE" ? `Reenvió invitación a ${u.name}` : `Envió enlace de recuperación a ${u.name}`);
  return kind;
}
