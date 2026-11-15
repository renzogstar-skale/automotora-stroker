/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from "../../src/lib/db";
import { addDays } from "../../src/lib/format";
import { catId } from "../../src/server/categories";
import { confirmSale, annulSale } from "../../src/server/sales";
import { registerPayment, reversePayment } from "../../src/server/payments";
import { reserveVehicle } from "../../src/server/inventory";
import { createConsignment, payOwner } from "../../src/server/consignments";
import { valuate } from "../../src/server/appraisal";
import { createDocument, emitDocument } from "../../src/server/documents";
import { createApiKey } from "../../src/server/apikeys";
import { STAGES } from "../../src/lib/labels";
import * as D from "./data";
import { int, pick, round, rnd, NOW, inMonth, daysAgo, daysAhead, photosFor, plate, type Ctx } from "./index";

const STAGE_KEYS = STAGES.map((s) => s[0]);
const ageYears = (y: number) => NOW.getFullYear() - y;

async function addVehicle(ctx: Ctx, o: { code: string; cat?: number; stockSince: Date; photos?: boolean; published?: boolean; ownership?: "PROPIO" | "CONSIGNADO"; status?: any; featured?: boolean }) {
  const c = D.CATALOG[o.cat ?? int(0, D.CATALOG.length - 1)];
  const year = c[4] === "Moto" ? int(2020, 2023) : int(2016, 2024);
  const price = round(c[3] * Math.pow(0.9, ageYears(year)), 100000) - 10000;
  const cost = round(price * (0.8 + rnd() * 0.07));
  const v = await db.vehicle.create({
    data: {
      branchId: ctx.branches[o.code].id, brand: c[0], model: c[1], version: c[2], year, plate: plate(), vin: rnd() > 0.3 ? `9BW${int(10000000, 99999999)}ZX${int(1000, 9999)}` : null,
      km: c[4] === "Moto" ? int(3000, 25000) : Math.max(5000, ageYears(year) * int(9000, 17000)), transmission: c[6], fuel: c[5], bodyType: c[4],
      color: pick(D.COLORS), condition: year >= 2024 && rnd() > 0.5 ? "NUEVO" : "USADO", ownership: o.ownership ?? "PROPIO", status: o.status ?? "DISPONIBLE",
      price, cost, stockSince: o.stockSince, createdAt: o.stockSince, featured: !!o.featured,
      description: `${c[0]} ${c[1]} ${c[2]} ${year}, ${pick(["única dueña", "mantenciones en concesionario", "neumáticos nuevos", "full equipo", "impecable"])}. Revisión técnica y permiso de circulación al día.`,
      slug: `${c[0]}-${c[1]}-${year}-${plateNo()}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    },
  });
  if (o.photos !== false) {
    const ph = photosFor(c[0], c[1]);
    await db.vehiclePhoto.createMany({ data: ph.map((url, i) => ({ vehicleId: v.id, url, order: i, isCover: i === 0 })) });
    if (o.published) await db.vehicle.update({ where: { id: v.id }, data: { published: true, publishedAt: addDays(o.stockSince, 2) } });
  }
  if (v.ownership === "PROPIO")
    await db.movement.create({ data: { date: o.stockSince, type: "EGRESO", categoryId: await catId("Compra de vehículo"), amount: cost, description: `Compra ${c[0]} ${c[1]} ${v.plate}`, tags: ["inventario"], branchId: v.branchId, vehicleId: v.id } });
  if (rnd() > 0.35)
    await db.movement.create({ data: { date: addDays(o.stockSince, 3), type: "EGRESO", categoryId: await catId("Preparación de vehículo"), amount: round(int(120, 650) * 1000, 1000), description: `Preparación ${pick(["pulido y detailing", "mantención", "cambio de neumáticos", "desabolladura"])} ${v.plate}`, tags: ["preparación"], branchId: v.branchId, vehicleId: v.id } });
  return v;
}
let slugN = 0;
const plateNo = () => String(++slugN);

function person(code: string) {
  const name = `${pick(D.FIRST)} ${pick(D.LAST)}`;
  return { name, phone: `+569${int(40000000, 99999999)}`, email: rnd() > 0.3 ? `${name.split(" ")[0].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")}.${int(10, 99)}@correo.example` : null, comuna: pick(code === "SCL" ? D.COMUNAS_SCL : D.COMUNAS_VIN), region: code === "SCL" ? "Metropolitana" : "Valparaíso" };
}

const PATHS: Record<string, string[]> = {
  NUEVO: ["NUEVO"], NO_CONTESTA: ["NUEVO", "NO_CONTESTA"], SEGUIMIENTO: ["NUEVO", "SEGUIMIENTO"], BUSCANDO: ["NUEVO", "SEGUIMIENTO", "BUSCANDO"],
  EN_ESPERA: ["NUEVO", "SEGUIMIENTO", "EN_ESPERA"], NEGOCIANDO: ["NUEVO", "SEGUIMIENTO", "NEGOCIANDO"], AGENDADO: ["NUEVO", "SEGUIMIENTO", "AGENDADO"],
  PARA_CIERRE: ["NUEVO", "SEGUIMIENTO", "NEGOCIANDO", "PARA_CIERRE"], CONCRETADO: ["NUEVO", "SEGUIMIENTO", "NEGOCIANDO", "CONCRETADO"],
  CANCELADO: ["NUEVO", "NO_CONTESTA", "CANCELADO"],
};
export async function makeOpp(ctx: Ctx, o: { code: string; seller: any; createdAt: Date; stage: string; source?: any; type?: any; vehicle?: any; deleted?: boolean }) {
  const p = person(o.code);
  const contact = await db.contact.create({ data: { ...p, rut: rnd() > 0.5 ? `${int(8, 24)}.${int(100, 999)}.${int(100, 999)}-${int(0, 9)}` : null, createdAt: o.createdAt } });
  const path = o.stage === "CANCELADO" && rnd() > 0.5 ? ["NUEVO", "SEGUIMIENTO", "NEGOCIANDO", "CANCELADO"] : PATHS[o.stage];
  const end = new Date(Math.min(NOW.getTime() - 3600e3, o.createdAt.getTime() + int(3, 25) * 864e5));
  const step = (end.getTime() - o.createdAt.getTime()) / Math.max(1, path.length - 1);
  const dates = path.map((_, i) => new Date(o.createdAt.getTime() + step * i));
  const closed = o.stage === "CONCRETADO" || o.stage === "CANCELADO";
  const opp = await db.opportunity.create({
    data: {
      type: o.type ?? "VENTA", stage: o.stage as any, source: o.source ?? pick(["WEB", "WEB", "WHATSAPP", "WHATSAPP", "TELEFONO", "REDES", "REFERIDO", "PRESENCIAL"]),
      contactId: contact.id, sellerId: o.seller.id, branchId: ctx.branches[o.code].id, vehicleId: o.vehicle?.id ?? null,
      interest: o.vehicle ? `${o.vehicle.brand} ${o.vehicle.model} ${o.vehicle.year}` : pick(["SUV automático hasta $18M", "Camioneta 4x4 diésel", "Hatchback económico", "Sedán familiar 2019+"]),
      budget: round(int(8, 30) * 1e6, 500000), payMethod: pick(["CONTADO", "FINANCIAMIENTO", "PARTE_PAGO"]),
      createdAt: o.createdAt, stageChangedAt: dates[dates.length - 1], closedAt: closed ? dates[dates.length - 1] : null,
      cancelReason: o.stage === "CANCELADO" ? pick(D.CANCEL_REASONS) : null,
      nextFollowUpAt: closed ? null : new Date(NOW.getTime() + int(-72, 96) * 3600e3),
      deletedAt: o.deleted ? daysAgo(2) : null, deletedById: o.deleted ? ctx.admin.id : null,
    },
  });
  await db.stageChange.createMany({ data: path.map((s, i) => ({ opportunityId: opp.id, from: i ? (path[i - 1] as any) : null, to: s as any, createdAt: dates[i], reason: s === "CANCELADO" ? opp.cancelReason : null, userId: o.seller.userId })) });
  const acts: any[] = [{ type: "SISTEMA", body: `Oportunidad creada desde ${opp.source}`, createdAt: o.createdAt, userName: "Sistema" }];
  path.slice(1).forEach((s, i) => acts.push({ type: "ETAPA", body: `${STAGES.find((x) => x[0] === path[i])![1]} → ${STAGES.find((x) => x[0] === s)![1]}`, createdAt: dates[i + 1], userName: o.seller.name }));
  if (o.stage !== "NUEVO") for (let i = 0; i < int(1, 3); i++) acts.push({ type: pick(["LLAMADA", "LLAMADA", "NOTA", "MENSAJE"]), body: pick(D.CALL_NOTES), outcome: pick(["Contestó", "Contestó", "No contesta", null]), createdAt: new Date(o.createdAt.getTime() + rnd() * (end.getTime() - o.createdAt.getTime())), userName: o.seller.name, userId: o.seller.userId });
  await db.activity.createMany({ data: acts.map((a) => ({ ...a, opportunityId: opp.id, contactId: contact.id })) });
  return opp;
}

export async function backdate(entityId: string, d: Date) {
  await db.auditLog.updateMany({ where: { entityId, createdAt: { gt: new Date(NOW.getTime() - 3600e3) } }, data: { createdAt: d } });
}

export async function seedSales(ctx: Ctx) {
  const perMonth = [3, 4, 4, 5, 4, 5, 3];
  const sales: any[] = [];
  const startStock = inMonth(-6, 2);
  for (let i = 0; i < perMonth.length; i++) {
    const k = i - 6;
    for (let n = 0; n < perMonth[i]; n++) {
      const code = rnd() < 0.65 ? "SCL" : "VIN";
      const seller = pick(ctx.sellersOf(code));
      const saleDate = k === 0 ? daysAgo(int(1, 11), int(10, 18)) : inMonth(k, int(2, 27), int(10, 18));
      const stockSince = new Date(Math.max(startStock.getTime(), saleDate.getTime() - int(12, 80) * 864e5));
      const v = await addVehicle(ctx, { code, stockSince, published: true });
      const opp = await makeOpp(ctx, { code, seller, createdAt: new Date(Math.max(stockSince.getTime(), saleDate.getTime() - int(4, 25) * 864e5)), stage: "NEGOCIANDO", vehicle: v });
      const r = rnd();
      const payMethod = r < 0.45 ? "FINANCIAMIENTO" : r < 0.6 ? "PARTE_PAGO" : "CONTADO";
      const discount = rnd() > 0.5 ? round(v.price * 0.02) : 0;
      const final = v.price - discount;
      const financed = payMethod === "FINANCIAMIENTO" ? round(final * 0.6) : 0;
      const credit = financed ? round(financed * 0.03) : 0;
      const tradeIn = payMethod === "PARTE_PAGO" ? { value: round(int(35, 70) * 1e5, 100000), plate: plate(), brand: "Chevrolet", model: pick(["Spark", "Aveo", "Cruze"]), year: int(2012, 2017), km: int(90, 160) * 1000 } : null;
      const due = k === 0 && n === 0 ? daysAgo(1) : k === 0 ? daysAhead(int(3, 9)) : null;
      const sale = await confirmSale({ vehicleId: v.id, opportunityId: opp.id, sellerId: seller.id, discount, payMethod: payMethod as any, financedAmount: financed, extraIncome: credit, creditIncome: credit, saleDate, balanceDueAt: due, tradeIn, referredBy: rnd() > 0.85 ? `${pick(D.FIRST)} (cliente)` : null }, ctx.actorFor(seller));
      await db.opportunity.update({ where: { id: opp.id }, data: { closedAt: saleDate, stageChangedAt: saleDate } });
      await db.stageChange.updateMany({ where: { opportunityId: opp.id, to: "CONCRETADO" }, data: { createdAt: saleDate } });
      await db.activity.updateMany({ where: { opportunityId: opp.id, createdAt: { gt: new Date(NOW.getTime() - 3600e3) } }, data: { createdAt: saleDate } });
      await backdate(sale.id, saleDate); await backdate(opp.id, saleDate); await backdate(v.id, saleDate);
      if (tradeIn) {
        const tv = await db.vehicle.findUniqueOrThrow({ where: { plate: tradeIn.plate } });
        await db.vehicle.update({ where: { id: tv.id }, data: { stockSince: saleDate, createdAt: saleDate } });
        await backdate(tv.id, saleDate);
      }
      const cash = final - financed - (tradeIn?.value ?? 0);
      const key = (x: string) => `seed-${sale.id}-${x}`;
      const pay = async (amount: number, method: string, at: Date, x: string) => {
        if (at <= NOW && amount > 0) { const r = await registerPayment({ saleId: sale.id, amount, method, paidAt: at, idempotencyKey: key(x) }, ctx.admin); await backdate(r.payment.id, at); }
      };
      if (k === 0) await pay(round(cash * 0.5), "Transferencia", saleDate, "a");
      else if (rnd() > 0.5) { await pay(round(cash * 0.3), "Transferencia", saleDate, "a"); await pay(cash - round(cash * 0.3), "Vale vista", addDays(saleDate, 3), "b"); }
      else await pay(cash, pick(["Transferencia", "Vale vista"]), saleDate, "a");
      if (financed) await pay(financed, "Crédito automotriz", addDays(saleDate, 6), "c");
      if (credit) {
        const at = addDays(saleDate, 15);
        await db.movement.create({ data: { date: at <= NOW ? at : NOW, isPending: at > NOW, dueDate: at > NOW ? at : null, type: "INGRESO", categoryId: await catId("Comisión de financiera"), amount: credit, description: `Comisión financiera venta #${sale.number}`, tags: ["crédito"], branchId: v.branchId, saleId: sale.id } });
      }
      if (rnd() > 0.55) await db.movement.create({ data: { date: addDays(saleDate, 1), type: "EGRESO", categoryId: await catId("Gasto directo de venta"), amount: round(int(60, 250) * 1000, 1000), description: `Transferencia, inscripción y lavado venta #${sale.number}`, tags: ["venta"], branchId: v.branchId, saleId: sale.id, vehicleId: v.id } });
      const old = saleDate < daysAgo(4);
      await db.sale.update({ where: { id: sale.id }, data: { delivery: old ? "ENTREGADA" : pick(["PENDIENTE", "PROGRAMADA"]), deliveredAt: old ? addDays(saleDate, 2) : null } });
      sales.push({ sale, v, seller, k, opp, saleDate });
    }
  }
  return sales;
}

async function seedSpecialCases(ctx: Ctx, sales: any[]) {
  // Venta anulada (historial de anulaciones y reversos).
  const an = sales.find((s) => s.k === -2 && s.sale.payMethod === "CONTADO") ?? sales.find((s) => s.k === -2)!;
  await annulSale(an.sale.id, "Cliente desistió antes de la transferencia", ctx.admin);
  const annulAt = addDays(an.saleDate, 4);
  await db.sale.update({ where: { id: an.sale.id }, data: { annulledAt: annulAt } });
  await db.movement.updateMany({ where: { saleId: an.sale.id, reversalOfId: { not: null } }, data: { date: annulAt } });
  await db.payment.updateMany({ where: { saleId: an.sale.id }, data: { reversedAt: annulAt } });
  await backdate(an.sale.id, annulAt);
  await db.vehiclePhoto.count({ where: { vehicleId: an.v.id } }) && await db.vehicle.update({ where: { id: an.v.id }, data: { published: true } });
  // Pago reversado (transferencia rechazada) y reintento exitoso.
  const rv = sales.find((s) => s.k === -1 && s.sale.payMethod === "CONTADO") ?? sales.find((s) => s.k === -1)!;
  const p = await db.payment.findFirst({ where: { saleId: rv.sale.id, status: "REGISTRADO", method: { not: "Parte de pago" } } });
  if (p) {
    await reversePayment(p.id, "Transferencia rechazada por el banco", ctx.admin, false);
    await db.movement.updateMany({ where: { paymentId: p.id, type: "EGRESO" }, data: { date: addDays(p.paidAt, 1) } });
    const r = await registerPayment({ saleId: rv.sale.id, amount: p.amount, method: "Transferencia", paidAt: addDays(p.paidAt, 2), idempotencyKey: `seed-retry-${p.id}` }, ctx.admin);
    await backdate(p.id, addDays(p.paidAt, 1)); await backdate(r.payment.id, addDays(p.paidAt, 2));
  }
  // Comisiones pagadas: un movimiento mensual por las ventas del mes anterior.
  for (let k = -6; k < 0; k++) {
    const ms = sales.filter((s) => s.k === k && s.sale.id !== an.sale.id);
    const comms = await db.saleCommission.findMany({ where: { saleId: { in: ms.map((s) => s.sale.id) } } });
    const total = comms.reduce((a, c) => a + c.amount, 0);
    const at = inMonth(k + 1, 5, 12);
    if (!total || at > NOW) continue;
    await db.saleCommission.updateMany({ where: { id: { in: comms.map((c) => c.id) } }, data: { paidAt: at } });
    await db.movement.create({ data: { date: at, type: "EGRESO", categoryId: await catId("Comisiones pagadas"), amount: total, description: `Pago de comisiones del mes (${ms.length} ventas)`, tags: ["comisiones"] } });
  }
}

async function seedConsignments(ctx: Ctx) {
  const specs = [
    { code: "SCL", modality: "FISICA", cat: 13, daysAgo: 40, sell: -2 }, { code: "VIN", modality: "ONLINE", cat: 16, daysAgo: 25, sell: 0 },
    { code: "SCL", modality: "FISICA", cat: 0, daysAgo: 20 }, { code: "SCL", modality: "ONLINE", cat: 18, daysAgo: 12 },
    { code: "SCL", modality: "FISICA", cat: 22, daysAgo: 85, endSoon: true }, { code: "VIN", modality: "FISICA", cat: 5, daysAgo: 30 },
    { code: "VIN", modality: "ONLINE", cat: 20, daysAgo: 6, noPhotos: true },
  ] as const;
  for (const s of specs) {
    const c = D.CATALOG[s.cat];
    const seller = pick(ctx.sellersOf(s.code));
    const year = int(2017, 2022);
    const price = round(c[3] * Math.pow(0.9, ageYears(year)), 100000) - 10000;
    const kmv = ageYears(year) * int(10000, 15000);
    const val = valuate({ brand: c[0], year, km: kmv, condition: "BUENO" });
    const start = daysAgo(s.daysAgo);
    const owner = person(s.code);
    const appr = await db.appraisal.create({ data: { plate: plate(), kind: "AUTO", brand: c[0], model: c[1], version: c[2], year, km: kmv, condition: "BUENO", minValue: val.min, maxValue: val.max, suggested: val.suggested, source: val.source, sourceDate: start, isDemo: true, createdById: ctx.admin.id, createdAt: start } });
    const cons = await createConsignment({
      owner: { name: owner.name, phone: owner.phone, email: owner.email ?? undefined }, appraisalId: appr.id,
      vehicle: { branchId: ctx.branches[s.code].id, brand: c[0], model: c[1], version: c[2], year, plate: appr.plate, km: kmv, transmission: c[6], fuel: c[5], bodyType: c[4], color: pick(D.COLORS), price, description: `Consignado ${s.modality === "FISICA" ? "en sucursal" : "online"}. Dueño particular, papeles al día.` },
      modality: s.modality, agreedPrice: round(price * 0.88), days: "endSoon" in s ? 90 : 60, responsibleId: seller.id,
      documents: { padron: true, permiso: true, revision: true, mandato: s.daysAgo > 10, poder: false },
    }, ctx.actorFor(seller));
    await db.consignment.update({ where: { id: cons.id }, data: { startDate: start, createdAt: start, endDate: addDays(start, "endSoon" in s ? 90 : 60) } });
    await db.vehicle.update({ where: { id: cons.vehicleId }, data: { stockSince: start, createdAt: start } });
    await backdate(cons.id, start); await backdate(cons.vehicleId, start);
    if (!("noPhotos" in s)) {
      await db.vehiclePhoto.createMany({ data: photosFor(c[0], c[1]).map((url, i) => ({ vehicleId: cons.vehicleId, url, order: i, isCover: i === 0 })) });
      await db.vehicle.update({ where: { id: cons.vehicleId }, data: { published: true, publishedAt: addDays(start, 1) } });
    }
    if ("sell" in s) {
      const saleDate = s.sell === 0 ? daysAgo(3) : inMonth(s.sell, 14, 12);
      const opp = await makeOpp(ctx, { code: s.code, seller, createdAt: addDays(saleDate, -8), stage: "NEGOCIANDO", vehicle: await db.vehicle.findUnique({ where: { id: cons.vehicleId } }) });
      const sale = await confirmSale({ vehicleId: cons.vehicleId, opportunityId: opp.id, sellerId: seller.id, payMethod: "CONTADO", saleDate }, ctx.actorFor(seller));
      await db.opportunity.update({ where: { id: opp.id }, data: { closedAt: saleDate, stageChangedAt: saleDate } });
      await backdate(sale.id, saleDate);
      const r = await registerPayment({ saleId: sale.id, amount: sale.finalPrice, method: "Transferencia", paidAt: saleDate, idempotencyKey: `seed-cons-${sale.id}` }, ctx.admin);
      await backdate(r.payment.id, saleDate);
      await db.sale.update({ where: { id: sale.id }, data: { delivery: "ENTREGADA", deliveredAt: addDays(saleDate, 1) } });
      if (s.sell < 0) {
        const po = await payOwner(cons.id, sale.costBasis, `seed-payout-${cons.id}`, ctx.admin);
        await db.movement.updateMany({ where: { payoutId: po.id }, data: { date: addDays(saleDate, 7) } });
        await db.ownerPayout.update({ where: { id: po.id }, data: { paidAt: addDays(saleDate, 7) } });
      }
    }
  }
}

async function seedStockAndPipeline(ctx: Ctx) {
  const stock: any[] = [];
  const plan = [
    ...Array.from({ length: 11 }, (_, i) => ({ code: "SCL", published: i < 8, photos: i < 10 })),
    ...Array.from({ length: 7 }, (_, i) => ({ code: "VIN", published: i < 5, photos: i < 6 })),
  ];
  for (const [i, p] of plan.entries()) {
    const v = await addVehicle(ctx, { code: p.code, cat: (i * 5) % D.CATALOG.length, stockSince: daysAgo(i === 0 ? 150 : int(4, 120)), photos: p.photos, published: p.published, featured: i % 4 === 0 && p.published });
    stock.push(v);
  }
  const retired = await addVehicle(ctx, { code: "SCL", stockSince: daysAgo(70), published: false });
  await db.vehicle.update({ where: { id: retired.id }, data: { status: "RETIRADO" } });
  await db.auditLog.create({ data: { userId: ctx.admin.id, actorName: ctx.admin.name, action: "vehicle.retire", entity: "Vehicle", entityId: retired.id, summary: `Retirado ${retired.plate}: falla de caja detectada en peritaje`, createdAt: daysAgo(10) } });

  // Pipeline: leads de los últimos 6 meses (el mes −7 queda vacío a propósito).
  const opps: any[] = [];
  for (let k = -6; k <= 0; k++) {
    const n = k === 0 ? 14 : 16;
    for (let i = 0; i < n; i++) {
      const code = rnd() < 0.65 ? "SCL" : "VIN";
      const createdAt = k === 0 ? daysAgo(int(1, 12), int(9, 19)) : inMonth(k, int(1, 28), int(9, 19));
      const recent = createdAt > daysAgo(30);
      const type = rnd() < 0.15 ? "CONSIGNACION" : rnd() < 0.15 ? "PISO" : "VENTA";
      const stage = recent ? pick(["NUEVO", "NO_CONTESTA", "SEGUIMIENTO", "SEGUIMIENTO", "BUSCANDO", "EN_ESPERA", "NEGOCIANDO", "AGENDADO", "PARA_CIERRE", "CANCELADO"])
        : type === "CONSIGNACION" && rnd() > 0.5 ? "CONCRETADO" : pick(["CANCELADO", "CANCELADO", "CANCELADO", "EN_ESPERA", "SEGUIMIENTO", "NO_CONTESTA"]);
      const vehicle = rnd() > 0.5 ? pick(stock.filter((v) => v.branchId === ctx.branches[code].id)) : null;
      opps.push(await makeOpp(ctx, { code, seller: pick(ctx.sellersOf(code)), createdAt, stage, type, vehicle: type === "VENTA" ? vehicle : null }));
    }
  }
  for (let i = 0; i < 4; i++) opps.push(await makeOpp(ctx, { code: i < 3 ? "SCL" : "VIN", seller: pick(ctx.sellersOf(i < 3 ? "SCL" : "VIN")), createdAt: daysAgo(0, 9 + i), stage: "NUEVO", source: pick(["WEB", "WHATSAPP"]) }));
  for (let i = 0; i < 2; i++) opps.push(await makeOpp(ctx, { code: "SCL", seller: ctx.sellersOf("SCL")[i], createdAt: daysAgo(2, 10), stage: "NUEVO", source: "WEB" }));
  for (let i = 0; i < 2; i++) await makeOpp(ctx, { code: "SCL", seller: ctx.sellersOf("SCL")[0], createdAt: daysAgo(20), stage: "NO_CONTESTA", deleted: true });

  // Reservas activas (una por vencer) y una expirada con abono por devolver.
  const pub = stock.filter((v) => v.published && v.branchId === ctx.branches.SCL.id);
  for (const [i, v] of pub.slice(0, 3).entries()) {
    const seller = ctx.sellersOf("SCL")[i % 2];
    const opp = await makeOpp(ctx, { code: "SCL", seller, createdAt: daysAgo(6 + i), stage: "NEGOCIANDO", vehicle: v });
    const r = await reserveVehicle({ vehicleId: v.id, opportunityId: opp.id, amount: 300000 + i * 100000, days: 3, idempotencyKey: `seed-res-${v.id}` }, ctx.actorFor(seller));
    if (i === 0) await db.reservation.update({ where: { id: r.id }, data: { expiresAt: new Date(NOW.getTime() + 8 * 3600e3) } });
    if (i === 2) {
      await db.reservation.update({ where: { id: r.id }, data: { status: "EXPIRADA", expiresAt: daysAgo(1), endedAt: daysAgo(1), endReason: "Plazo vencido", createdAt: daysAgo(4) } });
      await db.vehicle.update({ where: { id: v.id }, data: { status: "DISPONIBLE" } });
      await db.payment.updateMany({ where: { reservationId: r.id }, data: { paidAt: daysAgo(4) } });
      await db.movement.updateMany({ where: { payment: { reservationId: r.id } }, data: { date: daysAgo(4) } });
    }
  }

  // Citas: historial completado/cancelado y agenda de los próximos días sin cruces.
  const active = opps.filter((o) => !["CANCELADO", "CONCRETADO", "NUEVO"].includes(o.stage) && !o.deletedAt);
  let slot = 0;
  for (const o of active.slice(0, 26)) {
    slot++;
    const future = slot % 2 === 0;
    const day = future ? (slot % 7) : -(slot % 20) - 1;
    const hour = 10 + (slot % 8);
    const start = day >= 0 ? daysAhead(day, hour) : daysAgo(-day, hour);
    const status = future ? pick(["PROGRAMADA", "CONFIRMADA"]) : pick(["COMPLETADA", "COMPLETADA", "COMPLETADA", "CANCELADA"]);
    await db.appointment.create({ data: { type: pick(["TEST_DRIVE", "TEST_DRIVE", "REUNION", "ENTREGA", "SERVICIO"]) as any, status: status as any, startAt: start, endAt: new Date(start.getTime() + 3600e3), contactId: o.contactId, opportunityId: o.id, sellerId: o.sellerId, branchId: o.branchId, vehicleId: o.vehicleId, notes: future ? "Confirmar por WhatsApp el día anterior" : null, cancelReason: status === "CANCELADA" ? "Cliente no pudo asistir" : null, createdAt: daysAgo(Math.max(1, -day + 2)) } });
  }
  // Una cita de hoy que ya pasó sin cerrar (aviso de cita vencida).
  const o0 = active[0];
  if (o0) await db.appointment.create({ data: { type: "REUNION", status: "PROGRAMADA", startAt: daysAgo(1, 9), endAt: daysAgo(1, 10), contactId: o0.contactId, opportunityId: o0.id, sellerId: o0.sellerId, branchId: o0.branchId } });
  return { stock, opps };
}

async function seedFinance(ctx: Ctx) {
  const [pa, pb] = ctx.partners;
  const mv = async (date: Date, type: string, cat: any, amount: number, description: string, extra: any = {}) => {
    if (date > NOW) return;
    await db.movement.create({ data: { date, type, categoryId: await catId(cat), amount, description, tags: extra.tags ?? [], scope: extra.scope ?? "EMPRESA", partnerId: extra.partnerId ?? null, branchId: extra.branchId ?? null, pozo: !!extra.pozo } });
  };
  const S = ctx.branches.SCL.id, V = ctx.branches.VIN.id;
  await mv(inMonth(-6, 3), "INGRESO", "Aporte de socio", 20_000_000, "Aporte de capital", { partnerId: pa.id });
  await mv(inMonth(-6, 3), "INGRESO", "Aporte de socio", 30_000_000, "Aporte de capital", { partnerId: pb.id });
  for (let k = -6; k <= 0; k++) {
    await mv(inMonth(k, 5, 10), "EGRESO", "Arriendo", 2_800_000, "Arriendo local Providencia", { branchId: S });
    await mv(inMonth(k, 5, 10), "EGRESO", "Arriendo", 1_900_000, "Arriendo local Viña del Mar", { branchId: V });
    await mv(inMonth(k, 10, 12), "EGRESO", "Publicidad", round(int(600, 1100) * 1000), "Campañas Meta Ads y portales", { tags: ["marketing"], partnerId: k % 3 === 0 ? pa.id : null });
    await mv(inMonth(k, 12, 12), "EGRESO", "Servicios básicos", round(int(240, 320) * 1000, 1000), "Luz, agua, internet y telefonía");
    await mv(inMonth(k, 18, 15), "EGRESO", "Gastos generales", round(int(150, 420) * 1000, 1000), pick(["Insumos de oficina", "Mantención de patio", "Seguros de exhibición"]));
    await mv(inMonth(k, 20, 12), "INGRESO", "Otros ingresos", 180_000, "Arriendo de estacionamientos");
    await mv(inMonth(k, 28, 17), "EGRESO", "Fondo de ahorro (pozo)", 500_000, "Aporte mensual al pozo", { pozo: true, tags: ["pozo"] });
    await mv(inMonth(k, 28, 18), "EGRESO", "Sueldos", 7_600_000, "Remuneraciones del mes");
    if (k % 2 === 0) await mv(inMonth(k, 25, 12), "EGRESO", "Retiro de socio", 1_500_000, "Retiro socia", { scope: "SOCIO", partnerId: pa.id });
    await mv(inMonth(k, 22, 12), "EGRESO", "Gastos generales", round(int(200, 450) * 1000, 1000), "Gasto personal del socio (fuera del balance)", { scope: "SOCIO", partnerId: pb.id });
  }
  await db.movement.create({ data: { date: NOW, dueDate: daysAhead(10), isPending: true, type: "INGRESO", categoryId: await catId("Otros ingresos"), amount: 500_000, description: "Bono de marca por cumplimiento (por cobrar)", tags: [] } });
  await db.movement.create({ data: { date: NOW, dueDate: daysAhead(6), isPending: true, type: "EGRESO", categoryId: await catId("Gastos generales"), amount: 350_000, description: "Factura taller de pintura (por pagar)", tags: [], branchId: S } });
}

async function seedTeamAndChannels(ctx: Ctx, opps: any[]) {
  const vendors = ctx.sellers.filter((s) => s.userId);
  for (const s of vendors) {
    for (let d = 1; d <= 8; d++) {
      const date = daysAgo(d);
      if ([0, 6].includes(date.getDay())) continue;
      await db.dailyReport.create({ data: { sellerId: s.id, date: new Date(date.toISOString().slice(0, 10)), status: d === 1 && s.name.startsWith("Mat") ? "BORRADOR" : "ENVIADO", submittedAt: addDays(date, 0), creditsEntered: int(0, 3), publications: int(1, 6), calls: Array.from({ length: int(3, 7) }, () => ({ name: `${pick(D.FIRST)} ${pick(D.LAST)}`, result: pick(["Contestó", "No contesta", "Agendó visita"]), note: pick(D.CALL_NOTES) })), consignmentCalls: rnd() > 0.5 ? [{ car: `${pick(["Kia Rio", "Mazda 3", "Toyota Yaris"])}`, year: int(2015, 2021), price: round(int(6, 14) * 1e6, 100000), note: "Interesado en consignar online", link: "https://portal.example/aviso/12345" }] : [], notes: "Jornada normal, foco en seguimiento." } });
    }
    await db.task.createMany({ data: [
      { title: "Enviar cotización formal", dueAt: daysAhead(0, 17), assignedToId: s.userId, opportunityId: pick(opps.filter((o) => o.sellerId === s.id && !o.closedAt))?.id ?? null },
      { title: "Llamar para confirmar test drive", dueAt: daysAgo(1, 12), assignedToId: s.userId },
    ] });
  }
  const scl = await db.waNumber.create({ data: { phone: "+56912345678", label: "Ventas Santiago", provider: "META", branchId: ctx.branches.SCL.id } });
  const vin = await db.waNumber.create({ data: { phone: "+56987654321", label: "Ventas Viña", provider: "YCLOUD", branchId: ctx.branches.VIN.id } });
  const convs = [
    [scl, "¿Sigue disponible la RAV4? ¿Aceptan auto en parte de pago?", true], [scl, "Hola, quiero agendar test drive para el sábado", true],
    [scl, "¿Cuál es el pie mínimo para financiar?", false], [vin, "Buenas, tengo un Kia Rio 2018 para consignar", false],
    [vin, "¿Tienen camionetas 4x4 diésel?", true], [scl, "Gracias, mañana paso a firmar", true],
  ] as const;
  for (const [i, [num, text, linked]] of convs.entries()) {
    const o = linked ? opps.find((x) => x.branchId === num.branchId && !x.closedAt && !x.deletedAt && !(x as any).used) : null;
    if (o) (o as any).used = true;
    const contact = o ? await db.contact.findUnique({ where: { id: o.contactId } }) : null;
    const seller = o ? await db.seller.findUnique({ where: { id: o.sellerId } }) : null;
    const c = await db.conversation.create({ data: { numberId: num.id, contactPhone: contact?.phone ?? `+569${int(40000000, 99999999)}`, contactName: contact?.name ?? `${pick(D.FIRST)} ${pick(D.LAST)}`, opportunityId: o?.id ?? null, assignedToId: seller?.userId ?? null, unread: i % 3 === 0 ? 2 : 0, lastMessageAt: daysAgo(i % 3, 10 + i) } });
    await db.waMessage.createMany({ data: [
      { conversationId: c.id, direction: "IN", body: text, providerMessageId: `demo-in-${i}-1`, sentAt: daysAgo(i % 3, 9 + i) },
      { conversationId: c.id, direction: "OUT", body: "¡Hola! Gracias por escribir a Stroker. Te respondo enseguida con la información.", providerMessageId: `demo-out-${i}-1`, sentAt: daysAgo(i % 3, 9 + i) },
      { conversationId: c.id, direction: "IN", body: pick(["Perfecto, quedo atento", "¿Me envían más fotos?", "¿Hasta qué hora atienden?"]), providerMessageId: `demo-in-${i}-2`, sentAt: daysAgo(i % 3, 10 + i) },
    ] });
  }
  const accounts = [
    await db.socialAccount.create({ data: { network: "INSTAGRAM", kind: "CORPORATIVA", handle: "@stroker.autos" } }),
    await db.socialAccount.create({ data: { network: "FACEBOOK", kind: "CORPORATIVA", handle: "Automotora Stroker" } }),
    await db.socialAccount.create({ data: { network: "LINKEDIN", kind: "CORPORATIVA", handle: "Stroker SpA" } }),
    await db.socialAccount.create({ data: { network: "INSTAGRAM", kind: "PERSONAL", handle: "@vale.soto.autos", userId: ctx.users["valentina@stroker.demo"].id } }),
  ];
  const vs = await db.vehicle.findMany({ where: { published: true }, take: 6 });
  const st = ["PUBLICADA", "PUBLICADA", "PROGRAMADA", "BORRADOR", "ERROR", "PUBLICADA"];
  for (const [i, v] of vs.entries()) await db.socialPost.create({ data: { accountId: accounts[i % 4].id, vehicleId: v.id, text: `🚗 ${v.brand} ${v.model} ${v.year}, ${v.km.toLocaleString("es-CL")} km. Agenda tu test drive.`, status: st[i], scheduledAt: st[i] === "PROGRAMADA" ? daysAhead(1, 19) : null, publishedAt: st[i] === "PUBLICADA" ? daysAgo(i + 1) : null, error: st[i] === "ERROR" ? "Token expirado: reconectar la cuenta (simulado)" : null } });
}

async function seedWebAndDocs(ctx: Ctx, sales: any[]) {
  const pub = await db.vehicle.findMany({ where: { published: true } });
  const events: any[] = [];
  for (let d = 0; d < 60; d++) {
    const views = int(25, 90);
    for (let i = 0; i < views; i++) {
      const at = daysAgo(d, int(8, 22));
      if (at > NOW) continue;
      const visitor = `v${int(1, 900)}`;
      const v = rnd() > 0.45 ? pick(pub) : null;
      events.push({ type: v ? "VEHICLE_VIEW" : "VIEW", path: v ? `/autos/${v.slug}` : pick(["/", "/autos", "/consignar"]), vehicleId: v?.id ?? null, visitor, createdAt: at });
      if (v && rnd() > 0.92) events.push({ type: "WHATSAPP_CLICK", path: `/autos/${v.slug}`, vehicleId: v.id, visitor, createdAt: at });
    }
  }
  await db.webEvent.createMany({ data: events });
  const webOpps = await db.opportunity.findMany({ where: { source: "WEB", createdAt: { gt: daysAgo(30) } }, include: { contact: true } });
  for (const o of webOpps)
    await db.formSubmission.create({ data: { kind: o.type === "CONSIGNACION" ? "CONSIGNACION" : "CONSULTA", dedupeHash: `seed-${o.id}`, payload: { name: o.contact.name }, opportunityId: o.id, createdAt: o.createdAt } });
  for (const s of sales.filter((x) => x.k >= -1).slice(-4)) {
    const doc = await createDocument("VENTA", { saleId: s.sale.id }, ctx.admin);
    await emitDocument(doc.id, ctx.admin);
  }
  const cons = await db.consignment.findFirst({ where: { status: "VIGENTE" } });
  if (cons) { const d = await createDocument("CONSIGNACION", { consignmentId: cons.id }, ctx.admin); await emitDocument(d.id, ctx.admin); }
  const res = await db.reservation.findFirst({ where: { status: "ACTIVA" } });
  if (res) await createDocument("RESERVA", { reservationId: res.id }, ctx.admin);
}

export async function seedHistory(ctx: Ctx) {
  console.log("Ventas históricas…");
  const sales = await seedSales(ctx);
  await seedSpecialCases(ctx, sales);
  console.log("Consignaciones…");
  await seedConsignments(ctx);
  console.log("Inventario, pipeline y citas…");
  const { opps } = await seedStockAndPipeline(ctx);
  console.log("Finanzas…");
  await seedFinance(ctx);
  await seedTeamAndChannels(ctx, opps);
  console.log("Web y documentos…");
  await seedWebAndDocs(ctx, sales);
  const { secret } = await createApiKey("n8n Santiago (demo)", ctx.branches.SCL.id, ["leads:write", "appointments:write"], ctx.admin);
  console.log(`\nClave API demo para n8n (Santiago), se muestra una sola vez:\n  ${secret}\n`);
  console.log(`Acceso: dueno@stroker.demo / ${D.PASSWORD} (ver README para otros roles)`);
}
