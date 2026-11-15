// Pruebas de acceso autorizado/denegado (servidor + HTTP contra `npm run dev`).
// Uso: npx tsx --conditions=react-server scripts/test-access.mts
import { db } from "../src/lib/db";
import { randomToken, sha256 } from "../src/lib/crypto";
import type { Actor } from "../src/lib/rbac";
import { inviteUser, updateAccess, setActive, recoverAccess } from "../src/server/users";
import { getOppForActor } from "../src/server/crm";
import { setPublished } from "../src/server/inventory";

const BASE = process.env.APP_URL ?? "http://localhost:3000";
let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, info = "") => { if (cond) pass++; else fail++; console.log(`${cond ? "PASS" : "FAIL"}  ${name}${info ? ` — ${info}` : ""}`); };
const denied = async (name: string, fn: () => Promise<unknown>) => { try { await fn(); ok(name, false, "no fue denegado"); } catch (e) { ok(name, true, (e as Error).message); } };
const allowed = async (name: string, fn: () => Promise<unknown>) => { try { await fn(); ok(name, true); } catch (e) { ok(name, false, (e as Error).message); } };

async function actor(email: string): Promise<Actor> {
  const u = await db.user.findUniqueOrThrow({ where: { email }, include: { branches: true, seller: true } });
  return { id: u.id, name: u.name, email: u.email, role: u.role, canPublish: u.canPublish, branchIds: u.branches.map((b) => b.branchId), sellerId: u.seller?.id ?? null };
}
async function session(email: string) {
  const u = await db.user.findUniqueOrThrow({ where: { email } });
  const t = randomToken();
  await db.session.create({ data: { userId: u.id, tokenHash: sha256(t), expiresAt: new Date(Date.now() + 3600e3) } });
  return t;
}
async function get(path: string, token: string) {
  const r = await fetch(BASE + path, { headers: { cookie: `stk_session=${token}` }, redirect: "manual" });
  return { status: r.status, loc: r.headers.get("location") ?? "", body: await r.text() };
}
const redirectsTo = (r: { status: number; loc: string; body: string }, frag: string) =>
  (r.status >= 300 && r.status < 400 && r.loc.includes(frag)) || new RegExp(`NEXT_REDIRECT;\\w+;${frag.replace(/\//g, "\\/")}`).test(r.body);

// Con loading.tsx la respuesta ya va en streaming (200) cuando se llama notFound(): se valida el marcador 404.
const is404 = (r: { status: number; body: string }) => r.status === 404 || r.body.includes("NEXT_HTTP_ERROR_FALLBACK;404");

const branches = Object.fromEntries((await db.branch.findMany()).map((b) => [b.code, b.id]));
const admin = await actor("dueno@stroker.demo");
const gSCL = await actor("gerencia@stroker.demo"), gVIN = await actor("gerencia.vina@stroker.demo");
const vSCL = await actor("valentina@stroker.demo"), vVIN = await actor("josefa@stroker.demo");
const foto = await actor("foto@stroker.demo"), fin = await actor("finanzas@stroker.demo");
const oppVIN = await db.opportunity.findFirstOrThrow({ where: { branchId: branches.VIN, deletedAt: null, sellerId: vVIN.sellerId } });
const oppSCLother = await db.opportunity.findFirstOrThrow({ where: { branchId: branches.SCL, deletedAt: null, sellerId: { not: vSCL.sellerId } } });
const oppSCLmine = await db.opportunity.findFirstOrThrow({ where: { branchId: branches.SCL, deletedAt: null, sellerId: vSCL.sellerId } });

console.log("\n== Servidor: alcance por sucursal y cartera ==");
await allowed("Gerencia SCL abre lead de SCL", () => getOppForActor(oppSCLother.id, gSCL));
await denied("Gerencia SCL abre lead de VIN", () => getOppForActor(oppVIN.id, gSCL));
await allowed("Gerencia VIN abre lead de VIN", () => getOppForActor(oppVIN.id, gVIN));
await denied("Gerencia VIN abre lead de SCL", () => getOppForActor(oppSCLother.id, gVIN));
await allowed("Vendedor SCL abre su propio lead", () => getOppForActor(oppSCLmine.id, vSCL));
await denied("Vendedor SCL abre lead de otro vendedor SCL", () => getOppForActor(oppSCLother.id, vSCL));
await denied("Vendedor VIN abre lead de SCL", () => getOppForActor(oppSCLmine.id, vVIN));
const veh = await db.vehicle.findFirstOrThrow({ where: { status: "DISPONIBLE", photos: { some: {} } } });
await denied("Fotógrafo sin permiso de publicar publica vehículo", () => setPublished(veh.id, !veh.published, { ...foto, canPublish: false }));

console.log("\n== Servidor: gestión de usuarios ==");
await denied("Gerencia SCL invita usuario", () => inviteUser(gSCL, { name: "X Y", email: "x@y.cl", role: "VENDEDOR", branchIds: [branches.SCL], canPublish: false, seller: "new" }));
await denied("Finanzas desactiva cuenta", () => setActive(fin, vSCL.id, false));
await denied("Vendedor sin ficha", () => inviteUser(admin, { name: "Sin Ficha", email: "sinficha@stroker.demo", role: "VENDEDOR", branchIds: [branches.VIN], canPublish: false, seller: "" }));
await denied("Admin se desactiva a sí mismo", () => setActive(admin, admin.id, false));
await denied("Admin se quita su propio rol", () => updateAccess(admin, admin.id, { role: "GERENCIA", branchIds: admin.branchIds, canPublish: false, seller: "" }));
await db.user.deleteMany({ where: { email: "prueba.vina@stroker.demo" } });
const tomas = await db.seller.findFirst({ where: { userId: null, branchId: branches.VIN } });
let invited!: Awaited<ReturnType<typeof inviteUser>>;
await allowed("Admin invita vendedor VIN vinculado a ficha existente", async () => {
  invited = await inviteUser(admin, { name: "Prueba Viña", email: "prueba.vina@stroker.demo", role: "VENDEDOR", branchIds: [branches.VIN], canPublish: false, seller: tomas?.id ?? "new" });
});
const link = await db.seller.findFirst({ where: { userId: invited.id } });
ok("Ficha vinculada por identificador estable", !!link && (!tomas || link.id === tomas.id), link?.id);
ok("Correo de invitación en bandeja", !!(await db.emailOutbox.findFirst({ where: { to: "prueba.vina@stroker.demo", subject: { contains: "Invitación" } } })));
await allowed("Admin cambia rol y sucursal", () => updateAccess(admin, invited.id, { role: "GERENCIA", branchIds: [branches.VIN, branches.SCL], canPublish: false, seller: link!.id }));
ok("Auditoría de cambio de permisos con antes/después",
  !!(await db.auditLog.findFirst({ where: { action: "user.permissions", entityId: invited.id, data: { path: ["before", "role"], equals: "VENDEDOR" } } })));
await updateAccess(admin, invited.id, { role: "VENDEDOR", branchIds: [branches.VIN], canPublish: false, seller: link!.id });

console.log("\n== HTTP (interfaz renderizada + guardas del servidor) ==");
const [tA, tGS, tGV, tVS, tVV, tF, tFin] = await Promise.all([admin, gSCL, gVIN, vSCL, vVIN, foto, fin].map((x) => session(x.email)));
let r = await get("/panel/sistema/usuarios", tA);
ok("Admin ve tabla de usuarios", r.status === 200 && r.body.includes("Invitar usuario") && r.body.includes("gerencia.vina@stroker.demo"), String(r.status));
r = await get("/panel/sistema/usuarios?q=vina", tA);
ok("Búsqueda filtra (q=vina)", r.status === 200 && r.body.includes("gerencia.vina@stroker.demo") && !r.body.includes("valentina@stroker.demo"));
r = await get("/panel/sistema/configuracion", tA);
ok("Admin ve configuración", r.status === 200 && r.body.includes("Preferencias de avisos") && r.body.includes("Horario de atención"));
for (const [n, t] of [["Gerencia SCL", tGS], ["Gerencia VIN", tGV], ["Vendedor SCL", tVS], ["Finanzas", tFin]] as const) {
  ok(`${n} denegado en /sistema/usuarios`, redirectsTo(await get("/panel/sistema/usuarios", t), "/panel/sin-acceso"));
  ok(`${n} denegado en /sistema/configuracion`, redirectsTo(await get("/panel/sistema/configuracion", t), "/panel/sin-acceso"));
}
r = await get(`/panel/crm/${oppVIN.id}`, tGV); ok("Gerencia VIN abre ficha lead VIN (UI)", r.status === 200 && !is404(r), String(r.status));
r = await get(`/panel/crm/${oppVIN.id}`, tGS); ok("Gerencia SCL no ve lead VIN (UI 404)", is404(r) && !r.body.includes(oppVIN.contactId), String(r.status));
r = await get(`/panel/crm/${oppSCLmine.id}`, tVS); ok("Vendedor SCL abre su lead (UI)", r.status === 200 && !is404(r), String(r.status));
r = await get(`/panel/crm/${oppSCLmine.id}`, tVV); ok("Vendedor VIN no ve lead SCL (UI 404)", is404(r) && !r.body.includes(oppSCLmine.contactId), String(r.status));
ok("Vendedor SCL accede a citas", (await get("/panel/citas", tVS)).status === 200);
ok("Vendedor SCL accede a inventario", (await get("/panel/inventario", tVS)).status === 200);
ok("Vendedor SCL denegado en finanzas", redirectsTo(await get("/panel/finanzas/movimientos", tVS), "/panel/sin-acceso"));
ok("Fotógrafo accede a álbumes", (await get("/panel/albumes", tF)).status === 200);
ok("Fotógrafo denegado en CRM", redirectsTo(await get("/panel/crm", tF), "/panel/sin-acceso"));
ok("Finanzas accede a movimientos", (await get("/panel/finanzas/movimientos", tFin)).status === 200);
ok("Finanzas denegado en CRM", redirectsTo(await get("/panel/crm", tFin), "/panel/sin-acceso"));
const exp = await fetch(`${BASE}/api/export/leads`, { headers: { cookie: `stk_session=${tVS}` } });
ok("API export leads denegada a vendedor", exp.status === 403, String(exp.status));

console.log("\n== Desactivación: revoca sesiones y conserva historial ==");
const tInv = await session("prueba.vina@stroker.demo");
await db.user.update({ where: { id: invited.id }, data: { passwordHash: "x" } });
ok("Cuenta invitada entra al panel", (await get("/panel/citas", tInv)).status === 200);
const revoked = await setActive(admin, invited.id, false);
ok("Sesiones revocadas al desactivar", revoked >= 1 && (await db.session.count({ where: { userId: invited.id, revokedAt: null } })) === 0, `${revoked}`);
ok("Sesión antigua ya no entra (redirige a /login)", redirectsTo(await get("/panel/citas", tInv), "/login"));
ok("Cuenta e historial conservados", !!(await db.user.findUnique({ where: { id: invited.id } })) && (await db.auditLog.count({ where: { entityId: invited.id } })) >= 3);
ok("Auditoría de desactivación", !!(await db.auditLog.findFirst({ where: { action: "user.deactivate", entityId: invited.id } })));
await denied("Recuperar acceso en cuenta desactivada", () => recoverAccess(admin, invited.id));
await setActive(admin, invited.id, true);
ok("Recuperación de acceso envía enlace", (await recoverAccess(admin, invited.id)) === "RESET");

// Limpieza: libera la ficha y elimina la cuenta de prueba y las sesiones creadas.
await db.seller.updateMany({ where: { userId: invited.id }, data: { userId: null } });
await db.auditLog.deleteMany({ where: { entityId: invited.id } });
await db.user.delete({ where: { id: invited.id } });
await db.session.deleteMany({ where: { tokenHash: { in: [tA, tGS, tGV, tVS, tVV, tF, tFin].map(sha256) } } });
console.log(`\n${pass} PASS · ${fail} FAIL`);
await db.$disconnect();
process.exit(fail ? 1 : 0);
