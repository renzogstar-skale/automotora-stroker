// Inventario, consignación, álbum y reservas (bloqueo concurrente + expiración). Contra la BD de desarrollo y `npm run dev`.
// Uso: npx tsx --conditions=react-server scripts/test-inventory.mts
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { db } from "../src/lib/db";
import { randomToken, sha256 } from "../src/lib/crypto";
import { can, type Actor } from "../src/lib/rbac";
import { createVehicle, expireReservations, reserveVehicle, setPublished } from "../src/server/inventory";
import { createConsignment } from "../src/server/consignments";
import { savePublicImage } from "../src/server/storage";

const BASE = process.env.APP_URL ?? "http://localhost:3000";
let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, info = "") => { if (cond) pass++; else fail++; console.log(`${cond ? "PASS" : "FAIL"}  ${name}${info ? ` — ${info}` : ""}`); };

async function actor(email: string): Promise<Actor> {
  const u = await db.user.findUniqueOrThrow({ where: { email }, include: { branches: true, seller: true } });
  return { id: u.id, name: u.name, email: u.email, role: u.role, canPublish: u.canPublish, branchIds: u.branches.map((b) => b.branchId), sellerId: u.seller?.id ?? null };
}
async function page(path: string, email: string) {
  const u = await db.user.findUniqueOrThrow({ where: { email } });
  const t = randomToken();
  await db.session.create({ data: { userId: u.id, tokenHash: sha256(t), expiresAt: new Date(Date.now() + 3600e3) } });
  const r = await fetch(BASE + path, { headers: { cookie: `stk_session=${t}` }, redirect: "manual" });
  return { status: r.status, body: await r.text() };
}
const L = "BCDFGHJKLPRSTVWXYZ";
const plate = () => Array.from({ length: 4 }, () => L[Math.floor(Math.random() * L.length)]).join("") + String(Math.floor(Math.random() * 90) + 10);

const admin = await actor("dueno@stroker.demo");
const foto = await actor("foto@stroker.demo");
const branchId = (await db.branch.findFirstOrThrow({ where: { code: "SCL" } })).id;
const base = { branchId, version: "2.0", year: 2021, km: 42000, transmission: "Automática", fuel: "Bencina", bodyType: "SUV", color: "Gris" };

// 1. Ingreso de vehículo propio
const own = await createVehicle({ ...base, brand: "Toyota", model: "RAV4", plate: plate(), vin: "JTMW1RFV0MD000001", condition: "USADO", price: 21_990_000, cost: 18_500_000 }, admin);
ok("Vehículo propio ingresado", own.ownership === "PROPIO" && own.status === "DISPONIBLE", own.plate);

// 2. Ingreso de vehículo consignado (vinculado a tasación)
const ap = await db.appraisal.create({ data: { plate: plate(), kind: "AUTO", brand: "Mazda", model: "CX-5", year: 2019, km: 61000, condition: "BUENO", minValue: 14e6, maxValue: 16e6, suggested: 15e6, source: "Modelo referencial Stroker (demo)", sourceDate: new Date(), isDemo: true } });
const cons = await createConsignment({
  owner: { name: "Propietario Prueba", phone: "+56911112222" },
  vehicle: { ...base, brand: "Mazda", model: "CX-5", plate: ap.plate, price: 16_490_000 },
  modality: "ONLINE", agreedPrice: 15_000_000, days: 45, appraisalId: ap.id, documents: { padron: true, mandato: true },
}, admin);
const cv = await db.vehicle.findUniqueOrThrow({ where: { id: cons.vehicleId } });
ok("Vehículo consignado ingresado", cv.ownership === "CONSIGNADO" && cv.cost === 15_000_000 && cons.commission === 1_490_000, cv.plate);
ok("Tasación vinculada a la consignación", (await db.appraisal.findUniqueOrThrow({ where: { id: ap.id } })).vehicleId === cv.id);

// 3. Fotos: carga, portada y orden; permisos de fotógrafo
const img = new File([await readFile("public/demo/toyota-rav4-1.jpg")], "rav4.jpg", { type: "image/jpeg" });
for (const v of [own, cv]) for (let i = 0; i < 2; i++)
  await db.vehiclePhoto.create({ data: { vehicleId: v.id, url: await savePublicImage(v.id, img), order: i, isCover: i === 0 } });
const photos = await db.vehiclePhoto.findMany({ where: { vehicleId: { in: [own.id, cv.id] } } });
ok("Fotos cargadas en ambos álbumes", photos.length === 4 && photos.filter((p) => p.isCover).length === 2);
const served = await fetch(BASE + photos[0].url);
ok("Foto servida por /api/files", served.status === 200 && (served.headers.get("content-type") ?? "").startsWith("image/"), String(served.status));
ok("Fotógrafo accede a álbumes", can(foto, "albums"));
ok("Fotógrafo sin permiso de publicar", foto.canPublish || !can(foto, "web.publish"));
if (!foto.canPublish) { try { await setPublished(own.id, true, foto); ok("Fotógrafo no puede publicar", false); } catch { ok("Fotógrafo no puede publicar", true); } }
await setPublished(own.id, true, admin);
ok("Publicación con portada", (await db.vehicle.findUniqueOrThrow({ where: { id: own.id } })).published);

// 4. Reservas simultáneas: solo una gana
const contacts = await db.contact.findMany({ take: 2, orderBy: { createdAt: "asc" } });
const results = await Promise.allSettled(contacts.map((c) =>
  reserveVehicle({ vehicleId: own.id, contactId: c.id, amount: 200_000, days: 3, idempotencyKey: randomUUID() }, admin)));
const won = results.filter((r) => r.status === "fulfilled"), lost = results.filter((r) => r.status === "rejected");
ok("Dos reservas simultáneas → una aceptada, una rechazada", won.length === 1 && lost.length === 1, lost.map((r) => (r as PromiseRejectedResult).reason.message).join());
ok("Una sola reserva ACTIVA en BD", (await db.reservation.count({ where: { vehicleId: own.id, status: "ACTIVA" } })) === 1);
ok("Vehículo queda RESERVADO", (await db.vehicle.findUniqueOrThrow({ where: { id: own.id } })).status === "RESERVADO");
try {
  await db.reservation.create({ data: { vehicleId: own.id, contactId: contacts[0].id, amount: 0, expiresAt: new Date(Date.now() + 864e5) } });
  ok("Índice único parcial bloquea segunda ACTIVA (escritura directa)", false);
} catch (e) { ok("Índice único parcial bloquea segunda ACTIVA (escritura directa)", (e as { code?: string }).code === "P2002"); }
const res = (won[0] as PromiseFulfilledResult<{ id: string }>).value;
ok("Abono de la reserva registrado", (await db.payment.count({ where: { reservationId: res.id } })) === 1);
const detail = await page(`/panel/inventario/${own.id}`, admin.email);
ok("Ficha muestra bloqueo de reserva", detail.status === 200 && detail.body.includes("No se aceptan nuevas reservas"), String(detail.status));

// 5. Expiración: la reserva vence y la unidad vuelve a estar disponible
await db.reservation.update({ where: { id: res.id }, data: { expiresAt: new Date(Date.now() - 60_000) } });
const n = await expireReservations(own.id);
const after = await db.reservation.findUniqueOrThrow({ where: { id: res.id } });
ok("Reserva vencida pasa a EXPIRADA", n === 1 && after.status === "EXPIRADA" && after.endReason === "Plazo vencido");
ok("Vehículo vuelve a DISPONIBLE", (await db.vehicle.findUniqueOrThrow({ where: { id: own.id } })).status === "DISPONIBLE");
const again = await reserveVehicle({ vehicleId: own.id, contactId: contacts[1].id, amount: 0, days: 1, idempotencyKey: randomUUID() }, admin);
ok("Nueva reserva posible tras expirar", again.status === "ACTIVA");

// 6. Cron de expiración protegido
const cron = await fetch(BASE + "/api/cron/reservas");
ok("Cron sin token → 401", cron.status === 401);

// 7. Pantallas
for (const p of ["/panel/inventario?view=cards&ownership=CONSIGNADO", "/panel/inventario", `/panel/albumes/${cv.id}`, `/panel/consignaciones/${cons.id}`, `/panel/tasacion?resultado=${ap.id}`, "/panel/albumes?tab=listos"]) {
  const r = await page(p, admin.email);
  ok(`GET ${p}`, r.status === 200 && !r.body.includes("Ocurrió un error"), String(r.status));
}
const fp = await page(`/panel/albumes/${own.id}`, foto.email);
ok("Fotógrafo ve el álbum sin botón Publicar", fp.status === 200 && (foto.canPublish || !/>Despublicar<|>Publicar</.test(fp.body)));
const exp = await page("/api/export/inventario?ownership=CONSIGNADO", admin.email);
ok("Exportación CSV incluye el consignado", exp.status === 200 && exp.body.includes(cv.plate));

console.log(`\n${pass} PASS · ${fail} FAIL`);
await db.$disconnect();
process.exit(fail ? 1 : 0);
