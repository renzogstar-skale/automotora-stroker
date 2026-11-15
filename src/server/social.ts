import type { Prisma, SocialAccount } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { randomToken } from "@/lib/crypto";
import { assert, type Actor } from "@/lib/rbac";
import { AppError, notFound } from "./errors";
import { demoMode } from "./integrations";

/**
 * Redes sociales: cuentas corporativas (gestiona gerencia/administración) y personales (de cada usuario).
 * La conexión real usa OAuth de cada red con los permisos indicados; las credenciales de la app van en el servidor.
 */
export const NETWORKS = {
  FACEBOOK: {
    label: "Facebook", env: ["META_APP_ID", "META_APP_SECRET"], maxLen: 63206,
    scopes: { CORPORATIVA: ["pages_show_list", "pages_manage_posts", "pages_read_engagement"], PERSONAL: [] as string[] },
    note: { CORPORATIVA: "Publica en la Página de la empresa.", PERSONAL: "Meta no permite publicar en perfiles personales vía API: solo borradores y recordatorios." },
    authUrl: "https://www.facebook.com/v21.0/dialog/oauth", clientEnv: "META_APP_ID",
  },
  INSTAGRAM: {
    label: "Instagram", env: ["META_APP_ID", "META_APP_SECRET"], maxLen: 2200,
    scopes: { CORPORATIVA: ["instagram_basic", "instagram_content_publish", "pages_show_list"], PERSONAL: ["instagram_basic", "instagram_content_publish", "pages_show_list"] },
    note: { CORPORATIVA: "Requiere cuenta profesional vinculada a una Página de Facebook.", PERSONAL: "Solo cuentas profesionales (Business o Creator) vinculadas a una Página." },
    authUrl: "https://www.facebook.com/v21.0/dialog/oauth", clientEnv: "META_APP_ID",
  },
  LINKEDIN: {
    label: "LinkedIn", env: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"], maxLen: 3000,
    scopes: { CORPORATIVA: ["w_organization_social", "r_organization_social"], PERSONAL: ["openid", "profile", "w_member_social"] },
    note: { CORPORATIVA: "Requiere aprobación de Community Management API y rol de administrador de la página.", PERSONAL: "Publica en el perfil del usuario (w_member_social)." },
    authUrl: "https://www.linkedin.com/oauth/v2/authorization", clientEnv: "LINKEDIN_CLIENT_ID",
  },
} as const;
export type Network = keyof typeof NETWORKS;
export type Kind = "CORPORATIVA" | "PERSONAL";

const manager = (a: Actor) => a.role === "ADMIN" || a.role === "GERENCIA";
export const canPublishPersonal = (n: Network) => NETWORKS[n].scopes.PERSONAL.length > 0;

/** Corporativas: visibles para todos con permiso; personales: solo su dueño (y gerencia/administración). */
export function accountScope(a: Actor): Prisma.SocialAccountWhereInput {
  return manager(a) ? {} : { OR: [{ kind: "CORPORATIVA" }, { userId: a.id }] };
}
const canEdit = (acc: SocialAccount, a: Actor) => (acc.kind === "CORPORATIVA" ? manager(a) : acc.userId === a.id || manager(a));

async function getAccount(id: string, a: Actor) {
  const acc = await db.socialAccount.findFirst({ where: { id, ...accountScope(a) } });
  if (!acc) throw notFound("Cuenta no encontrada.");
  if (!canEdit(acc, a)) throw new AppError("No puedes gestionar esta cuenta.", 403);
  return acc;
}

export const missingNetworkEnv = (n: Network) => NETWORKS[n].env.filter((e) => !process.env[e]);

export async function createAccount(i: { network: string; kind: string; handle: string }, a: Actor) {
  assert(a, "social");
  if (!(i.network in NETWORKS)) throw new AppError("Red no válida.");
  const kind: Kind = i.kind === "CORPORATIVA" ? "CORPORATIVA" : "PERSONAL";
  if (kind === "CORPORATIVA" && !manager(a)) throw new AppError("Solo gerencia o administración agrega cuentas corporativas.", 403);
  const handle = i.handle.trim();
  if (handle.length < 2 || handle.length > 80) throw new AppError("Indica el usuario o nombre de la cuenta.");
  const acc = await db.socialAccount.create({ data: { network: i.network, kind, handle, userId: kind === "PERSONAL" ? a.id : null, status: "SIN_CONECTAR" } });
  await audit(a, "social.account.create", "SocialAccount", acc.id, `${NETWORKS[i.network as Network].label} ${kind.toLowerCase()} ${handle}`);
  return acc;
}

/**
 * Conecta la cuenta. Con credenciales de la app devuelve la URL de autorización OAuth con los permisos de la red/tipo
 * (el canje del código y el almacenamiento cifrado del token se completan al habilitar la app real).
 * Sin credenciales en modo demo, la marca como conectada en demo.
 */
export async function connectAccount(id: string, a: Actor, origin: string) {
  const acc = await getAccount(id, a);
  const n = NETWORKS[acc.network as Network];
  const kind = acc.kind as Kind;
  if (kind === "PERSONAL" && !canPublishPersonal(acc.network as Network)) throw new AppError(n.note.PERSONAL);
  const missing = missingNetworkEnv(acc.network as Network);
  if (missing.length) {
    if (!demoMode()) throw new AppError(`${n.label} sin configurar: faltan ${missing.join(", ")} en el servidor.`);
    await db.socialAccount.update({ where: { id }, data: { status: "DEMO" } });
    await audit(a, "social.account.connect", "SocialAccount", id, "Conectada en modo demo");
    return { url: null };
  }
  const state = randomToken(16);
  await db.setting.upsert({ where: { key: `oauth_state:${state}` }, create: { key: `oauth_state:${state}`, value: { accountId: id, userId: a.id, at: Date.now() } }, update: {} });
  const q = new URLSearchParams({ client_id: process.env[n.clientEnv]!, redirect_uri: `${origin}/api/oauth/${acc.network.toLowerCase()}/callback`, response_type: "code", state, scope: n.scopes[kind].join(acc.network === "LINKEDIN" ? " " : ",") });
  await db.socialAccount.update({ where: { id }, data: { status: "PENDIENTE" } });
  return { url: `${n.authUrl}?${q}` };
}

export async function disconnectAccount(id: string, a: Actor) {
  await getAccount(id, a);
  await db.socialAccount.update({ where: { id }, data: { status: "SIN_CONECTAR" } });
  await audit(a, "social.account.disconnect", "SocialAccount", id, "Cuenta desconectada");
}

// ---------- Publicaciones ----------

export function postScope(a: Actor): Prisma.SocialPostWhereInput {
  return { account: accountScope(a) };
}

function validate(acc: SocialAccount, text: string) {
  const t = text.trim();
  if (!t) throw new AppError("Escribe el texto de la publicación.");
  const max = NETWORKS[acc.network as Network].maxLen;
  if (t.length > max) throw new AppError(`${NETWORKS[acc.network as Network].label} admite hasta ${max} caracteres.`);
  return t;
}

/** Publica en la red. En demo se simula; con app real sin token almacenado queda en error recuperable. */
async function doPublish(postId: string) {
  const p = await db.socialPost.findUniqueOrThrow({ where: { id: postId }, include: { account: true } });
  const acc = p.account;
  let error: string | null = null;
  if (acc.kind === "PERSONAL" && !canPublishPersonal(acc.network as Network)) error = NETWORKS[acc.network as Network].note.PERSONAL;
  else if (acc.status === "DEMO") error = null;
  else if (acc.status !== "CONECTADO") error = "La cuenta no está conectada: conéctala y reintenta.";
  else error = "Publicación real pendiente de habilitar el token OAuth de la cuenta.";
  return db.socialPost.update({
    where: { id: postId },
    data: error ? { status: "ERROR", error } : { status: "PUBLICADA", publishedAt: new Date(), error: null },
  });
}

export async function createPost(i: { accountId: string; vehicleId?: string | null; text: string; mode: "draft" | "schedule" | "publish"; scheduledAt?: Date | null }, a: Actor) {
  assert(a, "social");
  const acc = await getAccount(i.accountId, a);
  const text = validate(acc, i.text);
  if (i.mode === "schedule" && (!i.scheduledAt || isNaN(i.scheduledAt.getTime()) || i.scheduledAt.getTime() < Date.now() + 60_000))
    throw new AppError("Programa con al menos un minuto de anticipación.");
  if (i.vehicleId && !(await db.vehicle.findUnique({ where: { id: i.vehicleId } }))) throw new AppError("Vehículo no encontrado.");
  let p = await db.socialPost.create({
    data: { accountId: acc.id, vehicleId: i.vehicleId || null, text, status: i.mode === "schedule" ? "PROGRAMADA" : "BORRADOR", scheduledAt: i.mode === "schedule" ? i.scheduledAt : null },
  });
  if (i.mode === "publish") p = await doPublish(p.id);
  await audit(a, "social.post.create", "SocialPost", p.id, `Publicación ${p.status.toLowerCase()} en ${acc.handle}`);
  return p;
}

async function getPost(id: string, a: Actor) {
  const p = await db.socialPost.findFirst({ where: { id, ...postScope(a) }, include: { account: true } });
  if (!p) throw notFound("Publicación no encontrada.");
  if (!canEdit(p.account, a)) throw new AppError("No puedes gestionar esta publicación.", 403);
  return p;
}

/** Publicar ahora o reintentar un error. Una publicada no se vuelve a publicar. */
export async function publishPost(id: string, a: Actor) {
  const p = await getPost(id, a);
  if (p.status === "PUBLICADA") throw new AppError("La publicación ya está publicada.");
  const r = await doPublish(id);
  await audit(a, "social.post.publish", "SocialPost", id, r.status === "PUBLICADA" ? "Publicada" : `Error: ${r.error}`);
  if (r.status === "ERROR") throw new AppError(r.error ?? "No se pudo publicar.", 502);
}
export async function schedulePost(id: string, at: Date, a: Actor) {
  const p = await getPost(id, a);
  if (p.status === "PUBLICADA") throw new AppError("La publicación ya está publicada.");
  if (isNaN(at.getTime()) || at.getTime() < Date.now() + 60_000) throw new AppError("Programa con al menos un minuto de anticipación.");
  await db.socialPost.update({ where: { id }, data: { status: "PROGRAMADA", scheduledAt: at, error: null } });
  await audit(a, "social.post.schedule", "SocialPost", id, `Programada para ${at.toISOString()}`);
}
export async function unschedulePost(id: string, a: Actor) {
  const p = await getPost(id, a);
  if (p.status !== "PROGRAMADA") throw new AppError("Solo se pueden volver a borrador las programadas.");
  await db.socialPost.update({ where: { id }, data: { status: "BORRADOR", scheduledAt: null } });
}
export async function deletePost(id: string, a: Actor) {
  const p = await getPost(id, a);
  if (p.status === "PUBLICADA") throw new AppError("Las publicadas se conservan como historial.");
  await db.socialPost.delete({ where: { id } });
  await audit(a, "social.post.delete", "SocialPost", id, "Publicación eliminada");
}

/** Publica las programadas vencidas (cron). El update condicionado evita doble publicación si dos procesos coinciden. */
export async function publishDue(now = new Date()) {
  const due = await db.socialPost.findMany({ where: { status: "PROGRAMADA", scheduledAt: { lte: now } }, select: { id: true } });
  let published = 0, failed = 0;
  for (const { id } of due) {
    const claimed = await db.socialPost.updateMany({ where: { id, status: "PROGRAMADA" }, data: { status: "PUBLICANDO" } });
    if (!claimed.count) continue;
    const r = await doPublish(id);
    if (r.status === "PUBLICADA") published++; else failed++;
  }
  return { published, failed };
}
