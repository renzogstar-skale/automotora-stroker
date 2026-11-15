// Ventas, Libro y Comisiones: venta propia (con reserva, anticipo, financiamiento) y consignada física, cobro parcial con reintentos,
// ventas concurrentes, reverso y anulación. Contra la BD de desarrollo y `npm run dev`.
// Uso: npx tsx --conditions=react-server scripts/test-sales.mts
import { randomUUID } from "node:crypto";
import { db } from "../src/lib/db";
import { randomToken, sha256 } from "../src/lib/crypto";
import type { Actor } from "../src/lib/rbac";
import { createVehicle, reserveVehicle } from "../src/server/inventory";
import { createConsignment } from "../src/server/consignments";
import { annulSale, confirmSale } from "../src/server/sales";
import { registerPayment, reversePayment } from "../src/server/payments";
import { econ, saleInclude } from "../src/server/economics";

const BASE = process.env.APP_URL ?? "http://localhost:3000";
let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, info = "") => { if (cond) pass++; else fail++; console.log(`${cond ? "PASS" : "FAIL"}  ${name}${info ? ` — ${info}` : ""}`); };
const eq = (name: string, got: unknown, want: unknown) => ok(name, got === want, `obtenido ${got}, esperado ${want}`);

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
const full = (id: string) => db.sale.findUniqueOrThrow({ where: { id }, include: saleInclude });

const admin = await actor("dueno@stroker.demo");
const vale = await actor("valentina@stroker.demo");
const branchId = (await db.branch.findFirstOrThrow({ where: { code: "SCL" } })).id;
const base = { branchId, version: "LX", year: 2021, km: 40000, transmission: "Automática", fuel: "Bencina", bodyType: "SUV", color: "Gris" };
const newOpp = async (vehicleId: string, name: string) => {
  const contact = await db.contact.create({ data: { name, rut: "12.345.678-5", phone: `+569${Math.floor(1e7 + Math.random() * 9e7)}` } });
  return db.opportunity.create({ data: { source: "WEB", stage: "NEGOCIANDO", contactId: contact.id, sellerId: vale.sellerId, branchId, vehicleId } });
};

// ───────── 1. Venta propia: reserva + anticipo + financiamiento ─────────
const own = await createVehicle({ ...base, brand: "Hyundai", model: "Tucson", plate: plate(), condition: "USADO", price: 20_000_000, cost: 16_000_000 }, admin);
await db.vehicle.update({ where: { id: own.id }, data: { published: true } });
const opp1 = await newOpp(own.id, `Comprador Propio ${randomUUID().slice(0, 4)}`);
const res = await reserveVehicle({ vehicleId: own.id, opportunityId: opp1.id, amount: 500_000, days: 3, method: "Transferencia", idempotencyKey: randomUUID() }, vale);
const SALE_KEY = randomUUID();
const input = { vehicleId: own.id, opportunityId: opp1.id, discount: 500_000, payMethod: "FINANCIAMIENTO" as const, financedAmount: 10_000_000, extraIncome: 300_000, creditIncome: 300_000, idempotencyKey: SALE_KEY, downPayment: { amount: 2_000_000, method: "Transferencia" } };
const s1 = await confirmSale(input, vale);
const s1retry = await confirmSale(input, vale);
ok("Reintento de confirmación devuelve la misma venta", s1retry.id === s1.id);

const f1 = await full(s1.id);
let e1 = econ(f1);
const v1 = await db.vehicle.findUniqueOrThrow({ where: { id: own.id } });
ok("Vehículo VENDIDO y despublicado", v1.status === "VENDIDO" && !v1.published);
ok("Oportunidad CONCRETADO", (await db.opportunity.findUniqueOrThrow({ where: { id: opp1.id } })).stage === "CONCRETADO");
ok("Reserva convertida", (await db.reservation.findUniqueOrThrow({ where: { id: res.id } })).status === "CONVERTIDA");
ok("Auditoría de despublicación", !!(await db.auditLog.findFirst({ where: { entityId: own.id, action: "vehicle.unpublish" } })));
const resPays = f1.payments.filter((p) => p.reservationId);
ok("Reserva aplicada como anticipo sin volver a cobrarla", resPays.length === 1 && resPays[0].amount === 500_000 && (await db.payment.count({ where: { reservationId: res.id } })) === 1);
ok("Anticipo cobrado una sola vez pese al reintento", f1.payments.filter((p) => p.idempotencyKey === `anticipo-${SALE_KEY}`).length === 1);
eq("Precio final", f1.finalPrice, 19_500_000);
eq("Cobrado = reserva + anticipo", e1.paid, 2_500_000);
eq("Saldo = precio − cobrado", e1.balance, 17_000_000);
eq("Saldo incluye monto a cobrar a financiera", e1.pendingFinance, 10_000_000);
// Comisiones según reglas demo: vendedor 200.000 (orden 1); gerencia 10% de utilidad restante (orden 2); socios 3/3/4% (orden 3, base común)
eq("Margen bruto propio (19,5M − 16M + 0,3M)", e1.margin, 3_800_000);
const amt = (name: string) => f1.commissions.find((c) => (c.rule as { name: string }).name === name);
eq("Comisión vendedor", amt("Comisión vendedor")?.amount, 200_000);
eq("Gerencia 10% sobre 3.600.000", amt("Gerencia")?.amount, 360_000);
eq("Base explícita gerencia", amt("Gerencia")?.baseAmount, 3_600_000);
eq("Participación 1 (3% de 3.240.000)", amt("Participación 1")?.amount, 97_200);
eq("Participación 3 (4% de 3.240.000)", amt("Participación 3")?.amount, 129_600);
ok("Sin regla de captación en venta propia", !f1.commissions.some((c) => (c.rule as { beneficiary: string }).beneficiary === "CAPTADOR"));
ok("Snapshot de regla con base y vigencia", f1.commissions.every((c) => c.baseLabel && (c.rule as { validFrom?: string }).validFrom));
eq("Comisiones (vendedor/captador)", e1.sellerComm, 200_000);
eq("Reparto (gerencia/socios)", e1.split, 684_000);
eq("Utilidad final", e1.profit, 3_800_000 - 884_000);
ok("Asiento del Libro creado", f1.bookEntry?.status === "VIGENTE" && (f1.bookEntry.snapshot as { costoBaseLabel: string; abonoReserva: number }).costoBaseLabel === "Costo de adquisición" && (f1.bookEntry.snapshot as { abonoReserva: number }).abonoReserva === 500_000);

// ───────── 2. Cobro parcial y reintentos ─────────
const PAY_KEY = randomUUID();
const pay = { saleId: s1.id, amount: 3_000_000, method: "Transferencia", paidAt: new Date(), idempotencyKey: PAY_KEY };
const p1 = await registerPayment(pay, admin);
const p2 = await registerPayment(pay, admin);
const par = await Promise.all([registerPayment(pay, admin), registerPayment(pay, admin), registerPayment(pay, admin)]);
ok("Cobro parcial registrado", !p1.duplicate);
ok("Reintento secuencial marcado como duplicado", p2.duplicate && p2.payment.id === p1.payment.id);
ok("Reintentos simultáneos no duplican", par.every((r) => r.payment.id === p1.payment.id));
eq("Un solo pago y un solo movimiento de caja", (await db.payment.count({ where: { idempotencyKey: PAY_KEY } })) + (await db.movement.count({ where: { paymentId: p1.payment.id } })), 2);
e1 = econ(await full(s1.id));
eq("Saldo tras cobro parcial", e1.balance, 14_000_000);
const over = await registerPayment({ ...pay, amount: 14_000_001, idempotencyKey: randomUUID() }, admin).then(() => false, () => true);
ok("Cobro mayor al saldo rechazado", over);

// Reverso con historial
await reversePayment(p1.payment.id, "Transferencia rechazada (prueba)", admin);
const again = await reversePayment(p1.payment.id, "doble clic", admin);
e1 = econ(await full(s1.id));
eq("Saldo vuelve tras reverso", e1.balance, 17_000_000);
ok("Reverso no se duplica", again === false && (await db.movement.count({ where: { paymentId: p1.payment.id, type: "EGRESO" } })) === 1);

// ───────── 3. Venta consignada física + concurrencia ─────────
const cons = await createConsignment({
  owner: { name: `Propietario ${randomUUID().slice(0, 4)}`, phone: "+56933334444" },
  vehicle: { ...base, brand: "Mazda", model: "CX-30", plate: plate(), price: 17_000_000 },
  modality: "FISICA", agreedPrice: 15_000_000, days: 60, responsibleId: vale.sellerId,
}, admin);
await db.vehicle.update({ where: { id: cons.vehicleId }, data: { published: true } });
const oppA = await newOpp(cons.vehicleId, "Comprador A"), oppB = await newOpp(cons.vehicleId, "Comprador B");
const race = await Promise.allSettled([
  confirmSale({ vehicleId: cons.vehicleId, opportunityId: oppA.id, payMethod: "CONTADO", idempotencyKey: randomUUID() }, vale),
  confirmSale({ vehicleId: cons.vehicleId, opportunityId: oppB.id, payMethod: "CONTADO", idempotencyKey: randomUUID() }, vale),
]);
const won = race.filter((r) => r.status === "fulfilled");
ok("Ventas concurrentes: solo una se confirma", won.length === 1 && (await db.sale.count({ where: { vehicleId: cons.vehicleId, status: "CONFIRMADA" } })) === 1, race.map((r) => r.status === "rejected" ? String(r.reason?.message) : "ok").join(" | "));
const s2 = (won[0] as PromiseFulfilledResult<{ id: string }>).value;
const f2 = await full(s2.id);
const e2 = econ(f2);
const v2 = await db.vehicle.findUniqueOrThrow({ where: { id: cons.vehicleId } });
ok("Consignado: vendido, despublicado y consignación VENDIDA", v2.status === "VENDIDO" && !v2.published && (await db.consignment.findUniqueOrThrow({ where: { id: cons.id } })).status === "VENDIDA");
eq("Costo base = monto a liquidar al propietario", f2.costBasis, 15_000_000);
eq("Margen consignado", e2.margin, 2_000_000);
const amt2 = (name: string) => f2.commissions.find((c) => (c.rule as { name: string }).name === name)?.amount;
eq("Captación física", amt2("Captación consignación física"), 150_000);
ok("Sin captación online", amt2("Captación consignación online") === undefined);
eq("Gerencia 10% de 1.650.000", amt2("Gerencia"), 165_000);
eq("Participación 2 (3% de 1.485.000)", amt2("Participación 2"), 44_550);
eq("Saldo contado", e2.balance, 17_000_000);
ok("Asiento consignado", (f2.bookEntry?.snapshot as { costoBaseLabel?: string })?.costoBaseLabel === "Monto a liquidar al propietario");

// ───────── 4. Libro de Ventas (HTTP) ─────────
const libro = await page("/panel/finanzas/libro", "dueno@stroker.demo");
const n = (x: number) => `L-${String(x).padStart(5, "0")}`;
ok("Libro muestra ambos asientos", libro.status === 200 && libro.body.includes(n(f1.bookEntry!.number)) && libro.body.includes(n(f2.bookEntry!.number)));
ok("Libro distingue ingresado/calculado y reparto", libro.body.includes("ingresado") && libro.body.includes("calculado") && libro.body.includes("Reparto"));
const detail = await page(`/panel/ventas/${s1.id}`, "dueno@stroker.demo");
ok("Ficha de venta con historial de reverso", detail.status === 200 && detail.body.includes("Transferencia rechazada (prueba)"));

// ───────── 5. Anulación con historial ─────────
await annulSale(s1.id, "Cliente desiste (prueba)", admin);
const fa = await full(s1.id);
ok("Anulada: cobros reversados, asiento anulado, unidad disponible", fa.status === "ANULADA" && fa.payments.every((p) => p.status === "REVERSADO") && fa.bookEntry?.status === "ANULADO" && (await db.vehicle.findUniqueOrThrow({ where: { id: own.id } })).status === "DISPONIBLE");
ok("Doble anulación rechazada", await annulSale(s1.id, "otra vez", admin).then(() => false, () => true));

console.log(`\n${pass} PASS · ${fail} FAIL`);
await db.$disconnect();
process.exit(fail ? 1 : 0);
