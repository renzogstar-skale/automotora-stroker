/* eslint-disable @typescript-eslint/no-explicit-any */
// Seed de demostración: todas las cifras de reportes se derivan de estos registros.
import { readdirSync, rmSync } from "node:fs";
import bcrypt from "bcryptjs";
import { db } from "../../src/lib/db";
import { sclDate, sclParts, startOfMonth, addDays } from "../../src/lib/format";
import type { Actor } from "../../src/lib/rbac";
import { SYSTEM_CATEGORIES } from "../../src/server/categories";
import { seedHistory } from "./history";
import * as D from "./data";

let seed = 20261113;
export const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
export const int = (a: number, b: number) => Math.floor(a + rnd() * (b - a + 1));
export const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)];
export const round = (n: number, step = 10000) => Math.round(n / step) * step;
export const NOW = new Date();
/** Fecha en el mes con desplazamiento k (0 = actual), sin pasar de hoy. */
export function inMonth(k: number, day: number, h = 11, m = 0) {
  const p = sclParts(startOfMonth(NOW, k));
  const d = sclDate(p.y, p.m, day, h, m);
  return d > NOW ? addDays(NOW, -1) : d;
}
export const daysAgo = (n: number, h = 11) => { const p = sclParts(addDays(NOW, -n)); return sclDate(p.y, p.m, p.d, h, int(0, 59)); };
export const daysAhead = (n: number, h = 11, m = 0) => { const p = sclParts(addDays(NOW, n)); return sclDate(p.y, p.m, p.d, h, m); };

const PHOTOS = readdirSync("public/demo").filter((f) => f.endsWith(".jpg") && f !== "hero.jpg");
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
export function photosFor(brand: string, model: string) {
  const key = D.PHOTO_KEY[`${brand} ${model}`] ?? slug(`${brand} ${model}`);
  const list = PHOTOS.filter((f) => f.startsWith(`${key}-`)).sort().map((f) => `/demo/${f}`);
  return list.length ? list : ["/demo/placeholder.svg"];
}
const LETTERS = "BCDFGHJKLPRSTVWXYZ";
let plateN = 0;
export function plate() {
  plateN++;
  const n = plateN * 7919 + 12345;
  return `${LETTERS[n % 18]}${LETTERS[Math.floor(n / 18) % 18]}${LETTERS[Math.floor(n / 324) % 18]}${LETTERS[Math.floor(n / 5832) % 18]}${String(10 + (plateN % 90))}`;
}

async function wipe() {
  const tables = await db.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations'`;
  await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(",")} RESTART IDENTITY CASCADE`);
  // Los folios se reinician: los PDF emitidos de la demo anterior quedarían huérfanos y bloquearían los nuevos (escritura sin sobrescritura).
  rmSync("storage/private/documents", { recursive: true, force: true });
}

export type Ctx = {
  branches: Record<string, any>; users: Record<string, any>; sellers: any[]; admin: Actor; partners: any[];
  sellersOf: (code: string) => any[]; actorFor: (seller: any) => Actor;
};

async function main() {
  console.log("Limpiando base de demostración…");
  await wipe();
  // Respaldo de concurrencia: una sola reserva ACTIVA por vehículo.
  await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS one_active_reservation ON "Reservation"("vehicleId") WHERE status = 'ACTIVA'`);
  for (const c of SYSTEM_CATEGORIES) await db.category.create({ data: { ...c, system: true } });

  const ip = sclParts(startOfMonth(NOW, -7));
  await db.setting.create({ data: { key: "finance", value: { initialBalance: 180_000_000, initialBalanceDate: `${ip.y}-${String(ip.m).padStart(2, "0")}-01` } } });

  const branches: Record<string, any> = {};
  for (const b of D.BRANCHES) branches[b.code] = await db.branch.create({ data: { ...b, hours: D.HOURS } });
  const hash = await bcrypt.hash(D.PASSWORD, 10);
  const users: Record<string, any> = {};
  const sellers: any[] = [];
  for (const u of D.USERS) {
    const user = await db.user.create({
      data: { email: u.email, name: u.name, role: u.role as any, passwordHash: hash, lastSeenAt: daysAgo(int(0, 2)), branches: { create: u.branches.map((c) => ({ branchId: branches[c].id })) } },
    });
    users[u.email] = user;
    if ("seller" in u)
      sellers.push(await db.seller.create({ data: { userId: user.id, name: u.name, email: u.email, phone: `+56 9 ${int(4000, 9999)} ${int(1000, 9999)}`, branchId: branches[u.branches[0]].id, monthlyGoal: 5 } }));
  }
  sellers.push(await db.seller.create({ data: { name: D.SELLER_NO_ACCOUNT.name, email: D.SELLER_NO_ACCOUNT.email, phone: D.SELLER_NO_ACCOUNT.phone, branchId: branches.VIN.id, monthlyGoal: 5 } }));
  const allBranchIds = Object.values(branches).map((b) => b.id);
  const admin: Actor = { id: users["dueno@stroker.demo"].id, name: "Camila Rojas", email: "dueno@stroker.demo", role: "ADMIN", canPublish: true, branchIds: allBranchIds, sellerId: null };
  const actorFor = (s: any): Actor => ({ ...admin, id: s.userId ?? admin.id, name: s.name, sellerId: s.id });

  const vf = startOfMonth(NOW, -12);
  await db.commissionRule.createMany({
    data: [
      { name: "Comisión vendedor", beneficiary: "VENDEDOR", kind: "FIJO", value: 200000, base: "PRECIO_VENTA", appliesTo: "TODAS", order: 1, validFrom: vf },
      { name: "Captación consignación física", beneficiary: "CAPTADOR", kind: "FIJO", value: 150000, base: "PRECIO_VENTA", appliesTo: "CONSIGNACION_FISICA", order: 1, validFrom: vf },
      { name: "Captación consignación online", beneficiary: "CAPTADOR", kind: "FIJO", value: 100000, base: "PRECIO_VENTA", appliesTo: "CONSIGNACION_ONLINE", order: 1, validFrom: vf },
      { name: "Gerencia", beneficiary: "GERENCIA", beneficiaryName: "Gerencia comercial", kind: "PORCENTAJE", value: 10, base: "UTILIDAD_RESTANTE", appliesTo: "TODAS", order: 2, validFrom: vf },
      { name: "Participación 1", beneficiary: "SOCIO", beneficiaryName: "Participación socia A", kind: "PORCENTAJE", value: 3, base: "UTILIDAD_RESTANTE", appliesTo: "TODAS", order: 3, validFrom: vf },
      { name: "Participación 2", beneficiary: "SOCIO", beneficiaryName: "Participación socio B", kind: "PORCENTAJE", value: 3, base: "UTILIDAD_RESTANTE", appliesTo: "TODAS", order: 3, validFrom: vf },
      { name: "Participación 3", beneficiary: "SOCIO", beneficiaryName: "Participación fondo de inversión", kind: "PORCENTAJE", value: 4, base: "UTILIDAD_RESTANTE", appliesTo: "TODAS", order: 3, validFrom: vf },
    ],
  });
  for (const [type, body] of Object.entries(D.TEMPLATES)) {
    const name = type === "VENTA" ? "Nota de venta (demo)" : type === "RESERVA" ? "Comprobante de reserva (demo)" : "Contrato de consignación (demo)";
    await db.documentTemplate.create({ data: { type, name, body, versions: { create: { version: 1, body } } } });
  }
  const partners = [await db.partner.create({ data: { name: "Camila Rojas (socia)" } }), await db.partner.create({ data: { name: "Inversiones Cordillera Ltda." } })];
  for (const key of ["META_ADS", "WA_META", "YCLOUD", "GA", "GCAL"]) await db.integration.create({ data: { key } });

  const ctx: Ctx = { branches, users, sellers, admin, partners, sellersOf: (c) => sellers.filter((s) => s.branchId === branches[c].id), actorFor };
  await seedHistory(ctx);
  console.log("Seed completo.");
}

if (process.argv[1]?.includes("seed")) main().then(() => db.$disconnect()).catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
