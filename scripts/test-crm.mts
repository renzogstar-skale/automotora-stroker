// Flujo CRM de punta a punta enviando los formularios renderizados (como un navegador). Requiere `npm run dev`.
// Uso: npx tsx scripts/test-crm.mts
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
const page = async (path: string, token: string) => (await fetch(BASE + path, { headers: { cookie: `stk_session=${token}` } })).text();
async function forms(path: string, token: string) {
  const html = await page(path, token);
  return [...html.matchAll(/<form[^>]*method="POST"[^>]*>([\s\S]*?)<\/form>/g)].map((m) => ({
    html: m[1],
    hidden: [...m[1].matchAll(/<input type="hidden" name="([^"]+)"(?: value="([^"]*)")?\/>/g)].map((h) => [h[1], unesc(h[2] ?? "")] as [string, string]),
  }));
}
async function submit(path: string, token: string, f: { hidden: [string, string][] }, fields: [string, string][]) {
  const fd = new FormData();
  for (const [k, v] of [...f.hidden, ...fields]) fd.set(k, v);
  const r = await fetch(BASE + path, { method: "POST", body: fd, headers: { cookie: `stk_session=${token}` }, redirect: "manual" });
  return { status: r.status, loc: r.headers.get("location") ?? "", html: await r.text() };
}
const msg = (h: string) => h.match(/role="(?:alert|status)"[^>]*>(?:<svg[\s\S]*?<\/svg>)?([^<]+)/)?.[1] ?? "";
const find = (fs: Awaited<ReturnType<typeof forms>>, needle: string) => { const f = fs.find((x) => x.html.includes(needle)); if (!f) throw new Error(`Formulario no encontrado: ${needle}`); return f; };
const total = (html: string) => +(html.match(/(\d+)(?:<!-- -->)? registros con los filtros/)?.[1] ?? -1);

/** Conteos visibles: columnas del Kanban y total de la tabla Leads con el mismo filtro de tipo. */
async function counts(token: string) {
  const board = await page("/panel/crm?type=VENTA", token);
  const cols = Object.fromEntries([...board.matchAll(/font-semibold"><span>([^<]+)<\/span><span[^>]*>(\d+)<\/span>/g)].map((m) => [m[1], +m[2]]));
  const table = total(await page("/panel/leads?type=VENTA", token));
  const tableCancel = total(await page("/panel/leads?type=VENTA&stage=CANCELADO", token));
  return { cols, kanban: Object.values(cols).reduce((a, b) => a + b, 0), table, cancelBoard: cols["Cancelado"], tableCancel };
}

const gs = await db.user.findUniqueOrThrow({ where: { email: "gerencia@stroker.demo" }, include: { branches: true } });
const scl = gs.branches[0].branchId;
const sellerA = await db.seller.findFirstOrThrow({ where: { branchId: scl, active: true, user: { email: "valentina@stroker.demo" } } });
const sellerB = await db.seller.findFirstOrThrow({ where: { branchId: scl, active: true, id: { not: sellerA.id } } });
const vinSeller = await db.seller.findFirstOrThrow({ where: { branch: { code: "VIN" }, active: true } });
const tG = await session("gerencia@stroker.demo"), tV = await session("valentina@stroker.demo"), tGV = await session("gerencia.vina@stroker.demo");
const PHONE = "+56987650001";
await db.opportunity.deleteMany({ where: { contact: { phone: PHONE } } });
await db.contact.deleteMany({ where: { phone: PHONE } });

const c0 = await counts(tG);
ok("Conteos iniciales: Kanban = tabla Leads", c0.kanban === c0.table && c0.table > 0, `kanban ${c0.kanban} · tabla ${c0.table}`);

console.log("\n== Crear lead ==");
const fNew = find(await forms("/panel/crm/nuevo?type=VENTA", tG), 'name="source"');
const lead: [string, string][] = [["name", "Prueba Flujo CRM"], ["phone", "+56 9 8765 0001"], ["type", "VENTA"], ["source", "WEB"], ["branchId", scl], ["sellerId", sellerA.id], ["budget", "15000000"], ["comuna", "Ñuñoa"], ["region", "Metropolitana"], ["payMethod", "FINANCIAMIENTO"], ["interest", "SUV automático"], ["nextFollowUpAt", "2026-12-01T10:00"]];
let r = await submit("/panel/crm/nuevo", tG, fNew, [...lead, ["rut", "12.345.678-0"]]);
ok("RUT inválido rechazado", msg(r.html).includes("RUT inválido"), msg(r.html));
r = await submit("/panel/crm/nuevo", tG, fNew, [...lead, ["rut", "11.111.111-1"]]);
const id = r.loc.match(/\/panel\/crm\/(\w+)/)?.[1] ?? "";
const o1 = await db.opportunity.findUnique({ where: { id }, include: { contact: true } });
ok("Lead creado con origen, vendedor, sucursal, presupuesto, comuna, RUT y forma de compra",
  !!o1 && o1.source === "WEB" && o1.sellerId === sellerA.id && o1.branchId === scl && o1.budget === 15000000 && o1.contact.comuna === "Ñuñoa" && o1.contact.rut === "11.111.111-1" && o1.payMethod === "FINANCIAMIENTO", `${r.status} ${r.loc}`);
const c1 = await counts(tG);
ok("Tras crear: Kanban y tabla suben en 1 y coinciden", c1.kanban === c0.kanban + 1 && c1.table === c0.table + 1 && c1.cols["Nuevo"] === c0.cols["Nuevo"] + 1, `kanban ${c1.kanban} · tabla ${c1.table}`);

console.log("\n== Asignar ==");
const D = `/panel/crm/${id}`;
const fEdit = find(await forms(D, tG), 'name="interest"');
const base: [string, string][] = [["name", "Prueba Flujo CRM"], ["phone", PHONE], ["rut", "11.111.111-1"], ["interest", "SUV automático"], ["budget", "15000000"], ["payMethod", "FINANCIAMIENTO"], ["comuna", "Ñuñoa"], ["region", "Metropolitana"]];
r = await submit(D, tG, fEdit, [...base, ["sellerId", vinSeller.id]]);
ok("Reasignar a vendedor de otra sucursal: rechazado", msg(r.html).length > 0 && (await db.opportunity.findUnique({ where: { id } }))!.sellerId === sellerA.id, msg(r.html));
r = await submit(D, tG, fEdit, [...base, ["sellerId", sellerB.id]]);
ok("Gerencia reasigna a otro vendedor SCL (queda en cronología)", (await db.opportunity.findUnique({ where: { id } }))!.sellerId === sellerB.id && !!(await db.activity.findFirst({ where: { opportunityId: id, body: { startsWith: "Reasignada" } } })), msg(r.html));
ok("El vendedor anterior ya no ve el lead", (await page(D, tV)).includes("NEXT_HTTP_ERROR_FALLBACK;404"));

console.log("\n== Mover y registrar llamada ==");
const fStage = find(await forms(D, tG), 'name="reason"');
r = await submit(D, tG, fStage, [["stage", "NEGOCIANDO"], ["reason", ""]]);
ok("Mover Nuevo → Negociando (historial + cronología)", (await db.opportunity.findUnique({ where: { id } }))!.stage === "NEGOCIANDO" && (await db.stageChange.count({ where: { opportunityId: id, to: "NEGOCIANDO" } })) === 1 && !!(await db.activity.findFirst({ where: { opportunityId: id, type: "ETAPA" } })), msg(r.html));
r = await submit(D, tG, fStage, [["stage", "INVENTADA"], ["reason", ""]]);
ok("Etapa inexistente rechazada", msg(r.html).includes("Etapa no válida"), msg(r.html));
const fAct = find(await forms(D, tG), 'name="body"');
r = await submit(D, tG, fAct, [["type", "LLAMADA"], ["outcome", "Contestó"], ["body", "Llamada de prueba: pide cotización"], ["nextFollowUpAt", "2026-12-02T11:00"]]);
const call = await db.activity.findFirst({ where: { opportunityId: id, type: "LLAMADA" } });
ok("Llamada registrada en cronología con resultado y próximo seguimiento", !!call && call.outcome === "Contestó" && (await db.opportunity.findUnique({ where: { id } }))!.nextFollowUpAt?.toISOString().startsWith("2026-12-02") === true, msg(r.html));
r = await submit(D, tG, fAct, [["type", "ETAPA"], ["body", "falsa"]]);
ok("Tipo de actividad no permitido rechazado", msg(r.html).includes("no válido"), msg(r.html));
const c2 = await counts(tG);
ok("Tras mover: Kanban = tabla; Negociando +1", c2.kanban === c2.table && c2.cols["Negociando"] === c0.cols["Negociando"] + 1, `kanban ${c2.kanban} · tabla ${c2.table}`);

console.log("\n== Cancelar ==");
r = await submit(D, tG, fStage, [["stage", "CANCELADO"], ["reason", ""]]);
ok("Cancelar sin motivo: rechazado", msg(r.html).includes("motivo") && (await db.opportunity.findUnique({ where: { id } }))!.stage === "NEGOCIANDO", msg(r.html));
r = await submit(D, tG, fStage, [["stage", "CANCELADO"], ["reason", "Compró en otra automotora"]]);
const oc = await db.opportunity.findUnique({ where: { id } });
ok("Cancelar con motivo", oc?.stage === "CANCELADO" && oc.cancelReason === "Compró en otra automotora" && !!oc.closedAt, msg(r.html));
const c3 = await counts(tG);
ok("Cancelados: columna Kanban = tabla filtrada", c3.cancelBoard === c3.tableCancel && c3.kanban === c3.table, `kanban ${c3.cancelBoard} · tabla ${c3.tableCancel}`);

console.log("\n== Papelera ==");
ok("Vendedor no accede a la papelera", (await page("/panel/crm/papelera", tV)).includes("NEXT_REDIRECT"));
r = await submit(D, tG, find(await forms(D, tG), "Enviar a papelera"), []);
ok("Gerencia envía a papelera", !!(await db.opportunity.findUnique({ where: { id } }))!.deletedAt, `${r.status}`);
const c4 = await counts(tG);
ok("En papelera: sale de Kanban y tabla por igual", c4.kanban === c0.kanban && c4.table === c0.table, `kanban ${c4.kanban} · tabla ${c4.table}`);
ok("La ficha eliminada no se abre fuera de la papelera", (await page(D, tG)).includes("NEXT_HTTP_ERROR_FALLBACK;404"));
const fRestore = find(await forms("/panel/crm/papelera", tG), id);
r = await submit("/panel/crm/papelera", tGV, fRestore, []);
ok("Gerencia VIN no puede restaurar un lead SCL", !!(await db.opportunity.findUnique({ where: { id } }))!.deletedAt, msg(r.html) || `${r.status}`);
r = await submit("/panel/crm/papelera", tG, fRestore, []);
ok("Gerencia SCL restaura el lead", !(await db.opportunity.findUnique({ where: { id } }))!.deletedAt, msg(r.html));
const c5 = await counts(tG);
ok("Tras restaurar: Kanban = tabla = inicial + 1", c5.kanban === c5.table && c5.table === c0.table + 1, `kanban ${c5.kanban} · tabla ${c5.table}`);

console.log("\n== Vista personal y exportación ==");
const mine = await page("/panel/crm?type=VENTA", tV);
ok("Vendedor ve solo «Mi cartera» sin selector Global", mine.includes("Mi cartera") && !mine.includes(">Global<"));
const exp = await fetch(`${BASE}/api/export/leads?type=VENTA`, { headers: { cookie: `stk_session=${tG}` } });
const lines = (await exp.text()).trim().split("\n").length - 1;
ok("Exportación de gerencia = filas de la tabla", exp.status === 200 && lines === c5.table, `${lines} filas`);
ok("Exportación denegada a vendedor", (await fetch(`${BASE}/api/export/leads`, { headers: { cookie: `stk_session=${tV}` } })).status === 403);

// Limpieza
await db.auditLog.deleteMany({ where: { entityId: id } });
await db.opportunity.deleteMany({ where: { contact: { phone: PHONE } } });
await db.contact.deleteMany({ where: { phone: PHONE } });
await db.session.deleteMany({ where: { tokenHash: { in: tokens.map(sha256) } } });
console.log(`\n${pass} PASS · ${fail} FAIL`);
await db.$disconnect();
process.exit(fail ? 1 : 0);
