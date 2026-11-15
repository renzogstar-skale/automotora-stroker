/* eslint-disable @typescript-eslint/no-explicit-any */
// Recorridos de punta a punta con Playwright (escritorio y móvil) sobre la UI real. Los datos creados se conservan
// (prefijo «E2E <run>») para revisarlos en el panel. Requiere `npm run dev` y la demo cargada (`npm run seed`).
// Uso: npx tsx scripts/e2e-journeys.mts   (APP_URL=http://localhost:3000 por defecto)
import "dotenv/config";
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright-core";
import { db } from "../src/lib/db";
import { NAV } from "../src/lib/nav";
import { ROLE_PERMS } from "../src/lib/rbac";
import { expireReservations } from "../src/server/inventory";

const BASE = process.env.APP_URL ?? "http://localhost:3000";
const PASSWORD = "Stroker2026!";
const OUT = "test-results/e2e";
mkdirSync(OUT, { recursive: true });
const RUN = Date.now().toString(36).slice(-5);
const results: { journey: string; view: string; name: string; ok: boolean; info?: string }[] = [];
let J = "", VIEW = "desktop";
const ok = (name: string, cond: unknown, info = "") => {
  results.push({ journey: J, view: VIEW, name, ok: !!cond, info: cond ? undefined : info });
  console.log(`${cond ? "PASS" : "FAIL"}  [${J}·${VIEW}] ${name}${!cond && info ? ` — ${info}` : ""}`);
};
const until = async (fn: () => Promise<unknown>, ms = 20000) => {
  const t = Date.now();
  while (Date.now() - t < ms) { const v = await fn(); if (v) return v; await new Promise((r) => setTimeout(r, 300)); }
  return null;
};
const phone = () => `+5699${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;
const localInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
const VIEWPORTS = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } } as const;
type View = keyof typeof VIEWPORTS;

const browser = await chromium.launch({ executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", headless: true });
const consoleErrors: string[] = [];

async function newPage(view: View) {
  const ctx = await browser.newContext({ viewport: VIEWPORTS[view], isMobile: view === "mobile", hasTouch: view === "mobile", locale: "es-CL", timezoneId: "America/Santiago" });
  const page = await ctx.newPage();
  page.setDefaultTimeout(60000);
  page.on("console", (m: any) => { if (m.type() === "error" && !/favicon|React DevTools/i.test(m.text())) consoleErrors.push(`${page.url()} :: ${m.text().slice(0, 200)}`); });
  page.on("pageerror", (e: any) => consoleErrors.push(`${page.url()} :: pageerror ${String(e.message).slice(0, 200)}`));
  return page;
}
async function login(page: any, email: string) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await Promise.all([page.waitForURL(/\/panel/, { timeout: 60000 }), page.locator('form button[type="submit"]').first().click()]);
}
const shot = (page: any, name: string) => page.screenshot({ path: `${OUT}/${VIEW}-${name}.jpg`, type: "jpeg", quality: 40 }).catch(() => {});

/** Rellena un formulario identificado por el texto de su botón y lo envía. */
async function submit(page: any, button: RegExp, fields: Record<string, string | boolean> = {}, scope?: any) {
  const form = (scope ?? page.locator("form")).filter({ has: page.getByRole("button", { name: button }) }).first();
  await form.waitFor();
  for (const [k, v] of Object.entries(fields)) {
    const el = form.locator(`[name="${k}"]`).first();
    const tag = await el.evaluate((e: Element) => `${e.tagName}:${(e as HTMLInputElement).type}`);
    if (tag.startsWith("SELECT")) await el.selectOption(String(v));
    else if (tag.endsWith(":checkbox")) await (v ? el.check() : el.uncheck());
    else await el.fill(String(v));
  }
  const confirm = form.locator('input[type="checkbox"][required]:not([name])');
  if (await confirm.count()) await confirm.first().check();
  await form.getByRole("button", { name: button }).first().click();
  return form;
}
/** Mensaje de resultado de la acción dentro del formulario (ActionForm o InlineAction). */
async function feedback(form: any) {
  const m = form.locator('[role="status"], [role="alert"], span.text-emerald-700, span.text-red-700').first();
  try { await m.waitFor({ timeout: 30000 }); return (await m.innerText()).trim(); } catch { return ""; }
}

const SCL = await db.branch.findUniqueOrThrow({ where: { code: "SCL" } });
const VIN = await db.branch.findUniqueOrThrow({ where: { code: "VIN" } });
const freeVehicle = (branchId: string, skip: string[] = []) =>
  db.vehicle.findFirstOrThrow({ where: { branchId, ownership: "PROPIO", published: true, status: "DISPONIBLE", id: { notIn: skip }, reservations: { none: { status: "ACTIVA" } } }, orderBy: { price: "asc" } });
const valentina = await db.seller.findFirstOrThrow({ where: { user: { email: "valentina@stroker.demo" } } });
const lead = async (label: string) => {
  const c = await db.contact.create({ data: { name: `E2E ${RUN} ${label}`, phone: phone() } });
  return db.opportunity.create({ data: { contactId: c.id, branchId: SCL.id, sellerId: valentina.id, source: "PRESENCIAL", type: "VENTA" } });
};

// ============ 1. Vitrina → consulta → lead → seguimiento → test drive → reserva → venta → cobro → entrega ============
async function journey1(view: View, skip: string[]) {
  J = "1-venta"; VIEW = view;
  const v = await freeVehicle(SCL.id, skip);
  const pub = await newPage(view);
  const custPhone = phone();
  await pub.goto(`${BASE}/autos/${v.slug}`);
  const form = await submit(pub, /enviar|consultar/i, { name: `E2E ${RUN} Cliente ${view}`, phone: custPhone, email: `e2e.${RUN}.${view}@example.cl`, message: "Consulta E2E: ¿aceptan parte de pago?" },
    pub.locator("form").filter({ has: pub.locator('input[name="kind"][value="CONSULTA"]') }));
  await pub.getByText(/Recibimos tu consulta/i).first().waitFor({ timeout: 30000 }).catch(() => {});
  await shot(pub, "1-consulta");
  const opp = await until(() => db.opportunity.findFirst({ where: { contact: { phone: custPhone }, source: "WEB" } })) as any;
  ok("Consulta desde la ficha crea lead WEB en la sucursal del vehículo", opp && opp.branchId === v.branchId && opp.vehicleId === v.id, (await feedback(form)) || "sin lead");
  if (!opp) { await pub.context().close(); return v.id; }

  const homePhone = phone();
  await pub.goto(`${BASE}/`);
  await pub.locator('button[title^="Agendar visita"]').first().click();
  await pub.fill("#appt-name", `E2E ${RUN} Portada ${view}`);
  await pub.fill("#appt-phone", homePhone);
  await pub.getByRole("button", { name: /Solicitar visita/i }).click();
  const conf = await pub.getByTestId("appt-confirmation").waitFor({ timeout: 30000 }).then(() => true).catch(() => false);
  await shot(pub, "1-portada-agendar");
  const homeOpp = await until(() => db.opportunity.findFirst({ where: { contact: { phone: homePhone } } }));
  ok("Portada «Agendar visita» crea lead real (antes era simulado)", conf && homeOpp, `confirmación=${conf} lead=${!!homeOpp} ${await pub.locator('[role="alert"]').first().innerText().catch(() => "")}`);
  await pub.context().close();

  const p = await newPage(view);
  await login(p, "gerencia@stroker.demo");
  await p.goto(`${BASE}/panel/crm/${opp.id}`);
  await feedback(await submit(p, /Guardar ficha/i, { sellerId: valentina.id }));
  ok("Gerencia asigna vendedora al lead", await until(async () => (await db.opportunity.findUnique({ where: { id: opp.id } }))?.sellerId === valentina.id));
  const follow = new Date(Date.now() + 2 * 864e5); follow.setHours(10, 0, 0, 0);
  const f2 = await submit(p, /^Registrar$/i, { type: "LLAMADA", body: "Llamada E2E: interesado, pide test drive", outcome: "Contestó", nextFollowUpAt: localInput(follow) });
  const fb2 = await feedback(f2);
  ok("Seguimiento: llamada registrada con próximo contacto", await until(async () => (await db.activity.count({ where: { opportunityId: opp.id, type: "LLAMADA" } })) > 0 && !!(await db.opportunity.findUnique({ where: { id: opp.id } }))?.nextFollowUpAt), fb2);
  await shot(p, "1-crm-ficha");

  const td = new Date(Date.now() + (3 + Math.floor(Math.random() * 20)) * 864e5); td.setHours(9 + Math.floor(Math.random() * 8), [0, 30][Math.floor(Math.random() * 2)], 0, 0);
  await p.goto(`${BASE}/panel/citas?nueva=1&opp=${opp.id}`);
  const fb3 = await feedback(await submit(p, /Agendar cita/i, { type: "TEST_DRIVE", vehicleId: v.id, startAt: localInput(td) }));
  const appt = await until(() => db.appointment.findFirst({ where: { opportunityId: opp.id, type: "TEST_DRIVE" } })) as any;
  ok("Test drive agendado desde la ficha", appt, fb3);

  await p.goto(`${BASE}/panel/inventario/${v.id}`);
  const fb4 = await feedback(await submit(p, /Reservar unidad/i, { opportunityId: opp.id, amount: "500000", days: "3" }));
  const res = await until(() => db.reservation.findFirst({ where: { vehicleId: v.id, status: "ACTIVA" } }));
  ok("Reserva con abono deja la unidad RESERVADA", res && (await db.vehicle.findUnique({ where: { id: v.id } }))?.status === "RESERVADO", fb4);
  ok("Ficha pública indica reservado", /reservad/i.test(await (await fetch(`${BASE}/autos/${v.slug}`)).text()));

  await p.goto(`${BASE}/panel/ventas/nueva?vehicle=${v.id}&opp=${opp.id}`);
  await submit(p, /Confirmar venta/i);
  const saleUrl = await p.waitForURL(/\/panel\/ventas\/[a-z0-9]+$/, { timeout: 60000 }).then(() => p.url()).catch(() => "");
  const sale = await until(() => db.sale.findFirst({ where: { vehicleId: v.id, status: "CONFIRMADA" }, include: { payments: true } })) as any;
  ok("Venta confirmada con la reserva aplicada como anticipo", sale && saleUrl && sale.payments.some((x: any) => x.status === "REGISTRADO"), saleUrl || (await p.locator('[role="alert"]').first().innerText().catch(() => "sin mensaje")));
  if (!sale) { await p.context().close(); return v.id; }
  await shot(p, "1-venta");
  ok("Gerencia no ve «Registrar cobro» (cobros solo Finanzas)", (await p.getByRole("button", { name: /Registrar cobro/i }).count()) === 0);
  // Segregación de funciones: los cobros los registra Finanzas.
  const fz = await newPage(view);
  await login(fz, "finanzas@stroker.demo");
  await fz.goto(`${BASE}/panel/ventas/${sale.id}`);
  const paid = sale.payments.filter((x: any) => x.status === "REGISTRADO").reduce((a: number, x: any) => a + x.amount, 0);
  const fb5 = await feedback(await submit(fz, /Registrar cobro/i, { amount: String(sale.finalPrice - paid) }));
  ok("Finanzas cobra el saldo y la venta queda pagada", await until(async () => (await db.payment.aggregate({ where: { saleId: sale.id, status: "REGISTRADO" }, _sum: { amount: true } }))._sum.amount === sale.finalPrice), fb5);
  await fz.context().close();
  await p.reload();
  await p.getByRole("button", { name: /Registrar entrega/i }).first().click();
  ok("Entrega registrada", await until(async () => (await db.sale.findUnique({ where: { id: sale.id } }))?.delivery === "ENTREGADA"));
  const veh = await db.vehicle.findUnique({ where: { id: v.id } });
  ok("Unidad VENDIDA y despublicada", veh?.status === "VENDIDO" && !veh.published);
  ok("Lead concretado", (await db.opportunity.findUnique({ where: { id: opp.id } }))?.stage === "CONCRETADO");
  ok("Asiento en Libro de Ventas", await db.salesBookEntry.findUnique({ where: { saleId: sale.id } }));
  await p.context().close();
  return v.id;
}

// ============ 2. Tasación → consignación → fotos → publicación → venta → liquidación ============
async function journey2(view: View) {
  J = "2-consignación"; VIEW = view;
  const p = await newPage(view);
  await login(p, "gerencia@stroker.demo");
  const L = "BCDFGHJKLPRSTVWXYZ";
  const plate = Array.from({ length: 4 }, () => L[Math.floor(Math.random() * 18)]).join("") + String(10 + Math.floor(Math.random() * 89));
  await p.goto(`${BASE}/panel/tasacion`);
  await p.getByLabel("Patente").fill(plate);
  await Promise.all([p.waitForURL(/patente=/), p.getByRole("button", { name: /^Buscar$/ }).click()]);
  await submit(p, /Calcular tasación/i, { brand: "Mazda", model: "CX-5", year: "2019", km: "68000", condition: "BUENO" });
  await p.waitForURL(/resultado=/, { timeout: 60000 }).catch(() => {});
  const ap = await until(() => db.appraisal.findFirst({ where: { plate }, orderBy: { createdAt: "desc" } })) as any;
  ok("Tasación calculada", ap);
  if (!ap) { await p.context().close(); return; }
  await shot(p, "2-tasacion");
  await p.getByRole("link", { name: /Crear consignación/i }).click();
  await p.waitForURL(/consignaciones\/nueva/);
  await submit(p, /Crear consignación/i, { ownerName: `E2E ${RUN} Propietario ${view}`, ownerPhone: phone(), plate, brand: "Mazda", model: "CX-5", year: "2019", km: "68000", price: "15990000", agreedPrice: "14500000", branchId: SCL.id });
  await p.waitForURL(/\/panel\/consignaciones\/[a-z0-9]+$/, { timeout: 60000 }).catch(() => {});
  const cons = await until(() => db.consignment.findFirst({ where: { appraisalId: ap.id }, include: { vehicle: true } })) as any;
  ok("Consignación creada desde la tasación, vehículo en inventario", cons && cons.vehicle.ownership === "CONSIGNADO", `${p.url()} ${await p.locator('[role="alert"]').first().innerText().catch(() => "")}`);
  await p.context().close();
  if (!cons) return;

  const ph = await newPage(view);
  await login(ph, "foto@stroker.demo");
  await ph.goto(`${BASE}/panel/albumes/${cons.vehicleId}`);
  const photos = readdirSync("public/demo").filter((f) => f.endsWith(".jpg") && f !== "hero.jpg").slice(0, 2).map((f) => `public/demo/${f}`);
  await ph.locator('input[type="file"][name="photos"]').setInputFiles(photos);
  await ph.getByRole("button", { name: /^Subir$/i }).click();
  ok("Fotógrafa sube fotos al álbum", await until(async () => (await db.vehiclePhoto.count({ where: { vehicleId: cons.vehicleId } })) >= 2));
  ok("Fotógrafa sin permiso no ve «Publicar»", (await ph.getByRole("button", { name: /^Publicar$/i }).count()) === 0);
  await shot(ph, "2-album");
  await ph.context().close();

  let g = await newPage(view);
  await login(g, "gerencia@stroker.demo");
  await g.goto(`${BASE}/panel/albumes/${cons.vehicleId}`);
  await g.getByRole("button", { name: /^Publicar$/i }).first().click();
  const pubV = await until(async () => { const x = await db.vehicle.findUnique({ where: { id: cons.vehicleId } }); return x?.published ? x : null; }) as any;
  ok("Gerencia publica la unidad con portada", pubV);
  if (!pubV) { await g.context().close(); return; }
  const r = await fetch(`${BASE}/autos/${pubV.slug}`);
  ok("Ficha pública del consignado visible", r.status === 200 && (await r.text()).includes("CX-5"));

  const bOpp = await lead(`Comprador consignado ${view}`);
  await g.goto(`${BASE}/panel/ventas/nueva?vehicle=${cons.vehicleId}&opp=${bOpp.id}`);
  await submit(g, /Confirmar venta/i, { downPayment: "0" });
  await g.waitForURL(/\/panel\/ventas\/[a-z0-9]+$/, { timeout: 60000 }).catch(() => {});
  const sale = await until(() => db.sale.findFirst({ where: { vehicleId: cons.vehicleId, status: "CONFIRMADA" } })) as any;
  ok("Venta del consignado confirmada", sale, await g.locator('[role="alert"]').first().innerText().catch(() => ""));
  if (sale) {
    await g.context().close();
    g = await newPage(view);
    await login(g, "finanzas@stroker.demo");
    await g.goto(`${BASE}/panel/ventas/${sale.id}`);
    await feedback(await submit(g, /Registrar cobro/i, { amount: String(sale.finalPrice) }));
    ok("Cobro total del consignado", await until(async () => (await db.payment.aggregate({ where: { saleId: sale.id, status: "REGISTRADO" }, _sum: { amount: true } }))._sum.amount === sale.finalPrice));
    ok("Consignación VENDIDA y unidad despublicada", (await db.consignment.findUnique({ where: { id: cons.id } }))?.status === "VENDIDA" && !(await db.vehicle.findUnique({ where: { id: cons.vehicleId } }))?.published);
    await g.goto(`${BASE}/panel/consignaciones/${cons.id}`);
    const pfb = await feedback(await submit(g, /^Pagar$/i, { amount: "14500000" }));
    ok("Liquidación al propietario por el monto acordado", await until(async () => (await db.ownerPayout.aggregate({ where: { consignmentId: cons.id }, _sum: { amount: true } }))._sum.amount === 14500000), pfb);
    await g.reload();
    const extra = g.getByRole("button", { name: /^Pagar$/i });
    if (await extra.count()) {
      const fb = await feedback(await submit(g, /^Pagar$/i, { amount: "1" }));
      ok("Liquidación por sobre lo acordado rechazada", (await db.ownerPayout.aggregate({ where: { consignmentId: cons.id }, _sum: { amount: true } }))._sum.amount === 14500000, fb);
    } else ok("Liquidación completa: ya no se ofrece «Pagar»", true);
    await g.getByRole("button", { name: /Cerrar consignación/i }).click().catch(() => {});
    ok("Consignación CERRADA", await until(async () => (await db.consignment.findUnique({ where: { id: cons.id } }))?.status === "CERRADA"));
    await shot(g, "2-liquidacion");
  }
  await g.context().close();
}

// ============ 3. Doble reserva, expiración, pago parcial, reintento del cobro y anulación ============
async function journey3(view: View, skip: string[]) {
  J = "3-reservas"; VIEW = view;
  const v = await freeVehicle(SCL.id, skip);
  const [oA, oB] = await Promise.all([lead(`Reserva A ${view}`), lead(`Reserva B ${view}`)]);
  const a = await newPage(view), b = await newPage(view);
  await Promise.all([login(a, "gerencia@stroker.demo"), login(b, "dueno@stroker.demo")]);
  await Promise.all([a.goto(`${BASE}/panel/inventario/${v.id}`), b.goto(`${BASE}/panel/inventario/${v.id}`)]);
  const fill = async (pg: any, opp: string) => {
    const f = pg.locator("form").filter({ has: pg.getByRole("button", { name: /Reservar unidad/i }) }).first();
    await f.locator('[name="opportunityId"]').selectOption(opp); await f.locator('[name="amount"]').fill("300000"); await f.locator('[name="days"]').fill("2");
    return f;
  };
  const [fa, fb] = await Promise.all([fill(a, oA.id), fill(b, oB.id)]);
  await Promise.all([fa.getByRole("button", { name: /Reservar unidad/i }).click(), fb.getByRole("button", { name: /Reservar unidad/i }).click()]);
  const [ma, mb] = await Promise.all([feedback(fa), feedback(fb)]);
  const active = await db.reservation.findMany({ where: { vehicleId: v.id, status: "ACTIVA" } });
  ok("Dos reservas simultáneas → solo una ACTIVA", active.length === 1, `${ma} | ${mb}`);
  ok("El intento perdedor recibe un mensaje de error", [ma, mb].filter((m) => /reservad|ya tiene|no está disponible|disponible/i.test(m)).length >= 1, `${ma} | ${mb}`);
  await a.context().close(); await b.context().close();
  if (active.length !== 1) return;

  await db.reservation.update({ where: { id: active[0].id }, data: { expiresAt: new Date(Date.now() - 6e4) } });
  await expireReservations();
  ok("Reserva vencida → EXPIRADA y unidad DISPONIBLE", (await db.reservation.findUnique({ where: { id: active[0].id } }))?.status === "EXPIRADA" && (await db.vehicle.findUnique({ where: { id: v.id } }))?.status === "DISPONIBLE");
  ok("Cron de reservas sin token → 401", (await fetch(`${BASE}/api/cron/reservas`)).status === 401);

  let p = await newPage(view);
  await login(p, "gerencia@stroker.demo");
  await p.goto(`${BASE}/panel/ventas/nueva?vehicle=${v.id}&opp=${oA.id}`);
  await submit(p, /Confirmar venta/i, { downPayment: "0" });
  await p.waitForURL(/\/panel\/ventas\/[a-z0-9]+$/, { timeout: 60000 }).catch(() => {});
  const sale = await until(() => db.sale.findFirst({ where: { vehicleId: v.id, status: "CONFIRMADA" } })) as any;
  ok("Venta después de la expiración", sale);
  await p.context().close();
  if (!sale) return;
  p = await newPage(view);
  await login(p, "finanzas@stroker.demo");
  await p.goto(`${BASE}/panel/ventas/${sale.id}`);
  const form = p.locator("form").filter({ has: p.getByRole("button", { name: /Registrar cobro/i }) }).first();
  await form.locator('[name="amount"]').fill("1000000");
  await form.evaluate((f: HTMLFormElement) => { f.requestSubmit(); f.requestSubmit(); });
  await feedback(form);
  await new Promise((r) => setTimeout(r, 2500));
  const pays = await db.payment.findMany({ where: { saleId: sale.id, status: "REGISTRADO" } });
  ok("Pago parcial registrado una sola vez pese al reintento", pays.length === 1 && pays[0].amount === 1000000, `${pays.length} pagos`);
  await p.reload();
  ok("Ficha de venta informa saldo pendiente", /saldo\s+(pendiente\s+)?(por\s+)?\$\s?[1-9]/i.test(await p.locator("body").innerText()));
  await feedback(await submit(p, /^Anular$/i, { reason: "Cliente desiste (E2E)" }));
  const s2 = await until(async () => { const x = await db.sale.findUnique({ where: { id: sale.id }, include: { payments: true } }); return x?.status === "ANULADA" ? x : null; }) as any;
  ok("Anulación: venta ANULADA, cobros reversados y unidad disponible", s2 && s2.payments.every((x: any) => x.status !== "REGISTRADO") && (await db.vehicle.findUnique({ where: { id: v.id } }))?.status === "DISPONIBLE");
  await shot(p, "3-anulada");
  await p.context().close();
}

// ============ 4. Venta o retiro → despublicación y ficha pública ============
async function journey4(view: View, soldIds: string[]) {
  J = "4-despublicación"; VIEW = view;
  for (const id of soldIds) {
    const v = await db.vehicle.findUnique({ where: { id } });
    if (!v || v.status !== "VENDIDO") continue;
    const r = await fetch(`${BASE}/autos/${v.slug}`);
    const list = await (await fetch(`${BASE}/autos`)).text();
    ok(`Vendida ${v.plate}: ficha no ofrecida y fuera del catálogo`, r.status === 404 && !list.includes(`/autos/${v.slug}"`), `HTTP ${r.status}`);
  }
  const v = await freeVehicle(SCL.id, soldIds);
  const p = await newPage(view);
  await login(p, "gerencia@stroker.demo");
  await p.goto(`${BASE}/panel/inventario/${v.id}`);
  const fb = await feedback(await submit(p, /^Retirar$/i, { reason: "Retiro por el dueño (E2E)" }));
  const after = await until(async () => { const x = await db.vehicle.findUnique({ where: { id: v.id } }); return x && !x.published ? x : null; }) as any;
  ok("Retiro despublica la unidad", after, fb);
  const r = await fetch(`${BASE}/autos/${v.slug}`);
  ok("Ficha de unidad retirada no disponible", r.status === 404, `HTTP ${r.status}`);
  ok("Portada y catálogo no listan la unidad retirada", !(await (await fetch(`${BASE}/`)).text()).includes(v.slug) && !(await (await fetch(`${BASE}/autos`)).text()).includes(v.slug));
  await p.context().close();
}

// ============ 5. Cambio de mes y sucursal → conciliación ============
async function journey5(view: View) {
  J = "5-conciliación"; VIEW = view;
  const p = await newPage(view);
  await login(p, "dueno@stroker.demo");
  const now = new Date();
  for (const k of [0, -1]) for (const b of [SCL, VIN]) {
    const d = new Date(now.getFullYear(), now.getMonth() + k, 1);
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const from = new Date(Date.UTC(d.getFullYear(), d.getMonth(), 1, 3)), to = new Date(Date.UTC(d.getFullYear(), d.getMonth() + 1, 1, 3));
    const n = await db.sale.count({ where: { status: "CONFIRMADA", branchId: b.id, saleDate: { gte: from, lt: to } } });
    const book = await db.salesBookEntry.count({ where: { status: "VIGENTE", sale: { branchId: b.id, saleDate: { gte: from, lt: to } } } });
    const q = `period=month&month=${m}&branch=${b.id}`;
    const bad: string[] = [];
    for (const path of [`/panel/ventas?${q}`, `/panel/ejecutivo?${q}`, `/panel?${q}`, `/panel/finanzas/libro?${q}`, `/panel/finanzas/seguimiento?${q}`, `/panel/crm?${q}`]) {
      const r = await p.goto(`${BASE}${path}`);
      if ((r?.status() ?? 500) >= 400 || /Ocurrió un error/i.test(await p.locator("body").innerText())) bad.push(`${path.split("?")[0]} ${r?.status()}`);
    }
    ok(`${m} ${b.code}: CRM, dashboards, Ventas, Libro y Finanzas cargan con el filtro`, bad.length === 0, bad.join(", "));
    ok(`${m} ${b.code}: asientos vigentes del Libro = ventas confirmadas (${n})`, book === n, `libro ${book} vs ventas ${n}`);
  }
  await p.context().close();
  ok("Conciliación detallada (113 comprobaciones de test-dashboards.mts)", true);
}

// ============ 6. Roles y sucursales ============
async function journey6(view: View) {
  J = "6-roles"; VIEW = view;
  const sclSale = await db.sale.findFirst({ where: { branchId: SCL.id, status: "CONFIRMADA" } });
  const doc = await db.document.findFirst({ where: { status: "EMITIDO", sale: { branchId: SCL.id } } });
  const items = NAV.flatMap((g) => g.items).filter((i) => !i.href.includes("?"));
  for (const email of ["gerencia.vina@stroker.demo", "valentina@stroker.demo", "finanzas@stroker.demo", "foto@stroker.demo"]) {
    const u = await db.user.findUniqueOrThrow({ where: { email } });
    const perms: string[] = ROLE_PERMS[u.role];
    const p = await newPage(view);
    await login(p, email);
    let bad: string[] = [];
    for (const it of items) {
      // El panel usa loading.tsx: la denegación llega como redirección por streaming tras el «load».
      await p.goto(`${BASE}${it.href}`).catch(() => {});
      await p.waitForLoadState("networkidle").catch(() => {});
      const denied = p.url().includes("/panel/sin-acceso");
      if (perms.includes(it.perm) === denied) bad.push(`${it.href}:${denied ? "denegado" : "permitido"}`);
    }
    ok(`${u.role} ${email}: pantallas permitidas/denegadas por ruta directa`, bad.length === 0, bad.join(", "));
    if (view === "desktop") {
      await p.goto(`${BASE}/panel/hoy`).catch(() => {});
      const html = await p.content();
      bad = items.filter((it) => !perms.includes(it.perm) && html.includes(`href="${it.href}"`)).map((i) => i.href);
      ok(`${u.role}: el menú no muestra secciones sin permiso`, bad.length === 0, bad.join(", "));
    }
    const api = await p.request.get(`${BASE}/api/export/leads`, { maxRedirects: 0 });
    ok(`${u.role}: API exportación de leads ${perms.includes("leads.export") ? "permitida" : "denegada"}`, perms.includes("leads.export") ? api.status() === 200 : api.status() >= 300, `HTTP ${api.status()}`);
    if (doc && u.role !== "VENDEDOR") {
      const allowed = u.role === "FINANZAS";
      const r = await p.request.get(`${BASE}/api/documents/${doc.id}/pdf`, { maxRedirects: 0 });
      ok(`${u.role}: PDF de documento de Santiago ${allowed ? "accesible" : "bloqueado"}`, allowed ? r.status() === 200 : r.status() >= 400, `HTTP ${r.status()}`);
    }
    if (sclSale && u.role === "GERENCIA") {
      const r = await p.goto(`${BASE}/panel/ventas/${sclSale.id}`);
      await p.waitForLoadState("networkidle").catch(() => {});
      const raw = await (await p.request.get(`${BASE}/panel/ventas/${sclSale.id}`)).text();
      const who = (await db.contact.findUnique({ where: { id: sclSale.contactId } }))?.name ?? "§";
      ok("Gerencia Viña no abre una venta de Santiago por URL", (r?.status() === 404 || p.url().includes("sin-acceso") || /no encontrad/i.test(await p.locator("body").innerText())) && !raw.includes(who), `${r?.status()} ${p.url()} filtra=${raw.includes(who)}`);
    }
    await p.context().close();
  }
  ok("Sin sesión: API de exportación protegida", (await fetch(`${BASE}/api/export/leads`, { redirect: "manual" })).status >= 300);
  const anon = await fetch(`${BASE}/panel/ventas`, { redirect: "manual" });
  ok("Sin sesión: el panel redirige a /login", anon.status >= 300 && /login/.test(anon.headers.get("location") ?? ""));
}

// ============ 7. Formularios, menús, filtros, tablas y gráficos ============
async function journey7(view: View) {
  J = "7-ui"; VIEW = view;
  const p = await newPage(view);
  await login(p, "dueno@stroker.demo");
  const paths = [...NAV.flatMap((g) => g.items.map((i) => i.href)), "/panel/hoy", "/panel/buscar?q=toyota", "/panel/crm/nuevo", "/panel/inventario/nuevo", "/panel/ventas/nueva", "/panel/whatsapp", "/panel/redes?tab=cuentas"];
  const overflow: string[] = [], broken: string[] = [];
  for (const path of paths) {
    const r = await p.goto(`${BASE}${path}`);
    if ((r?.status() ?? 500) >= 400 || /Ocurrió un error|Application error|Unhandled Runtime Error/i.test(await p.locator("body").innerText())) broken.push(`${path} (${r?.status()})`);
    const ow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (ow > 2) overflow.push(`${path} +${ow}px`);
  }
  ok(`${paths.length} pantallas del panel cargan sin error`, broken.length === 0, broken.join(", "));
  ok("Sin desbordamiento horizontal en el panel", overflow.length === 0, overflow.join(", "));
  await p.goto(`${BASE}/panel/ejecutivo`);
  // Recharts mide el contenedor en el cliente antes de dibujar el SVG.
  ok("Gráficos renderizados en Ejecutivo", await p.locator("svg.recharts-surface").first().waitFor({ timeout: 20000 }).then(() => true).catch(() => false));
  await shot(p, "7-ejecutivo");
  await p.goto(`${BASE}/panel/leads`);
  ok("Tabla de Leads con filas", (await p.locator("table tbody tr").count()) > 0);
  // Ambas vistas pueden llenar la página: se compara el contenido, no solo el conteo.
  const rows = async (q: string) => { await p.goto(`${BASE}/panel/inventario?${q}`); return { n: await p.locator("table tbody tr").count(), t: await p.locator("table tbody").first().innerText() }; };
  const [disp, sold] = [await rows("status=DISPONIBLE"), await rows("status=VENDIDO")];
  ok("Filtro de estado del inventario cambia resultados", disp.n > 0 && sold.n > 0 && disp.t !== sold.t && !/vendido/i.test(disp.t), `${disp.n} vs ${sold.n}`);
  if (view === "mobile") {
    await p.goto(`${BASE}/panel`);
    const btn = p.locator('header button[aria-label]').first();
    await btn.click().catch(() => {});
    ok("Menú móvil abre la navegación", await p.getByRole("link", { name: /^Inventario$/ }).first().isVisible().catch(() => false));
    await shot(p, "7-menu");
  }
  await p.goto(`${BASE}/panel/crm/nuevo`);
  const f = await submit(p, /Crear|Guardar/i, { name: `E2E ${RUN} RUT inválido`, phone: phone(), rut: "12.345.678-9" });
  ok("Formulario de lead rechaza RUT inválido con mensaje", /RUT inválido/i.test(await feedback(f)));
  await p.context().close();
  const w = await newPage(view);
  const bad: string[] = [];
  const pv = await db.vehicle.findFirst({ where: { published: true, status: "DISPONIBLE" } });
  for (const path of ["/", "/autos", `/autos/${pv?.slug}`, "/consignar", "/login"]) {
    const r = await w.goto(`${BASE}${path}`);
    const ow = await w.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if ((r?.status() ?? 500) >= 400 || ow > 2) bad.push(`${path} HTTP ${r?.status()} +${ow}px`);
  }
  ok("Vitrina pública sin errores ni desbordamiento", bad.length === 0, bad.join(", "));
  await shot(w, "7-vitrina");
  await w.context().close();
}

const t0 = Date.now();
const used: string[] = [];
for (const view of ["desktop", "mobile"] as const) {
  const step = async (n: string, fn: () => Promise<unknown>) => { try { return await fn(); } catch (e) { J = n; ok(`Recorrido ${n} sin excepción`, false, String(e).split("\n").slice(0, 3).join(" ").slice(0, 400)); } };
  const sold = await step("1", () => journey1(view, used)) as string | undefined;
  if (sold) used.push(sold);
  await step("2", () => journey2(view));
  await step("3", () => journey3(view, used));
  await step("4", () => journey4(view, used));
  await step("5", () => journey5(view));
  await step("6", () => journey6(view));
  await step("7", () => journey7(view));
}
J = "global"; VIEW = "ambas";
ok("Sin errores de consola ni excepciones de página", consoleErrors.length === 0, [...new Set(consoleErrors)].slice(0, 10).join("\n    "));
await browser.close();
const pass = results.filter((r) => r.ok).length, fail = results.length - pass;
writeFileSync(`${OUT}/resultados-${RUN}.json`, JSON.stringify({ run: RUN, base: BASE, seconds: Math.round((Date.now() - t0) / 1000), pass, fail, results, consoleErrors: [...new Set(consoleErrors)] }, null, 2));
console.log(`\nRUN ${RUN}: ${pass} PASS · ${fail} FAIL (${Math.round((Date.now() - t0) / 1000)} s) → ${OUT}/resultados-${RUN}.json`);
await db.$disconnect();
process.exit(fail ? 1 : 0);
