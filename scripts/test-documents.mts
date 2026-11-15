// Documentos: reserva → borrador con folio → PDF emitido → cambio de plantilla → el PDF anterior se conserva intacto.
// Contra la BD de desarrollo y `npm run dev`. Uso: npx tsx --conditions=react-server scripts/test-documents.mts
import { createHash, randomUUID } from "node:crypto";
import { db } from "../src/lib/db";
import { randomToken, sha256 } from "../src/lib/crypto";
import type { Actor } from "../src/lib/rbac";
import { createVehicle, reserveVehicle } from "../src/server/inventory";
import { createDocument, emitDocument, render } from "../src/server/documents";

const BASE = process.env.APP_URL ?? "http://localhost:3000";
let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, info = "") => { if (cond) pass++; else fail++; console.log(`${cond ? "PASS" : "FAIL"}  ${name}${info ? ` — ${info}` : ""}`); };
const hash = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

async function actor(email: string): Promise<Actor> {
  const u = await db.user.findUniqueOrThrow({ where: { email }, include: { branches: true, seller: true } });
  return { id: u.id, name: u.name, email: u.email, role: u.role, canPublish: u.canPublish, branchIds: u.branches.map((b) => b.branchId), sellerId: u.seller?.id ?? null };
}
async function get(path: string, email?: string) {
  let cookie = "";
  if (email) {
    const u = await db.user.findUniqueOrThrow({ where: { email } });
    const t = randomToken();
    await db.session.create({ data: { userId: u.id, tokenHash: sha256(t), expiresAt: new Date(Date.now() + 3600e3) } });
    cookie = `stk_session=${t}`;
  }
  const r = await fetch(BASE + path, { headers: { cookie }, redirect: "manual" });
  return { status: r.status, type: r.headers.get("content-type") ?? "", bytes: new Uint8Array(await r.arrayBuffer()) };
}
const L = "BCDFGHJKLPRSTVWXYZ";
const plate = () => Array.from({ length: 4 }, () => L[Math.floor(Math.random() * L.length)]).join("") + String(Math.floor(Math.random() * 90) + 10);

const admin = await actor("dueno@stroker.demo");
const branchId = (await db.branch.findFirstOrThrow({ where: { code: "SCL" } })).id;

// 1. Crear reserva
const v = await createVehicle({ branchId, brand: "Kia", model: "Sportage", version: "EX", year: 2022, km: 31000, transmission: "Automática", fuel: "Bencina", bodyType: "SUV", color: "Blanco", plate: plate(), condition: "USADO", price: 19_990_000, cost: 16_000_000 }, admin);
const contact = await db.contact.create({ data: { name: `Cliente Prueba ${randomUUID().slice(0, 4)}`, rut: "11.111.111-1", phone: "+56 9 1111 1111" } });
const res = await reserveVehicle({ vehicleId: v.id, contactId: contact.id, amount: 500_000, days: 3, method: "Transferencia", idempotencyKey: randomUUID() }, admin);
ok("Reserva creada", res.status === "ACTIVA", `${v.plate} · ${contact.name}`);

// 2. Borrador autocompletado desde la reserva, con folio único
const d1 = await createDocument("RESERVA", { reservationId: res.id }, admin);
const data1 = d1.data as { cliente: { nombre: string }; vehiculo: { patente: string }; reserva: { monto: string } };
ok("Folio único RS-AAAA-NNNNN", /^RS-\d{4}-\d{5}$/.test(d1.folio), d1.folio);
ok("Borrador autocompletado", d1.status === "BORRADOR" && data1.cliente.nombre === contact.name && data1.vehiculo.patente === v.plate && data1.reserva.monto.includes("500"));
const preview = await get(`/api/documents/${d1.id}/pdf`, "dueno@stroker.demo");
ok("Vista previa PDF del borrador", preview.status === 200 && preview.type === "application/pdf", `${preview.bytes.length} bytes`);

// 3. Emitir: congela datos, versión de plantilla y PDF
await emitDocument(d1.id, admin);
const e1 = await db.document.findUniqueOrThrow({ where: { id: d1.id } });
const tpl = await db.documentTemplate.findUniqueOrThrow({ where: { id: e1.templateId } });
ok("Emitido con versión y PDF archivado", e1.status === "EMITIDO" && e1.templateVersion === tpl.version && !!e1.pdfPath && !!e1.pdfSha256, `v${e1.templateVersion}`);
const pdf1 = await get(`/api/documents/${d1.id}/pdf`, "dueno@stroker.demo");
ok("PDF emitido = archivo archivado", pdf1.status === 200 && hash(pdf1.bytes) === e1.pdfSha256);

// 4. Cambiar la plantilla (misma lógica que templateAction: nueva versión)
const MARK = `CLAUSULA-NUEVA-${randomUUID().slice(0, 6)}`;
const originalBody = tpl.body;
const newBody = `${tpl.body}\n${MARK}: texto ficticio agregado en la prueba.`;
await db.documentTemplate.update({ where: { id: tpl.id }, data: { body: newBody, version: tpl.version + 1, versions: { create: { version: tpl.version + 1, body: newBody } } } });
ok("Plantilla con nueva versión", (await db.documentTemplate.findUniqueOrThrow({ where: { id: tpl.id } })).version === tpl.version + 1);

// 5. El PDF anterior sigue disponible, idéntico y con sus datos originales
const pdf1b = await get(`/api/documents/${d1.id}/pdf`, "dueno@stroker.demo");
const e1b = await db.document.findUniqueOrThrow({ where: { id: d1.id } });
ok("PDF anterior disponible e idéntico byte a byte", pdf1b.status === 200 && hash(pdf1b.bytes) === e1.pdfSha256);
ok("Datos y versión originales intactos", JSON.stringify(e1b.data) === JSON.stringify(e1.data) && e1b.templateVersion === tpl.version && e1b.bodySnapshot === originalBody);
ok("Texto anterior sin la cláusula nueva", !render(e1b.bodySnapshot!, { ...(e1b.data as Record<string, unknown>), folio: e1b.folio }).includes(MARK));

// 6. Un documento nuevo usa la versión nueva
const d2 = await createDocument("RESERVA", { reservationId: res.id }, admin);
await emitDocument(d2.id, admin);
const e2 = await db.document.findUniqueOrThrow({ where: { id: d2.id } });
ok("Documento nuevo con plantilla nueva", e2.templateVersion === tpl.version + 1 && !!e2.bodySnapshot?.includes(MARK) && e2.folio !== e1.folio, `${e2.folio} v${e2.templateVersion}`);
ok("PDF nuevo distinto al anterior", e2.pdfSha256 !== e1.pdfSha256);

// 7. Permisos en el servidor
ok("Sin sesión → 401", (await get(`/api/documents/${d1.id}/pdf`)).status === 401);
ok("Vendedora de otra sucursal → 404", (await get(`/api/documents/${d1.id}/pdf`, "josefa@stroker.demo")).status === 404);
ok("Fotógrafa sin permiso → 403", (await get(`/api/documents/${d1.id}/pdf`, "foto@stroker.demo")).status === 403);
ok("Archivo privado no accesible por /api/files", (await get(`/api/files/${e1.pdfPath}`, "dueno@stroker.demo")).status === 404);

// 8. Filtros del historial (patente, cliente, folio, tipo, vehículo)
const page = async (q: string) => new TextDecoder().decode((await get(`/panel/documentos?tab=historial&${q}`, "dueno@stroker.demo")).bytes);
ok("Filtro por patente", (await page(`patente=${v.plate}`)).includes(e1.folio));
ok("Filtro por cliente", (await page(`cliente=${encodeURIComponent(contact.name)}`)).includes(e2.folio));
const row = (f: string) => `>${f}</a>`;
ok("Filtro por folio + tipo", (await page(`folio=${e1.folio}&tipo=RESERVA`)).includes(row(e1.folio)) && !(await page(`folio=${e1.folio}&tipo=VENTA`)).includes(row(e1.folio)));
ok("Filtro por vehículo", (await page(`vehiculo=Kia+Sportage&patente=${v.plate}`)).includes(e1.folio));

// Restaurar el texto demo como nueva versión (el historial de versiones se conserva)
await db.documentTemplate.update({ where: { id: tpl.id }, data: { body: originalBody, version: tpl.version + 2, versions: { create: { version: tpl.version + 2, body: originalBody } } } });
console.log(`\n${pass} PASS · ${fail} FAIL`);
await db.$disconnect();
process.exit(fail ? 1 : 0);
