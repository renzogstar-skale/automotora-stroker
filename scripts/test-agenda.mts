// Agenda de punta a punta: agendar desde un lead, cruces de horario, completar y ver el seguimiento en Hoy del equipo.
// También Informe diario (borrador → envío → bloqueo) e Informe CEO. Requiere `npm run dev`. Uso: npx tsx scripts/test-agenda.mts
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
  return { status: r.status, html: await r.text() };
}
const msg = (h: string) => h.match(/role="(?:alert|status)"[^>]*>(?:<svg[\s\S]*?<\/svg>)?([^<]+)/)?.[1] ?? h.match(/text-(?:red|emerald)-700[^"]*">([^<]+)/)?.[1] ?? "";
const find = (fs: Awaited<ReturnType<typeof forms>>, needle: string) => { const f = fs.find((x) => x.html.includes(needle)); if (!f) throw new Error(`Formulario no encontrado: ${needle}`); return f; };
/** Fila del vendedor en Hoy del equipo: seguimientos próximos y tareas pendientes. */
async function teamRow(token: string, sellerId: string) {
  const html = await page("/panel/equipo", token);
  const row = html.match(new RegExp(`<tr[^>]*data-seller="${sellerId}"[^>]*>([\\s\\S]*?)</tr>`))?.[1] ?? "";
  const cell = (k: string) => +(row.match(new RegExp(`data-k="${k}"[^>]*>(?:<a[^>]*>)?<span[^>]*>(\\d+)`))?.[1] ?? -1);
  return { followNext: cell("followNext"), tasks: cell("tasks") };
}

const NOTE = "TEST-AGENDA";
const started = new Date();
const valentina = await db.user.findUniqueOrThrow({ where: { email: "valentina@stroker.demo" }, include: { seller: true } });
const sellerA = valentina.seller!;
const sellerB = await db.seller.findFirstOrThrow({ where: { branchId: sellerA.branchId, active: true, id: { not: sellerA.id } } });
const opp = await db.opportunity.findFirstOrThrow({ where: { sellerId: sellerA.id, deletedAt: null, closedAt: null, type: "VENTA" }, include: { contact: true } });
const snap = { stage: opp.stage, stageChangedAt: opp.stageChangedAt, nextFollowUpAt: opp.nextFollowUpAt };
await db.opportunity.update({ where: { id: opp.id }, data: { nextFollowUpAt: null } });
const vehicle = await db.vehicle.findFirstOrThrow({ where: { branchId: sellerA.branchId, status: "DISPONIBLE" } });
await db.appointment.deleteMany({ where: { notes: NOTE } });
const tV = await session("valentina@stroker.demo"), tG = await session("gerencia@stroker.demo");
const DAY = "2027-03-10";

try {
  console.log("== Agendar desde el lead ==");
  const ficha = await page(`/panel/crm/${opp.id}`, tV);
  ok("La ficha del lead ofrece «Agendar»", ficha.includes(`/panel/citas?nueva=1&amp;opp=${opp.id}`));
  const NEW = `/panel/citas?nueva=1&opp=${opp.id}`;
  const fNew = find(await forms(NEW, tV), 'name="duration"');
  ok("El formulario viene con el lead preseleccionado", fNew.html.includes(`<option value="${opp.id}" selected="">`));
  const base: [string, string][] = [["type", "TEST_DRIVE"], ["duration", "60"], ["branchId", sellerA.branchId], ["opportunityId", opp.id], ["sellerId", ""], ["notes", NOTE]];
  let r = await submit(NEW, tV, fNew, [...base, ["startAt", `${DAY}T10:00`], ["vehicleId", vehicle.id]]);
  const appt = await db.appointment.findFirst({ where: { notes: NOTE, opportunityId: opp.id } });
  ok("Cita creada desde el lead con vendedor y cliente del lead", !!appt && appt.sellerId === sellerA.id && appt.contactId === opp.contactId && appt.vehicleId === vehicle.id, msg(r.html));
  ok("La cita queda en la cronología del lead", !!(await db.activity.findFirst({ where: { opportunityId: opp.id, type: "CITA", createdAt: { gte: started } } })));

  console.log("\n== Cruces de horario ==");
  r = await submit(NEW, tV, fNew, [...base, ["startAt", `${DAY}T10:30`], ["vehicleId", ""]]);
  ok("Cruce del vendedor detectado (10:30 sobre 10:00–11:00)", msg(r.html).includes("ya tiene una cita"), msg(r.html));
  const fG = find(await forms("/panel/citas?nueva=1", tG), 'name="duration"');
  r = await submit("/panel/citas?nueva=1", tG, fG, [["type", "TEST_DRIVE"], ["duration", "60"], ["branchId", sellerA.branchId], ["opportunityId", ""], ["sellerId", sellerB.id], ["notes", NOTE], ["startAt", `${DAY}T10:45`], ["vehicleId", vehicle.id]]);
  ok("Cruce del vehículo detectado con otro vendedor", msg(r.html).includes("vehículo ya está agendado"), msg(r.html));
  r = await submit(NEW, tV, fNew, [...base, ["startAt", `${DAY}T11:00`], ["vehicleId", ""]]);
  const back = await db.appointment.findFirst({ where: { notes: NOTE, startAt: { gt: appt!.startAt } } });
  ok("Cita contigua (11:00) sí se permite", !!back, msg(r.html));
  if (back) await db.appointment.delete({ where: { id: back.id } });

  console.log("\n== Completar y seguimiento ==");
  const before = await teamRow(tG, sellerA.id);
  const FOCUS = `/panel/citas?view=day&d=${DAY}&focus=${appt!.id}`;
  const focusHtml = await page(FOCUS, tV);
  ok("El detalle muestra el historial de la cita", focusHtml.includes("Historial") && focusHtml.includes("agendado para"));
  r = await submit(FOCUS, tV, find(await forms(FOCUS, tV), 'value="confirm"'), []);
  ok("Cita confirmada", (await db.appointment.findUnique({ where: { id: appt!.id } }))!.status === "CONFIRMADA", msg(r.html));
  r = await submit(FOCUS, tV, find(await forms(FOCUS, tV), 'value="complete"'), []);
  const done = await db.appointment.findUnique({ where: { id: appt!.id } });
  const o2 = await db.opportunity.findUnique({ where: { id: opp.id } });
  const task = await db.task.findFirst({ where: { opportunityId: opp.id, assignedToId: valentina.id, doneAt: null, createdAt: { gte: started } } });
  ok("Cita completada", done?.status === "COMPLETADA", msg(r.html));
  ok("Seguimiento en el lead (~24 h) y tarea para la vendedora", !!o2?.nextFollowUpAt && Math.abs(o2.nextFollowUpAt.getTime() - Date.now() - 24 * 3600e3) < 600e3 && !!task?.title.startsWith("Seguimiento post"), task?.title ?? "sin tarea");
  ok("Cita cerrada ya no ofrece acciones", !(await page(FOCUS, tV)).includes('value="complete"'));
  const after = await teamRow(tG, sellerA.id);
  ok("Hoy del equipo: seguimientos próximos +1", after.followNext === before.followNext + 1, `${before.followNext} → ${after.followNext}`);
  ok("Hoy del equipo: tareas pendientes +1", after.tasks === before.tasks + 1, `${before.tasks} → ${after.tasks}`);
  ok("Hoy del equipo enlaza al CRM filtrado por vendedor", (await page("/panel/equipo", tG)).includes(`/panel/crm?scope=all&amp;seller=${sellerA.id}`));
  ok("Vendedor no accede a Hoy del equipo", (await page("/panel/equipo", tV)).includes("NEXT_REDIRECT"));

  console.log("\n== Informe diario ==");
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
  await db.dailyReport.deleteMany({ where: { sellerId: sellerA.id, date: new Date(`${today}T00:00:00Z`) } });
  const fR = find(await forms("/panel/informe-diario", tV), 'name="creditsEntered"');
  const rep0: [string, string][] = [["day", today], ["consignments", "Juan Pérez · Corolla 2019 · interesado"], ["creditsEntered", "2"], ["publications", "3"], ["notes", NOTE]];
  r = await submit("/panel/informe-diario", tV, fR, [...rep0, ["intent", "draft"]]);
  let rep = await db.dailyReport.findFirst({ where: { sellerId: sellerA.id, notes: NOTE } });
  ok("Borrador guardado", rep?.status === "BORRADOR" && rep.creditsEntered === 2, msg(r.html));
  ok("Supervisión ve el borrador por sucursal", (await page("/panel/informe-diario", tG)).includes("Borrador"));
  r = await submit("/panel/informe-diario", tV, fR, [...rep0, ["intent", "send"]]);
  rep = await db.dailyReport.findFirst({ where: { sellerId: sellerA.id, notes: NOTE } });
  ok("Informe enviado con consignación manual", rep?.status === "ENVIADO" && !!rep.submittedAt && (rep.consignmentCalls as unknown[]).length >= 1, msg(r.html));
  r = await submit("/panel/informe-diario", tV, fR, [["day", today], ["creditsEntered", "9"], ["publications", "0"], ["intent", "draft"]]);
  const locked = await db.dailyReport.findUnique({ where: { id: rep!.id } });
  ok("Informe enviado queda bloqueado (sin formulario y sin cambios)", locked?.status === "ENVIADO" && locked.creditsEntered === 2 && !(await page("/panel/informe-diario", tV)).includes('name="creditsEntered"'));
  if (rep) await db.dailyReport.delete({ where: { id: rep.id } });

  console.log("\n== Informe CEO ==");
  const ceo = await page("/panel/informe-ceo", tG);
  ok("Informe CEO muestra actividad, excepciones y margen", ceo.includes("Actividad comercial por sucursal") && ceo.includes("Excepciones") && ceo.includes("Margen"));
} finally {
  const ids = (await db.appointment.findMany({ where: { notes: NOTE } })).map((x) => x.id);
  await db.auditLog.deleteMany({ where: { entityId: { in: ids } } });
  await db.appointment.deleteMany({ where: { notes: NOTE } });
  await db.task.deleteMany({ where: { opportunityId: opp.id, createdAt: { gte: started } } });
  await db.activity.deleteMany({ where: { opportunityId: opp.id, createdAt: { gte: started } } });
  await db.stageChange.deleteMany({ where: { opportunityId: opp.id, createdAt: { gte: started } } });
  await db.opportunity.update({ where: { id: opp.id }, data: snap });
  await db.session.deleteMany({ where: { tokenHash: { in: tokens.map(sha256) } } });
  console.log(`\n${pass} PASS · ${fail} FAIL`);
  await db.$disconnect();
}
process.exit(fail ? 1 : 0);
