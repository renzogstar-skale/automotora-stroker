// Vitrina pública + Mi Web contra la BD de desarrollo y `npm run dev`.
// Uso: npx tsx --conditions=react-server scripts/test-web.mts
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { db } from "../src/lib/db";
import { randomToken, sha256 } from "../src/lib/crypto";
import type { Actor } from "../src/lib/rbac";
import { createVehicle, reserveVehicle, retireVehicle, setPublished } from "../src/server/inventory";
import { savePublicImage } from "../src/server/storage";
import { getSetting, setSetting } from "../src/server/settings";
import { fullConfig, publishWeb, saveDraft, submitPublicForm, webMetrics } from "../src/server/web";

const BASE = process.env.APP_URL ?? "http://localhost:3000";
let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, info = "") => { if (cond) pass++; else fail++; console.log(`${cond ? "PASS" : "FAIL"}  ${name}${info ? ` — ${info}` : ""}`); };
async function actor(email: string): Promise<Actor> {
  const u = await db.user.findUniqueOrThrow({ where: { email }, include: { branches: true, seller: true } });
  return { id: u.id, name: u.name, email: u.email, role: u.role, canPublish: u.canPublish, branchIds: u.branches.map((b) => b.branchId), sellerId: u.seller?.id ?? null };
}
async function cookie(email: string) {
  const u = await db.user.findUniqueOrThrow({ where: { email } });
  const t = randomToken();
  await db.session.create({ data: { userId: u.id, tokenHash: sha256(t), expiresAt: new Date(Date.now() + 3600e3) } });
  return `stk_session=${t}`;
}
const get = async (path: string, c?: string) => { const r = await fetch(BASE + path, { headers: { ...(c ? { cookie: c } : {}), "user-agent": "test-web" }, redirect: "manual" }); return { status: r.status, loc: r.headers.get("location") ?? "", body: await r.text() }; };
const L = "BCDFGHJKLPRSTVWXYZ";
const plate = () => Array.from({ length: 4 }, () => L[Math.floor(Math.random() * L.length)]).join("") + String(Math.floor(Math.random() * 90) + 10);
const rndPhone = (p: string) => `+569${p}${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;

const admin = await actor("dueno@stroker.demo");
const adminC = await cookie(admin.email);
const branch = await db.branch.findFirstOrThrow({ where: { code: "VIN" } });

// 1. Publicar un vehículo
const p = plate(), vin = "9BWZZZ377VT004251";
const v = await createVehicle({ branchId: branch.id, brand: "Subaru", model: "Outback", version: "2.5 Limited AWD", year: 2022, plate: p, vin, km: 23456, transmission: "Automática", fuel: "Bencina", bodyType: "SUV", color: "Azul", condition: "USADO", price: 27_770_000, cost: 23_330_000, description: "Única dueña, mantenciones en concesionario." }, admin);
const img = new File([await readFile("public/demo/subaru-forester-1.jpg")], "s.jpg", { type: "image/jpeg" });
for (let i = 0; i < 2; i++) await db.vehiclePhoto.create({ data: { vehicleId: v.id, url: await savePublicImage(v.id, img), order: i, isCover: i === 0 } });
await setPublished(v.id, true, admin);
ok("Slug público sin patente", !v.slug.includes(p.toLowerCase()), v.slug);

// 2. Verlo desde la vitrina
const views0 = await db.webEvent.count({ where: { vehicleId: v.id, type: "VEHICLE_VIEW" } });
const ficha = await get(`/autos/${v.slug}`);
ok("Ficha pública 200 con precio y disponibilidad", ficha.status === 200 && ficha.body.includes("27.770.000") && ficha.body.includes("Disponible") && ficha.body.includes("Subaru Outback 2022"), String(ficha.status));
ok("Ficha sin campos no aprobados (patente, VIN, costo)", !ficha.body.includes(p) && !ficha.body.includes(vin) && !ficha.body.includes("23.330.000"));
ok("Galería con fotos cargadas", (ficha.body.match(/\/api\/files\/public\//g) ?? []).length >= 2);
ok("Visita a la ficha registrada", (await db.webEvent.count({ where: { vehicleId: v.id, type: "VEHICLE_VIEW" } })) === views0 + 1);
const cat = await get(`/autos?marca=Subaru&tipo=SUV&anio=2021&precio=30000000&km=30000&sucursal=${branch.id}`);
ok("Catálogo filtrado (marca, tipo, año, precio, km, sucursal) lo muestra", cat.status === 200 && cat.body.includes(`/autos/${v.slug}`));
ok("Filtro de precio lo excluye", !(await get(`/autos?marca=Subaru&precio=20000000`)).body.includes(`/autos/${v.slug}`));
const home = await get("/");
ok("Inicio 200", home.status === 200 && home.body.includes("Destacados"));
ok("Consignar 200", (await get("/consignar")).status === 200);

// 3. Consulta de prueba → CRM (con reintentos)
const phone = rndPhone("9");
const token = randomUUID();
const form = { name: "Cliente Prueba Web", phone, email: `prueba+${Date.now()}@example.com`, vehicleId: v.id, payMethod: "FINANCIAMIENTO", message: "¿Acepta parte de pago?" };
const [r1, r2] = await Promise.all([submitPublicForm("CONSULTA", form, token), submitPublicForm("CONSULTA", form, token)]);
const r3 = await submitPublicForm("CONSULTA", form, randomUUID());
ok("Consulta aceptada", r1.ok || r2.ok);
ok("Reintento simultáneo y reenvío posterior no duplican", [r1, r2, r3].filter((r) => r.ok && !r.duplicate).length === 1);
const ids = [r1, r2, r3].flatMap((r) => (r.ok && r.opportunityId ? [r.opportunityId] : []));
const opps = await db.opportunity.findMany({ where: { id: { in: ids } } });
ok("Una sola oportunidad en el CRM", opps.length === 1, String(opps.length));
const opp = opps[0];
ok("Oportunidad con origen WEB, vehículo y sucursal", opp?.source === "WEB" && opp.vehicleId === v.id && opp.branchId === branch.id && opp.payMethod === "FINANCIAMIENTO");
const crm = await get(`/panel/crm/${opp.id}`, adminC);
ok("Consulta visible en el CRM", crm.status === 200 && crm.body.includes("Cliente Prueba Web") && crm.body.includes("Consulta web"), String(crm.status));
ok("Envío inválido rechazado", !(await submitPublicForm("CONSULTA", { name: "X", phone: "12" }, randomUUID())).ok);
const cons = await submitPublicForm("CONSIGNACION", { name: "Dueño Prueba", phone: rndPhone("8"), brand: "Kia", model: "Rio", year: "2018", km: "70000", branchId: branch.id }, randomUUID());
const consOpp = cons.ok && cons.opportunityId ? await db.opportunity.findUnique({ where: { id: cons.opportunityId } }) : null;
ok("Formulario de consignación → oportunidad CONSIGNACION en la sucursal", consOpp?.type === "CONSIGNACION" && consOpp.branchId === branch.id && consOpp.source === "WEB");

// 4. WhatsApp cuenta como clic
const wa = await get(`/api/web/wa?v=${v.id}`);
ok("Clic WhatsApp redirige a wa.me", wa.status === 302 && wa.loc.startsWith("https://wa.me/"), wa.loc.slice(0, 40));
ok("Clic WhatsApp registrado", (await db.webEvent.count({ where: { vehicleId: v.id, type: "WHATSAPP_CLICK" } })) === 1);
const m = await webMetrics(30);
ok("Métricas 30 días: vistas, contactos, clics y más vistos", m.views > 0 && m.contacts >= 2 && m.whatsapp >= 1 && m.top.length > 0);

// 5. Reservado
const contact = await db.contact.findFirstOrThrow();
await reserveVehicle({ vehicleId: v.id, contactId: contact.id, amount: 0, days: 2, idempotencyKey: randomUUID() }, admin);
const res = await get(`/autos/${v.slug}`);
ok("Ficha muestra «Reservado» y oculta test drive", res.body.includes("Reservado") && res.body.includes("no admite nuevas reservas") && !res.body.includes("Agendar test drive"));
ok("Test drive sobre unidad reservada rechazado", !(await submitPublicForm("TEST_DRIVE", { name: "Otro", phone: rndPhone("7"), vehicleId: v.id, date: "2030-01-10T11:00" }, randomUUID())).ok);
try { await reserveVehicle({ vehicleId: v.id, contactId: contact.id, amount: 0, days: 2, idempotencyKey: randomUUID() }, admin); ok("Segunda reserva bloqueada", false); }
catch (e) { ok("Segunda reserva bloqueada", /reserva activa/.test((e as Error).message)); }

// 6. Retiro → despublicación y ficha directa
await retireVehicle(v.id, "Prueba de despublicación", admin);
ok("Retirado queda despublicado", !(await db.vehicle.findUniqueOrThrow({ where: { id: v.id } })).published);
const gone = await get(`/autos/${v.slug}`);
ok("Ficha directa: «ya no está disponible» sin precio", gone.body.includes("ya no está disponible") && !gone.body.includes("27.770.000"));
ok("Catálogo ya no lo lista", !(await get("/autos?marca=Subaru")).body.includes(`/autos/${v.slug}`));
ok("Consulta sobre unidad retirada rechazada", !(await submitPublicForm("CONSULTA", { ...form, phone: rndPhone("6") }, randomUUID())).ok);

// 7. Mi Web: borrador → vista previa → publicar
const before = await getSetting("web");
const title = `Título de prueba ${Date.now()}`;
await saveDraft({ ...fullConfig(before.draft ?? before.published), heroTitle: title, accent: "#0055aa" }, admin);
ok("Borrador no visible en la web pública", !(await get("/")).body.includes(title));
ok("Vista previa muestra el borrador", (await get("/?preview=1", adminC)).body.includes(title));
ok("Vista previa sin sesión no expone el borrador", !(await get("/?preview=1")).body.includes(title));
await publishWeb(admin);
const pub = await get("/");
ok("Publicar cambios actualiza la web", pub.body.includes(title) && pub.body.includes("#0055aa"));
for (const t of ["editar", "vista", "metricas", "dominio"]) {
  const r = await get(`/panel/sistema/mi-web?tab=${t}`, adminC);
  ok(`Mi Web · ${t}`, r.status === 200 && !r.body.includes("En preparación"), String(r.status));
}
const seller = await get("/panel/sistema/mi-web", await cookie("valentina@stroker.demo"));
ok("Vendedor sin acceso a Mi Web", seller.loc.includes("sin-acceso") || seller.body.includes("sin-acceso"));
await setSetting("web", { published: before.published, draft: before.draft, publishedAt: before.publishedAt });

console.log(`\n${pass} PASS · ${fail} FAIL`);
await db.$disconnect();
process.exit(fail ? 1 : 0);
