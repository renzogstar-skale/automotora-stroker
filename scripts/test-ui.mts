// Envía los formularios renderizados de Sistema (como un navegador) con distintos roles. Requiere `npm run dev`.
// Uso: npx tsx scripts/test-ui.mts
import { db } from "../src/lib/db";
import { randomToken, sha256 } from "../src/lib/crypto";

const BASE = process.env.APP_URL ?? "http://localhost:3000";
let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, info = "") => { if (cond) pass++; else fail++; console.log(`${cond ? "PASS" : "FAIL"}  ${name}${info ? ` — ${info}` : ""}`); };
const tokens: string[] = [];
async function session(email: string) {
  const u = await db.user.findUniqueOrThrow({ where: { email } });
  const t = randomToken(); tokens.push(t);
  await db.session.create({ data: { userId: u.id, tokenHash: sha256(t), expiresAt: new Date(Date.now() + 3600e3) } });
  return t;
}
const unesc = (s: string) => s.replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#x27;/g, "'");
/** Formularios POST de la página con sus campos ocultos ($ACTION_*). */
async function forms(path: string, token: string) {
  const html = await (await fetch(BASE + path, { headers: { cookie: `stk_session=${token}` } })).text();
  return [...html.matchAll(/<form[^>]*method="POST"[^>]*>([\s\S]*?)<\/form>/g)].map((m) => ({
    html: m[1],
    hidden: [...m[1].matchAll(/<input type="hidden" name="([^"]+)"(?: value="([^"]*)")?\/>/g)].map((h) => [h[1], unesc(h[2] ?? "")] as [string, string]),
  }));
}
/** Envía el formulario como lo haría el navegador sin JS y devuelve el HTML con el mensaje de estado. */
async function submit(path: string, token: string, f: { hidden: [string, string][] }, fields: [string, string][]) {
  const fd = new FormData();
  for (const [k, v] of [...f.hidden, ...fields]) fd.append(k, v);
  const r = await fetch(BASE + path, { method: "POST", body: fd, headers: { cookie: `stk_session=${token}` }, redirect: "manual" });
  return { status: r.status, loc: r.headers.get("location") ?? "", html: await r.text() };
}
const msg = (h: string) => h.match(/role="(?:alert|status)"[^>]*>(?:<svg[\s\S]*?<\/svg>)?([^<]+)/)?.[1] ?? "";

const branches = Object.fromEntries((await db.branch.findMany()).map((b) => [b.code, b.id]));
const P = "/panel/sistema/usuarios", C = "/panel/sistema/configuracion";
await db.user.deleteMany({ where: { email: "ui.prueba@stroker.demo" } });
const tA = await session("dueno@stroker.demo"), tGS = await session("gerencia@stroker.demo"), tGV = await session("gerencia.vina@stroker.demo");

console.log("\n== Admin desde la interfaz ==");
const fs = await forms(P, tA);
const invite = fs.find((f) => f.html.includes('name="email"'))!;
let r = await submit(P, tA, invite, [["name", "Prueba Interfaz"], ["email", "ui.prueba@stroker.demo"], ["role", "FOTOGRAFO"], ["branchIds", branches.VIN], ["seller", ""], ["canPublish", "on"]]);
const created = await db.user.findUnique({ where: { email: "ui.prueba@stroker.demo" }, include: { branches: true } });
ok("Admin invita fotógrafo VIN con permiso de publicar", !!created && created.canPublish && created.branches[0]?.branchId === branches.VIN, msg(r.html));
r = await submit(P, tA, invite, [["name", "Prueba Interfaz"], ["email", "ui.prueba@stroker.demo"], ["role", "FOTOGRAFO"], ["branchIds", branches.VIN], ["seller", ""]]);
ok("Correo duplicado rechazado con mensaje", msg(r.html).includes("Ya existe"), msg(r.html));

const edit = (await forms(`${P}?id=${created!.id}`, tA)).find((f) => f.html.includes("Guardar permisos"))!;
r = await submit(`${P}?id=${created!.id}`, tA, edit, [["role", "FINANZAS"], ["branchIds", branches.SCL], ["branchIds", branches.VIN], ["seller", ""]]);
const after = await db.user.findUnique({ where: { id: created!.id }, include: { branches: true } });
ok("Admin cambia rol y sucursales", after?.role === "FINANZAS" && after.branches.length === 2 && !after.canPublish, msg(r.html));

const t = await session("ui.prueba@stroker.demo");
await db.user.update({ where: { id: created!.id }, data: { passwordHash: "x" } });
const deact = (await forms(P, tA)).find((f) => f.html.includes(created!.id) && f.html.includes("Desactivar"))!;
r = await submit(P, tA, deact, [["id", created!.id]]);
ok("Admin desactiva desde la tabla", !(await db.user.findUnique({ where: { id: created!.id } }))!.active, msg(r.html));
const probe = await fetch(`${BASE}/panel/finanzas/movimientos`, { headers: { cookie: `stk_session=${t}` }, redirect: "manual" });
ok("La sesión de la cuenta desactivada queda revocada", (await db.session.count({ where: { userId: created!.id, revokedAt: null } })) === 0 && (probe.status === 307 || (await probe.text()).includes("/login")));

const company = (await forms(C, tA)).find((f) => f.html.includes('name="rut"'))!;
const cur = await db.setting.findUnique({ where: { key: "company" } });
r = await submit(C, tA, company, [["name", "Automotora Stroker SpA"], ["rut", "rut-malo"], ["address", "Av. Ejemplo 1234"], ["phone", "+56 2 2345 6789"], ["email", "contacto@stroker.example"]]);
ok("Configuración valida RUT", msg(r.html).includes("RUT no válido"), msg(r.html));
const branchForm = (await forms(C, tA)).find((f) => f.html.includes('name="lunVie"'))!;
const b0 = await db.branch.findFirstOrThrow({ where: { id: branchForm.hidden.find(([k]) => k === "id")?.[1] ?? "" } }).catch(() => null);
if (b0) {
  const h = b0.hours as Record<string, string>;
  r = await submit(C, tA, branchForm, [["name", b0.name], ["address", b0.address], ["comuna", b0.comuna], ["region", b0.region], ["phone", b0.phone], ["whatsapp", b0.whatsapp], ["lunVie", "09:00–19:30"], ["sab", h.sab], ["dom", h.dom], ["active", "on"]]);
  const nb = await db.branch.findUniqueOrThrow({ where: { id: b0.id } });
  ok("Admin edita horario de sucursal (auditado)", (nb.hours as Record<string, string>).lunVie === "09:00–19:30" && !!(await db.auditLog.findFirst({ where: { action: "config.branch", entityId: b0.id }, orderBy: { createdAt: "desc" } })), msg(r.html));
  await db.branch.update({ where: { id: b0.id }, data: { hours: b0.hours as object } });
} else ok("Formulario de sucursal tiene id", false);

console.log("\n== Gerencia (SCL y VIN) reenviando los mismos formularios ==");
for (const [n, tok] of [["Gerencia SCL", tGS], ["Gerencia VIN", tGV]] as const) {
  const ui = await fetch(BASE + P, { headers: { cookie: `stk_session=${tok}` } }).then((x) => x.text());
  ok(`${n}: la interfaz no muestra la tabla de usuarios`, !ui.includes("Invitar usuario") && ui.includes("NEXT_REDIRECT"));
  r = await submit(P, tok, invite, [["name", "Intruso"], ["email", `intruso.${n.slice(-3).toLowerCase()}@stroker.demo`], ["role", "ADMIN"], ["branchIds", branches.SCL], ["seller", ""]]);
  ok(`${n}: acción de invitar denegada en servidor`, !(await db.user.findFirst({ where: { email: { startsWith: "intruso" } } })), `${r.status} ${r.loc}`);
  const react = (await forms(P, tA)).find((f) => f.html.includes(created!.id) && f.html.includes("Reactivar"))!;
  r = await submit(P, tok, react, [["id", created!.id]]);
  ok(`${n}: acción de reactivar denegada en servidor`, !(await db.user.findUnique({ where: { id: created!.id } }))!.active, `${r.status} ${r.loc}`);
  r = await submit(C, tok, company, [["name", "Hackeada"], ["rut", "77.123.456-7"], ["address", "x x x"], ["phone", "1234567"], ["email", "a@b.cl"]]);
  const now = await db.setting.findUnique({ where: { key: "company" } });
  ok(`${n}: acción de configuración denegada en servidor`, JSON.stringify(now?.value) === JSON.stringify(cur?.value), `${r.status} ${r.loc}`);
}

// Limpieza
await db.auditLog.deleteMany({ where: { entityId: created!.id } });
await db.user.delete({ where: { id: created!.id } });
await db.session.deleteMany({ where: { tokenHash: { in: tokens.map(sha256) } } });
console.log(`\n${pass} PASS · ${fail} FAIL`);
await db.$disconnect();
process.exit(fail ? 1 : 0);
