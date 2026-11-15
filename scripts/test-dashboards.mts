// Compara los indicadores de los dashboards con sus pantallas de origen (mes con actividad y mes vacío, por sucursal y rol).
// Requiere `npm run dev`. Uso: npx tsx scripts/test-dashboards.mts
import { db } from "../src/lib/db";
import { randomToken, sha256 } from "../src/lib/crypto";
import { ymd } from "../src/lib/format";

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
const cache = new Map<string, string>();
async function page(path: string, token: string) {
  const k = token + path;
  if (!cache.has(k)) {
    const r = await fetch(BASE + path, { headers: { cookie: `stk_session=${token}` }, redirect: "manual" });
    if (r.status !== 200) throw new Error(`${path} → ${r.status}`);
    cache.set(k, await r.text());
  }
  return cache.get(k)!;
}
const clean = (h: string) => h.replace(/<!--.*?-->/g, "").replace(/<[^>]+>/g, "").replace(/&nbsp;| /g, " ").trim();
const digits = (t: string) => { const n = t.replace(/[^\d-]/g, ""); return n === "" || n === "-" ? NaN : +n; };
/** Valor de una tarjeta Kpi por su etiqueta: el exacto (title) si existe, si no el texto. */
async function kpi(path: string, token: string, label: string, raw = false) {
  const h = await page(path, token);
  const i = h.indexOf(`>${label}<`);
  if (i < 0) return raw ? null : NaN;
  const m = h.slice(i).match(/<p class="mt-1 truncate[^"]*"(?: title="([^"]*)")?>([\s\S]*?)<\/p>/);
  if (!m) return raw ? null : NaN;
  const inner = m[2].match(/title="([^"]*)"/)?.[1];
  const text = m[1] ?? inner ?? clean(m[2]);
  return raw ? clean(m[2]) : digits(text);
}
async function sub(path: string, token: string, label: string) {
  const h = await page(path, token);
  const i = h.indexOf(`>${label}<`);
  const m = h.slice(i).match(/<p class="mt-1 text-xs text-muted[^"]*">([\s\S]*?)<\/p>/);
  return m ? clean(m[1]) : "";
}
async function headerCount(path: string, token: string) {
  const m = (await page(path, token)).match(/>(\d+)(?:<!-- -->)? (?:registros|unidades) con los filtros actuales/);
  return m ? +m[1] : NaN;
}

// Mes con más ventas confirmadas y un mes sin actividad.
const sales = await db.sale.findMany({ where: { status: "CONFIRMADA" }, select: { saleDate: true } });
const byMonth = new Map<string, number>();
for (const s of sales) { const k = ymd(s.saleDate).slice(0, 7); byMonth.set(k, (byMonth.get(k) ?? 0) + 1); }
const busy = [...byMonth.entries()].sort((a, b) => b[1] - a[1])[0][0];
const empty = "2019-01";
const branches = await db.branch.findMany({ select: { id: true, name: true } });
console.log(`Mes con actividad: ${busy} (${byMonth.get(busy)} ventas) · mes vacío: ${empty} · sucursales: ${branches.map((b) => b.name).join(", ")}`);

const admin = await session("dueno@stroker.demo");
const finance = await session("finanzas@stroker.demo");
const seller = await session("valentina@stroker.demo");

try {
  for (const ref of [busy, empty]) {
    for (const b of [undefined, ...branches.map((x) => x.id)]) {
      const tag = `${ref}${b ? ` · ${branches.find((x) => x.id === b)!.name}` : " · todas"}`;
      const f = `period=month&ref=${ref}${b ? `&branch=${b}` : ""}`;
      const br = b ? `branch=${b}` : "";
      const d = `/panel?${f}`, ex = `/panel/ejecutivo?${f}`, ven = `/panel/ventas?${f}`;

      // Dashboard principal ↔ Ventas, Inventario, CRM, Citas
      const dUnits = await kpi(d, admin, "Unidades vendidas"), vUnits = await kpi(ven, admin, "Unidades");
      ok(`[${tag}] Principal unidades = Ventas`, dUnits === vUnits, `${dUnits} vs ${vUnits}`);
      const dSold = await kpi(d, admin, "Vendido"), vSold = await kpi(ven, admin, "Monto vendido");
      ok(`[${tag}] Principal vendido = Ventas`, dSold === vSold, `${dSold} vs ${vSold}`);
      const inv = await headerCount(`/panel/inventario${br ? `?${br}` : ""}`, admin);
      ok(`[${tag}] Principal stock = Inventario`, (await kpi(d, admin, "Inventario en stock")) === inv, `${await kpi(d, admin, "Inventario en stock")} vs ${inv}`);
      const avail = await headerCount(`/panel/inventario?${[br, "status=DISPONIBLE"].filter(Boolean).join("&")}`, admin);
      ok(`[${tag}] Principal disponibles = Inventario`, (await kpi(d, admin, "Unidades disponibles")) === avail, `${await kpi(d, admin, "Unidades disponibles")} vs ${avail}`);
      const crmActive = await kpi(`/panel/crm${br ? `?${br}` : ""}`, admin, "Activos");
      ok(`[${tag}] Principal leads activos = CRM`, (await kpi(d, admin, "Leads activos")) === crmActive, `${await kpi(d, admin, "Leads activos")} vs ${crmActive}`);
      const citas = await kpi(`/panel/citas?view=agenda${br ? `&${br}` : ""}`, admin, "Pendientes (programadas o confirmadas)");
      ok(`[${tag}] Principal citas = Citas`, (await kpi(d, admin, "Citas pendientes")) === citas, `${await kpi(d, admin, "Citas pendientes")} vs ${citas}`);

      // Dashboard ejecutivo ↔ Ventas, Leads, CRM, Inventario, Seguimiento, Principal
      ok(`[${tag}] Ejecutivo unidades = Ventas`, (await kpi(ex, admin, "Unidades vendidas")) === vUnits);
      const margin = await kpi(ven, admin, "Margen antes de gastos directos");
      ok(`[${tag}] Ejecutivo margen = Ventas/Libro`, (await kpi(ex, admin, "Margen bruto")) === margin, `${await kpi(ex, admin, "Margen bruto")} vs ${margin}`);
      const tk = await kpi(ex, admin, "Ticket promedio", true);
      ok(`[${tag}] Ejecutivo ticket coherente`, vUnits ? digits(String(tk)) > 0 : tk === "Sin datos", String(tk));
      const inc = await kpi(ex, admin, "Ingresos"), segInc = await kpi(`/panel/finanzas/seguimiento?${f}`, admin, "Ingresos del período");
      ok(`[${tag}] Ejecutivo ingresos = Seguimiento`, inc === segInc, `${inc} vs ${segInc}`);
      ok(`[${tag}] Ejecutivo balance = Principal`, (await kpi(ex, admin, "Balance de caja")) === (await kpi(d, admin, "Balance de caja")));
      ok(`[${tag}] Ejecutivo oportunidades = CRM`, (await kpi(ex, admin, "Oportunidades activas")) === crmActive);
      ok(`[${tag}] Ejecutivo stock disponible = Inventario`, (await kpi(ex, admin, "Stock disponible")) === avail);
      // Conversión: numerador y denominador contra Leads (misma cohorte)
      const cs = await sub(ex, admin, "Conversión de leads");
      const [cn, cd] = (cs.match(/(\d+) concretados de (\d+)/) ?? []).slice(1).map(Number);
      const last = new Date(Date.UTC(+ref.slice(0, 4), +ref.slice(5, 7), 0)).getUTCDate();
      const coh = `/panel/leads?${[br, `type=VENTA&from=${ref}-01&to=${ref}-${last}`].filter(Boolean).join("&")}`;
      const lDen = await headerCount(coh, admin), lNum = await headerCount(`${coh}&stage=CONCRETADO`, admin);
      ok(`[${tag}] Conversión denominador = Leads`, cd === lDen, `${cd} vs ${lDen}`);
      ok(`[${tag}] Conversión numerador = Leads concretados`, cn === lNum, `${cn} vs ${lNum}`);

      // Informe CEO ↔ Ejecutivo
      ok(`[${tag}] CEO margen = Ejecutivo`, (await kpi(`/panel/informe-ceo?${f}`, admin, "Margen bruto")) === (await kpi(ex, admin, "Margen bruto")));
      ok(`[${tag}] CEO monto = Ventas`, (await kpi(`/panel/informe-ceo?${f}`, admin, "Monto vendido")) === vSold);
    }
  }

  // Cobros: pagos registrados vs movimientos de cobro (lo que abre el enlace), mes con actividad.
  const from = new Date(`${busy}-01T03:00:00Z`), to = new Date(from); to.setUTCMonth(to.getUTCMonth() + 1);
  const d = `/panel?period=month&ref=${busy}`;
  const cobros = await kpi(d, admin, "Cobros realizados");
  // Movimientos lista los reversados marcados; el KPI es neto de reversos, así que se excluyen originales reversados y sus reversos.
  const moves = await db.movement.findMany({ where: { isPending: false, date: { gte: from, lt: to }, category: { name: { in: ["Cobro de venta", "Cobro de reserva"] } }, reversedBy: { is: null }, reversalOfId: null }, select: { type: true, amount: true } });
  const net = moves.reduce((t, m) => t + (m.type === "INGRESO" ? m.amount : -m.amount), 0);
  ok(`[${busy}] Cobros = movimientos de cobro (neto)`, Math.abs(Number(cobros) - net) <= 1, `${cobros} vs ${net}`);

  // Detalle conserva filtros: el enlace de una venta lleva back y el detalle lo usa.
  const ex = `/panel/ejecutivo?period=month&ref=${busy}`;
  const link = (await page(ex, admin)).match(/href="(\/panel\/ventas\/[^"?]+\?back=[^"]+)"/)?.[1].replace(/&amp;/g, "&");
  ok("Ejecutivo → detalle de venta lleva filtros", !!link && decodeURIComponent(link).includes(`ref=${busy}`), link ?? "");
  if (link) ok("Detalle muestra «Volver» a la vista filtrada", (await page(link, admin)).includes(`href="/panel/ejecutivo?period=month&amp;ref=${busy}"`));

  // Mes vacío: estados vacíos visibles.
  const exEmpty = await page(`/panel/ejecutivo?period=month&ref=${empty}`, admin);
  ok("Ejecutivo vacío muestra «Sin actividad en el período»", exEmpty.includes("Sin actividad en el período"));
  ok("Principal vacío muestra «Sin ventas en el período»", (await page(`/panel?period=month&ref=${empty}`, admin)).includes("Sin ventas en el período"));
  ok("Tarjetas identificadas (Hoy / Período)", exEmpty.includes(">Hoy<") && exEmpty.includes(">Período<"));

  // Permisos
  const fe = await page(`/panel/ejecutivo?period=month&ref=${busy}`, finance);
  ok("Finanzas ve Ejecutivo con balance y gastos", fe.includes("Distribución de gastos") && fe.includes(">Balance de caja<"));
  const r = await fetch(`${BASE}/panel/ejecutivo`, { headers: { cookie: `stk_session=${seller}` }, redirect: "manual" });
  ok("Vendedor no accede a Ejecutivo", r.status !== 200 || (await r.text()).includes("/panel/sin-acceso"), String(r.status));
  const sd = await page(`/panel?period=month&ref=${busy}`, seller);
  const sv = await kpi(`/panel/ventas?period=month&ref=${busy}`, seller, "Unidades");
  ok("Vendedor: unidades del principal = sus Ventas", (await kpi(`/panel?period=month&ref=${busy}`, seller, "Unidades vendidas")) === sv);
  ok("Vendedor: sin cobros ni balance", !sd.includes(">Cobros realizados<") && !sd.includes(">Balance de caja<"));
  const quick = await page("/panel", seller);
  ok("Acción rápida del vendedor sin «Nuevo vehículo» ni «Nueva consignación»", !quick.includes("Nuevo vehículo") && !quick.includes("Nueva consignación"));
} finally {
  await db.session.deleteMany({ where: { tokenHash: { in: tokens.map(sha256) } } });
  await db.$disconnect();
}
console.log(`\n${pass} PASS · ${fail} FAIL`);
process.exit(fail ? 1 : 0);
