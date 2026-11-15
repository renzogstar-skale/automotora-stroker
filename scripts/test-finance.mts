// Conciliación Libro ↔ Gestión de fondos ↔ Caja: venta al contado, venta con saldo pendiente y consignación liquidada.
// También: movimientos manuales (socio, pozo, pendiente), métricas independientes, vendedores y ranking por HTTP.
// Uso: APP_URL=http://localhost:3000 npx tsx --conditions=react-server scripts/test-finance.mts
import { randomUUID } from "node:crypto";
import { db } from "../src/lib/db";
import { randomToken, sha256 } from "../src/lib/crypto";
import { parsePeriod } from "../src/lib/period";
import type { Actor } from "../src/lib/rbac";
import { createVehicle } from "../src/server/inventory";
import { createConsignment, payOwner, settlement } from "../src/server/consignments";
import { confirmSale } from "../src/server/sales";
import { registerPayment } from "../src/server/payments";
import { econ, saleInclude } from "../src/server/economics";
import { financeReport, pendingItems } from "../src/server/finance";
import { catId, signed } from "../src/server/categories";

const BASE = process.env.APP_URL ?? "http://localhost:3000";
let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, info = "") => { if (cond) pass++; else fail++; console.log(`${cond ? "PASS" : "FAIL"}  ${name}${info ? ` — ${info}` : ""}`); };
const eq = (name: string, got: unknown, want: unknown) => ok(name, got === want, `obtenido ${got}, esperado ${want}`);

async function actor(email: string): Promise<Actor> {
  const u = await db.user.findUniqueOrThrow({ where: { email }, include: { branches: true, seller: true } });
  return { id: u.id, name: u.name, email: u.email, role: u.role, canPublish: u.canPublish, branchIds: u.branches.map((b) => b.branchId), sellerId: u.seller?.id ?? null };
}
async function page(path: string, email = "dueno@stroker.demo") {
  const u = await db.user.findUniqueOrThrow({ where: { email } });
  const t = randomToken();
  await db.session.create({ data: { userId: u.id, tokenHash: sha256(t), expiresAt: new Date(Date.now() + 3600e3) } });
  const r = await fetch(BASE + path, { headers: { cookie: `stk_session=${t}` }, redirect: "manual" });
  return { status: r.status, body: (await r.text()).replace(/<!-- -->/g, "") };
}
const L = "BCDFGHJKLPRSTVWXYZ";
const plate = () => Array.from({ length: 4 }, () => L[Math.floor(Math.random() * L.length)]).join("") + String(Math.floor(Math.random() * 90) + 10);
const full = async (id: string) => { const s = await db.sale.findUniqueOrThrow({ where: { id }, include: saleInclude }); return { s, e: econ(s) }; };
const cashOf = async (saleId: string) => (await db.movement.findMany({ where: { saleId, isPending: false, scope: "EMPRESA" } })).reduce((a, m) => a + signed(m), 0);

const admin = await actor("dueno@stroker.demo");
const vale = await actor("valentina@stroker.demo");
const branch = await db.branch.findFirstOrThrow({ where: { code: "SCL" } });
const base = { branchId: branch.id, version: "GL", year: 2022, km: 30000, transmission: "Automática", fuel: "Bencina", bodyType: "SUV", color: "Blanco" };
const contact = async (n: string) => (await db.contact.create({ data: { name: `${n} ${randomUUID().slice(0, 4)}`, phone: `+569${Math.floor(1e7 + Math.random() * 9e7)}` } })).id;
const period = parsePeriod({});
const before = await financeReport(period, [branch.id]);
const pendBefore = await pendingItems([branch.id]);

// ───────── A. Venta propia al contado, pagada completa (con reintentos) ─────────
const vA = await createVehicle({ ...base, brand: "Kia", model: "Sportage", plate: plate(), condition: "USADO", price: 10_000_000, cost: 8_000_000 }, admin);
const sA = await confirmSale({ vehicleId: vA.id, contactId: await contact("Contado"), sellerId: vale.sellerId, payMethod: "CONTADO", idempotencyKey: randomUUID() }, vale);
const kA = randomUUID();
const payA = { saleId: sA.id, amount: 10_000_000, method: "Transferencia", paidAt: new Date(), idempotencyKey: kA };
await Promise.all([registerPayment(payA, admin), registerPayment(payA, admin), registerPayment(payA, admin)]);
const A = await full(sA.id);
eq("A · un solo pago pese a 3 reintentos simultáneos", await db.payment.count({ where: { idempotencyKey: kA } }), 1);
eq("A · Libro: saldo 0", A.e.balance, 0);
eq("A · Caja de la venta = cobrado", await cashOf(sA.id), A.e.paid);
eq("A · Utilidad (10M − 8M − comisiones)", A.e.profit, 2_000_000 - A.e.commissions);

// ───────── B. Venta propia con saldo pendiente ─────────
const vB = await createVehicle({ ...base, brand: "Toyota", model: "RAV4", plate: plate(), condition: "USADO", price: 12_000_000, cost: 9_500_000 }, admin);
const sB = await confirmSale({ vehicleId: vB.id, contactId: await contact("Saldo"), sellerId: vale.sellerId, payMethod: "CONTADO", idempotencyKey: randomUUID(), balanceDueAt: new Date(Date.now() + 7 * 864e5), downPayment: { amount: 4_000_000, method: "Transferencia" } }, vale);
const B = await full(sB.id);
eq("B · Libro: saldo pendiente", B.e.balance, 8_000_000);
eq("B · Caja de la venta = anticipo", await cashOf(sB.id), 4_000_000);
const pendAfterB = await pendingItems([branch.id]);
eq("B · Fondos: aparece en saldos pendientes con el mismo saldo", pendAfterB.receivables.find((x) => x.id === sB.id)?.econ.balance, 8_000_000);

// ───────── C. Consignación física: venta + cobro + liquidación al propietario ─────────
const cons = await createConsignment({ owner: { name: `Dueño ${randomUUID().slice(0, 4)}`, phone: "+56955556666" }, vehicle: { ...base, brand: "Subaru", model: "Forester", plate: plate(), price: 17_000_000 }, modality: "FISICA", agreedPrice: 15_000_000, days: 60, responsibleId: vale.sellerId }, admin);
const sC = await confirmSale({ vehicleId: cons.vehicleId, contactId: await contact("Consigna"), sellerId: vale.sellerId, payMethod: "CONTADO", idempotencyKey: randomUUID() }, vale);
await registerPayment({ saleId: sC.id, amount: 17_000_000, method: "Transferencia", paidAt: new Date(), idempotencyKey: randomUUID() }, admin);
eq("C · Fondos: liquidación pendiente 15M", (await pendingItems([branch.id])).payouts.find((x) => x.c.id === cons.id)?.due, 15_000_000);
const kP = randomUUID();
await Promise.all([payOwner(cons.id, 10_000_000, kP, admin), payOwner(cons.id, 10_000_000, kP, admin)]);
eq("C · Liquidación parcial registrada una vez", await db.ownerPayout.count({ where: { idempotencyKey: kP } }), 1);
eq("C · Por liquidar tras parcial", (await settlement(cons.id)).pending, 5_000_000);
const race = await Promise.allSettled([payOwner(cons.id, 5_000_000, randomUUID(), admin), payOwner(cons.id, 5_000_000, randomUUID(), admin)]);
ok("C · Liquidaciones concurrentes no superan lo acordado", race.filter((r) => r.status === "fulfilled").length === 1 && (await settlement(cons.id)).paid === 15_000_000);
ok("C · Consignación CERRADA y fuera de liquidaciones pendientes", (await db.consignment.findUniqueOrThrow({ where: { id: cons.id } })).status === "CERRADA" && !(await pendingItems([branch.id])).payouts.some((x) => x.c.id === cons.id));
const C = await full(sC.id);
eq("C · Libro: margen = precio − monto a liquidar", C.e.margin, 2_000_000);
eq("C · Caja de la venta = cobro − liquidación = margen", await cashOf(sC.id), C.e.margin);
eq("C · Libro: saldo cliente 0", C.e.balance, 0);

// ───────── D. Métricas independientes del período (deltas) ─────────
const after = await financeReport(period, [branch.id]);
eq("Monto vendido = Σ precios finales", after.sold.amount - before.sold.amount, 39_000_000);
eq("Utilidad (Libro) = Σ utilidad final", after.sold.profit - before.sold.profit, A.e.profit + B.e.profit + C.e.profit);
const cobros = (r: typeof after) => r.moves.filter((m) => m.scope === "EMPRESA" && ["Cobro de venta", "Cobro de reserva"].includes(m.category.name)).reduce((t, m) => t + signed(m), 0);
eq("Cobros = 10M + 4M + 17M", cobros(after) - cobros(before), 31_000_000);
eq("Saldo de caja = cobros − liquidaciones (16M)", (after.cash.in - after.cash.out) - (before.cash.in - before.cash.out), 16_000_000);
eq("Saldos pendientes de clientes crecen solo por B", pendAfterB.receivables.reduce((t, x) => t + x.econ.balance, 0) - pendBefore.receivables.reduce((t, x) => t + x.econ.balance, 0), 8_000_000);
ok("Vendido ≠ cobrado ≠ caja ≠ utilidad (métricas independientes)", new Set([39_000_000, 31_000_000, 16_000_000, after.sold.profit - before.sold.profit]).size === 4);

// ───────── E. Movimientos manuales: socio, pozo, pendiente ─────────
const partner = await db.partner.findFirstOrThrow();
const pend = await db.movement.create({ data: { date: new Date(), type: "INGRESO", categoryId: await catId("Otros ingresos"), amount: 123_000, description: "Cobro pendiente prueba", tags: ["prueba"], branchId: branch.id, isPending: true, dueDate: new Date(Date.now() + 864e5) } });
await db.movement.create({ data: { date: new Date(), type: "EGRESO", categoryId: await catId("Gastos generales"), amount: 77_000, description: "Gasto socio fuera de empresa", tags: ["prueba"], scope: "SOCIO", partnerId: partner.id, branchId: branch.id } });
await db.movement.create({ data: { date: new Date(), type: "EGRESO", categoryId: await catId("Fondo de ahorro (pozo)"), amount: 50_000, description: "Aporte al pozo", tags: ["prueba"], branchId: branch.id, pozo: true } });
const afterE = await financeReport(period, [branch.id]);
eq("Pendiente y gasto de socio no tocan la caja; pozo sí", (afterE.cash.in - afterE.cash.out) - (after.cash.in - after.cash.out), -50_000);
eq("Pozo no es gasto de resultado", afterE.kpi.opex, after.kpi.opex);
ok("Pendiente listado en cobros pendientes", (await pendingItems([branch.id])).pendingMoves.some((m) => m.id === pend.id));

// ───────── F. Páginas ─────────
const mov = await page("/panel/finanzas/movimientos");
ok("Gastos e ingresos: pozo y pendientes", mov.status === 200 && mov.body.includes("Pozo") && mov.body.includes("Pendiente"));
const fondos = await page("/panel/finanzas/fondos");
ok("Fondos: KPIs clave", fondos.status === 200 && ["Facturación del período", "Capital invertido", "Saldos pendientes", "Liquidaciones", "Días en stock", "Crédito frente a contado", "Referidos"].every((k) => fondos.body.includes(k)));
ok("Fondos: vista por día", (await page("/panel/finanzas/fondos?group=day")).body.includes("por día"));
const vend = await page("/panel/vendedores");
ok("Vendedores: meta y cuenta vinculada", vend.status === 200 && vend.body.includes("Meta mensual") && vend.body.includes("Vinculada"));
const rk = await page(`/panel/finanzas/ranking?branch=${branch.id}`);
ok("Ranking ventas: margen y variación", rk.status === 200 && rk.body.includes("Margen bruto") && rk.body.includes("Δ monto"));
const rkc = await page(`/panel/finanzas/ranking?tab=consignaciones&branch=${branch.id}`);
ok("Ranking consignaciones separado", rkc.status === 200 && rkc.body.includes("Físicas") && rkc.body.includes("Online"));

console.log(`\n${pass} PASS · ${fail} FAIL`);
await db.$disconnect();
process.exit(fail ? 1 : 0);
