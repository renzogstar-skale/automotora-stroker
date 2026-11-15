// Seguimiento Financiero y Calculadora: conciliación del reporte con los registros, gráficos que cambian con cada filtro
// y casos de la calculadora (ejemplo, tasa cero, pie inválido). Contra la BD de desarrollo y el servidor en APP_URL.
// Uso: APP_URL=http://localhost:3000 npx tsx --conditions=react-server scripts/test-tracking.mts
import { db } from "../src/lib/db";
import { randomToken, sha256 } from "../src/lib/crypto";
import { parsePeriod } from "../src/lib/period";
import { computeLoan, validateLoan } from "../src/lib/loan";
import { financeReport } from "../src/server/finance";
import { signed } from "../src/server/categories";

const BASE = process.env.APP_URL ?? "http://localhost:3000";
let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, info = "") => { if (cond) pass++; else fail++; console.log(`${cond ? "PASS" : "FAIL"}  ${name}${info ? ` — ${info}` : ""}`); };
const eq = (name: string, got: unknown, want: unknown) => ok(name, got === want, `obtenido ${got}, esperado ${want}`);
const sum = <T,>(a: T[], f: (x: T) => number) => a.reduce((s, x) => s + f(x), 0);
type Rep = Awaited<ReturnType<typeof financeReport>>;

const owner = await db.user.findUniqueOrThrow({ where: { email: "dueno@stroker.demo" } });
const token = randomToken();
await db.session.create({ data: { userId: owner.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 3600e3) } });
/** HTML + carga RSC sin escapes: los datos de los gráficos quedan como "clave":valor. */
const page = async (path: string) => {
  const r = await fetch(BASE + path, { headers: { cookie: `stk_session=${token}` }, redirect: "manual" });
  return { status: r.status, body: (await r.text()).replace(/<!-- -->/g, "").replace(/\\/g, "") };
};

// ───────── 1. Calculadora ─────────
const ex = { price: 15_990_000, down: 3_000_000, tradeIn: 0, months: 36, annualRate: 8.5 };
eq("Ejemplo válido", validateLoan(ex).length, 0);
const r = computeLoan(ex), m = 0.085 / 12;
eq("Monto a financiar", r.principal, 12_990_000);
eq("Convención: tasa mensual = anual ÷ 12", r.monthlyRate, m);
eq("Cuota (francés)", r.cuota, Math.round((12_990_000 * m) / (1 - (1 + m) ** -36)));
eq("Total crédito = cuota × plazo", r.totalCredit, r.cuota * 36);
eq("Intereses = total − financiado", r.interest, r.totalCredit - 12_990_000);
eq("Desembolso comprador = pie + parte de pago + cuotas", r.buyerTotal, r.totalCredit + 3_000_000);
const z = computeLoan({ ...ex, annualRate: 0 });
ok("Tasa cero: válida, sin intereses, cuota = monto ÷ plazo", validateLoan({ ...ex, annualRate: 0 }).length === 0 && z.interest === 0 && z.cuota === Math.round(12_990_000 / 36) && z.totalCredit === 12_990_000, `cuota ${z.cuota}, intereses ${z.interest}`);
ok("Pie negativo rechazado", validateLoan({ ...ex, down: -1 }).length > 0);
ok("Pie igual al precio rechazado", validateLoan({ ...ex, down: 15_990_000 }).length > 0);
ok("Pie + parte de pago sobre el precio rechazado", validateLoan({ ...ex, down: 10_000_000, tradeIn: 6_000_000 }).length > 0);
ok("Plazo y tasa fuera de rango rechazados", validateLoan({ ...ex, months: 0 }).length > 0 && validateLoan({ ...ex, annualRate: -1 }).length > 0);
const calc = await page("/panel/finanzas/calculadora");
ok("Página: simulación referencial, convención y ejemplo", calc.status === 200 && calc.body.includes("Simulación referencial") && calc.body.includes("anual ÷ 12") && calc.body.includes("15990000"));

// ───────── 2. Conciliación del reporte con los registros (últimos 6 meses, todas las sucursales) ─────────
const p = parsePeriod({}, "6m");
const rep = await financeReport(p, null);
const sales = await db.sale.findMany({ where: { status: "CONFIRMADA", saleDate: { gte: p.from, lt: p.to } } });
const moves = await db.movement.findMany({ where: { date: { gte: p.from, lt: p.to }, isPending: false, scope: "EMPRESA" }, include: { category: true } });
eq("Unidades = ventas confirmadas", rep.sold.units, sales.length);
eq("Monto vendido = Σ precio final", rep.sold.amount, sum(sales, (s) => s.finalPrice));
eq("Entradas de caja = Σ ingresos empresa", rep.cash.in, sum(moves.filter((x) => x.type === "INGRESO"), (x) => x.amount));
eq("Salidas de caja = Σ egresos empresa", rep.cash.out, sum(moves.filter((x) => x.type === "EGRESO"), (x) => x.amount));
eq("Otros ingresos = categorías de resultado", rep.kpi.otherIncome, sum(moves.filter((x) => x.category.pnl && x.category.type === "INGRESO"), signed));
eq("Costo propio = Σ costo de propias vendidas", rep.kpi.cogs, sum(sales.filter((s) => s.ownership === "PROPIO"), (s) => s.costBasis));
eq("Utilidad neta = ingresos − costo − gastos", rep.kpi.net, rep.kpi.income - rep.kpi.cogs - rep.kpi.expenses);
eq("Margen = utilidad ÷ ingresos", rep.kpi.margin, rep.kpi.income ? rep.kpi.net / rep.kpi.income : null);
eq("Σ meses (ingresos) = ingresos", sum(rep.monthly, (x) => x.ingresos), rep.kpi.income);
eq("Σ meses (costos y gastos) = costo + gastos", sum(rep.monthly, (x) => x.gastos), rep.kpi.cogs + rep.kpi.expenses);
eq("Σ meses (vendido) = monto vendido", sum(rep.monthly, (x) => x.vendido), rep.sold.amount);
eq("Σ meses (entradas − salidas) = flujo", sum(rep.monthly, (x) => x.entradas - x.salidas), rep.cash.in - rep.cash.out);
eq("Balance acumulado final = inicial + flujo", rep.cumulative.at(-1)?.saldo, (rep.opening ?? 0) + rep.cash.in - rep.cash.out);
eq("Σ gastos por categoría = salidas netas de egresos", sum(rep.byCategory, (c) => c.amount), -sum(moves.filter((x) => x.category.type === "EGRESO"), signed));
eq("Desglose de ingresos = ingresos", sum(rep.incomeBreakdown, (x) => x.value), rep.kpi.income);
ok("Últimos 8 gastos/ingresos ordenados por fecha", rep.lastExpenses.length <= 8 && rep.lastIncomes.length <= 8 && rep.lastExpenses.every((x, i, a) => !i || a[i - 1].date >= x.date) && rep.lastExpenses.every((x) => x.type === "EGRESO") && rep.lastIncomes.every((x) => x.type === "INGRESO"));
const socio = await db.movement.findMany({ where: { date: { gte: p.from, lt: p.to }, isPending: false, scope: "SOCIO" } });
eq("Gastos de alcance «Socio» = columna «fuera del balance»", sum(rep.byPartner, (x) => x.outside), sum(socio.filter((x) => x.type === "EGRESO" && x.partnerId), (x) => x.amount));

// ───────── 3. Página y cambio de filtros: cada gráfico usa los datos del filtro activo ─────────
const branches = await db.branch.findMany({ orderBy: { code: "asc" } });
const chartValues = (x: Rep) => [
  ...x.monthly.flatMap((mo) => [`"ingresos":${mo.ingresos}`, `"gastos":${mo.gastos}`, `"entradas":${mo.entradas}`, `"salidas":${mo.salidas}`, `"vendido":${mo.vendido}`, `"unidades":${mo.unidades}`]),
  ...x.cumulative.map((c) => `"saldo":${c.saldo}`),
  ...x.byCategory.map((c) => `"value":${c.amount}`),
  ...x.incomeBreakdown.map((c) => `"value":${c.value}`),
];
const variants: { name: string; q: string; rep: Rep }[] = [
  { name: "6 meses (inicial)", q: "", rep },
  ...(await Promise.all(branches.map(async (b) => ({ name: `sucursal ${b.code}`, q: `?branch=${b.id}`, rep: await financeReport(p, [b.id]) })))),
  { name: "año", q: "?period=year", rep: await financeReport(parsePeriod({ period: "year" }), null) },
];
for (const v of variants) {
  const html = await page(`/panel/finanzas/seguimiento${v.q}`);
  const missing = chartValues(v.rep).filter((k) => !html.body.includes(k));
  ok(`Filtro ${v.name}: todos los gráficos con sus datos`, html.status === 200 && missing.length === 0, missing.slice(0, 3).join(" "));
}
const fingerprints = variants.map((v) => JSON.stringify(chartValues(v.rep)));
ok("Los filtros producen datos de gráfico distintos", new Set(fingerprints).size === fingerprints.length);
const def = await page("/panel/finanzas/seguimiento");
ok("Vista inicial: últimos 6 meses", def.body.includes("Últimos 6 meses"));
ok("KPIs, alcance y gastos de socios explicados", ["Ingresos del período", "Gastos de empresa", "Utilidad neta", "Margen neto", "Cómo se calcula", "Gastos de socios"].every((k) => def.body.includes(k)));
ok("Resumen de ventas", ["Unidades vendidas", "Monto vendido", "Ganancia por ventas", "Otros ingresos"].every((k) => def.body.includes(k)));
ok("Últimos 8 con acceso al origen", def.body.includes("Últimos 8 gastos") && def.body.includes("Últimos 8 ingresos") && (def.body.match(/title="Ver origen"/g)?.length ?? 0) === rep.lastExpenses.length + rep.lastIncomes.length);
const own = rep.moves.find((x) => !x.saleId && !x.vehicleId);
if (own) { const one = await page(`/panel/finanzas/movimientos?id=${own.id}`); ok("Movimiento de origen accesible por id", one.status === 200 && one.body.includes(own.description.slice(0, 20))); }
const empty = await page("/panel/finanzas/seguimiento?period=custom&from=2001-01-01&to=2001-01-31");
ok("Sin denominador → «Sin datos»", empty.body.includes("Sin datos") && empty.body.includes("Sin ingresos en el período"));

console.log(`\n${pass} PASS · ${fail} FAIL`);
await db.$disconnect();
process.exit(fail ? 1 : 0);
