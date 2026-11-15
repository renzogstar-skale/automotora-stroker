"use server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { login, hashPassword, destroySession, createSession } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { sha256 } from "@/lib/crypto";
import { issueToken } from "@/server/users";
import type { ActionState } from "@/lib/action";

export async function loginAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const err = await login(String(fd.get("email") ?? ""), String(fd.get("password") ?? ""));
  if (err) return { error: err };
  redirect("/panel");
}
export async function logoutAction() { await destroySession(); }

/** Envía el enlace de recuperación. Responde igual exista o no la cuenta (no revela correos). */
export async function forgotAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const u = await db.user.findUnique({ where: { email } });
  if (u?.active) await issueToken(u.id, u.email, "RESET");
  return { ok: true, message: "Si el correo está registrado, enviamos un enlace para restablecer la contraseña. Vence en 1 hora." };
}

export async function resetAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const token = String(fd.get("token") ?? ""), pass = String(fd.get("password") ?? ""), pass2 = String(fd.get("password2") ?? "");
  if (pass.length < 10) return { error: "La contraseña debe tener al menos 10 caracteres." };
  if (pass !== pass2) return { error: "Las contraseñas no coinciden." };
  const t = await db.authToken.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  if (!t || t.usedAt || t.expiresAt < new Date()) return { error: "El enlace no es válido o ya venció. Solicita uno nuevo." };
  if (!t.user.active) return { error: "La cuenta está desactivada." };
  await db.$transaction([
    db.user.update({ where: { id: t.userId }, data: { passwordHash: await hashPassword(pass) } }),
    db.authToken.update({ where: { id: t.id }, data: { usedAt: new Date() } }),
    db.session.updateMany({ where: { userId: t.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
  await audit({ id: t.userId, name: t.user.name }, t.kind === "INVITE" ? "user.activate" : "user.password_reset", "User", t.userId, "Contraseña establecida");
  await createSession(t.userId);
  redirect("/panel");
}
