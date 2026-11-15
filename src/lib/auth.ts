import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { sha256, randomToken } from "./crypto";
import { can, type Actor, type Perm } from "./rbac";

const COOKIE = "stk_session";
const TTL_DAYS = 14;

export async function createSession(userId: string) {
  const token = randomToken();
  await db.session.create({ data: { tokenHash: sha256(token), userId, expiresAt: new Date(Date.now() + TTL_DAYS * 864e5) } });
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: TTL_DAYS * 86400 });
}

export async function destroySession() {
  const jar = await cookies();
  const t = jar.get(COOKIE)?.value;
  if (t) await db.session.updateMany({ where: { tokenHash: sha256(t) }, data: { revokedAt: new Date() } });
  jar.delete(COOKIE);
}

export async function login(email: string, password: string) {
  const user = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) return "Correo o contraseña incorrectos.";
  if (!user.active) return "Tu cuenta está desactivada. Contacta a un administrador.";
  await createSession(user.id);
  return null;
}

export const hashPassword = (p: string) => bcrypt.hash(p, 10);

/** Usuario de la solicitud actual (una consulta por request). */
export const getActor = cache(async (): Promise<Actor | null> => {
  const t = (await cookies()).get(COOKIE)?.value;
  if (!t) return null;
  const s = await db.session.findUnique({
    where: { tokenHash: sha256(t) },
    include: { user: { include: { branches: true, seller: true } } },
  });
  if (!s || s.revokedAt || s.expiresAt < new Date() || !s.user.active) return null;
  const u = s.user;
  if (!u.lastSeenAt || Date.now() - u.lastSeenAt.getTime() > 120_000)
    await db.user.update({ where: { id: u.id }, data: { lastSeenAt: new Date() } });
  return {
    id: u.id, name: u.name, email: u.email, role: u.role, canPublish: u.canPublish,
    branchIds: u.branches.map((b) => b.branchId), sellerId: u.seller?.id ?? null,
  };
});

/** Exige sesión y, opcionalmente, un permiso. Sin permiso muestra «acceso restringido». */
export async function guard(perm?: Perm) {
  const a = await getActor();
  if (!a) redirect("/login");
  if (perm && !can(a, perm)) redirect(`/panel/sin-acceso?p=${perm}`);
  return a;
}
