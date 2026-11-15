import { Prisma, type PayMethod } from "@prisma/client";
import { db, type Tx } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assert, assertBranch, type Actor } from "@/lib/rbac";
import { AppError, conflict, notFound } from "./errors";
import { changeStage } from "./crm";
import { registerPayment, reversePayment } from "./payments";
import { createVehicle } from "./inventory";
import { signed } from "./categories";

export type SaleInput = {
  vehicleId: string; opportunityId?: string | null; contactId?: string | null; sellerId?: string | null;
  discount?: number; payMethod: PayMethod; financedAmount?: number; extraIncome?: number; creditIncome?: number;
  saleDate?: Date; balanceDueAt?: Date | null; referredBy?: string | null;
  /** Clave única del formulario: un reintento devuelve la venta ya confirmada. */
  idempotencyKey?: string;
  /** Anticipo cobrado al confirmar (además del abono de reserva, que se imputa sin volver a cobrarse). */
  downPayment?: { amount: number; method: string } | null;
  tradeIn?: { value: number; plate: string; brand: string; model: string; version?: string; year: number; km: number; appraisalId?: string | null } | null;
};

const BASE_LABEL: Record<string, string> = {
  PRECIO_VENTA: "Precio final de venta",
  MARGEN_BRUTO: "Margen bruto (precio − costo base + adicionales)",
  UTILIDAD_RESTANTE: "Utilidad después de gastos directos y comisiones de orden anterior",
};

/** Aplica reglas vigentes en orden; las de igual orden comparten base. Se guarda un snapshot de cada regla. */
export async function computeCommissions(t: Tx, saleId: string) {
  const s = await t.sale.findUniqueOrThrow({ where: { id: saleId }, include: { vehicle: { include: { consignment: true, movements: { include: { category: true } } } } } });
  const kind = s.ownership === "PROPIO" ? "PROPIA" : s.consModality === "ONLINE" ? "CONSIGNACION_ONLINE" : "CONSIGNACION_FISICA";
  const rules = await t.commissionRule.findMany({
    where: { active: true, validFrom: { lte: s.saleDate }, OR: [{ validTo: null }, { validTo: { gte: s.saleDate } }], appliesTo: { in: ["TODAS", kind] } },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
  const prep = -s.vehicle.movements.filter((m) => m.category.name === "Preparación de vehículo").reduce((a, m) => a + signed(m), 0);
  const margin = s.finalPrice - s.costBasis + s.extraIncome;
  let accPrev = 0, levelAcc = 0, level = -1;
  for (const r of rules) {
    if (r.order !== level) { accPrev += levelAcc; levelAcc = 0; level = r.order; }
    const baseAmount = r.base === "PRECIO_VENTA" ? s.finalPrice : r.base === "MARGEN_BRUTO" ? margin : Math.max(0, margin - prep - accPrev);
    const amount = r.kind === "FIJO" ? Math.round(r.value) : Math.round((baseAmount * r.value) / 100);
    const sellerId = r.beneficiary === "VENDEDOR" ? s.sellerId : r.beneficiary === "CAPTADOR" ? s.vehicle.consignment?.responsibleId ?? null : null;
    await t.saleCommission.create({
      data: {
        saleId, ruleId: r.id, rule: JSON.parse(JSON.stringify(r)), beneficiary: r.beneficiaryName ?? r.beneficiary, sellerId,
        baseLabel: r.kind === "FIJO" ? "Monto fijo" : BASE_LABEL[r.base], baseAmount: r.kind === "FIJO" ? 0 : baseAmount, amount, order: r.order,
      },
    });
    levelAcc += amount;
  }
}

/** Confirma la venta y actualiza de forma consistente vehículo, reserva, oportunidad, consignación, publicación y comisiones. */
export async function confirmSale(i: SaleInput, actor: Actor) {
  assert(actor, "sales.edit");
  const byKey = () => (i.idempotencyKey ? db.sale.findUnique({ where: { idempotencyKey: i.idempotencyKey } }) : null);
  const prior = await byKey();
  if (prior) return withDownPayment(prior, i, actor);
  let sale;
  try {
    sale = await confirmTx(i, actor);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const again = await byKey();
      if (again) return withDownPayment(again, i, actor);
      throw conflict("La unidad ya fue vendida.");
    }
    throw e;
  }
  return withDownPayment(sale, i, actor);
}

/** El anticipo usa una clave derivada de la venta: reintentar no lo cobra dos veces. */
async function withDownPayment<S extends { id: string; saleDate: Date }>(sale: S, i: SaleInput, actor: Actor) {
  if (i.downPayment && i.downPayment.amount > 0)
    await registerPayment({ saleId: sale.id, amount: i.downPayment.amount, method: i.downPayment.method, paidAt: sale.saleDate, idempotencyKey: `anticipo-${i.idempotencyKey ?? sale.id}`, downPayment: true }, actor);
  return sale;
}

async function confirmTx(i: SaleInput, actor: Actor) {
  return db.$transaction(async (t) => {
    const v = await t.vehicle.findUnique({ where: { id: i.vehicleId }, include: { consignment: true } });
    if (!v) throw notFound("Vehículo no encontrado.");
    assertBranch(actor, v.branchId);
    const opp = i.opportunityId ? await t.opportunity.findUnique({ where: { id: i.opportunityId } }) : null;
    const contactId = opp?.contactId ?? i.contactId;
    if (!contactId) throw new AppError("Selecciona el cliente o la oportunidad.");
    const activeRes = await t.reservation.findFirst({ where: { vehicleId: v.id, status: "ACTIVA" } });
    if (activeRes && activeRes.contactId !== contactId) throw conflict("La unidad está reservada para otro cliente.");
    const lock = await t.vehicle.updateMany({ where: { id: v.id, status: { in: ["DISPONIBLE", "RESERVADO"] } }, data: { status: "VENDIDO", published: false } });
    if (!lock.count) throw conflict("La unidad ya fue vendida o retirada.");
    const discount = i.discount ?? 0;
    if (discount < 0 || discount >= v.price) throw new AppError("Descuento inválido.");
    const finalPrice = v.price - discount;
    const resPaid = activeRes ? (await t.payment.aggregate({ where: { reservationId: activeRes.id, status: "REGISTRADO" }, _sum: { amount: true } }))._sum.amount ?? 0 : 0;
    const committed = (i.financedAmount ?? 0) + (i.tradeIn?.value ?? 0) + resPaid + (i.downPayment?.amount ?? 0);
    if ((i.financedAmount ?? 0) < 0 || committed > finalPrice) throw new AppError(`Financiamiento + parte de pago + reserva + anticipo (${committed}) superan el precio final (${finalPrice}).`);
    if (i.payMethod === "FINANCIAMIENTO" && !(i.financedAmount! > 0)) throw new AppError("Indica el monto financiado.");
    const sellerId = i.sellerId ?? opp?.sellerId ?? actor.sellerId;
    if (!sellerId) throw new AppError("Asigna un vendedor.");
    const sale = await t.sale.create({
      data: {
        vehicleId: v.id, opportunityId: opp?.id ?? null, contactId, sellerId, branchId: v.branchId, ownership: v.ownership,
        consModality: v.consignment?.modality ?? null, listPrice: v.price, discount, finalPrice,
        costBasis: v.ownership === "PROPIO" ? v.cost : v.consignment?.agreedPrice ?? v.cost,
        extraIncome: i.extraIncome ?? 0, creditIncome: i.creditIncome ?? 0, payMethod: i.payMethod, financedAmount: i.financedAmount ?? 0,
        tradeInValue: i.tradeIn?.value ?? 0, saleDate: i.saleDate ?? new Date(), balanceDueAt: i.balanceDueAt ?? null, referredBy: i.referredBy || null,
        idempotencyKey: i.idempotencyKey || null,
      },
      include: { contact: true, seller: true, branch: true },
    });
    if (activeRes) {
      await t.reservation.update({ where: { id: activeRes.id }, data: { status: "CONVERTIDA", saleId: sale.id, endedAt: new Date(), endReason: "Venta confirmada" } });
      // La reserva imputada al precio disminuye el saldo pendiente: sus pagos pasan a la venta.
      await t.payment.updateMany({ where: { reservationId: activeRes.id }, data: { saleId: sale.id } });
      await t.movement.updateMany({ where: { payment: { reservationId: activeRes.id } }, data: { saleId: sale.id } });
    }
    if (opp && opp.stage !== "CONCRETADO") await changeStage(opp.id, "CONCRETADO", actor, `Venta #${sale.number}`, t);
    if (v.consignment) await t.consignment.update({ where: { id: v.consignment.id }, data: { status: "VENDIDA" } });
    if (i.tradeIn && i.tradeIn.value > 0) {
      const tv = await createVehicle({
        branchId: v.branchId, brand: i.tradeIn.brand, model: i.tradeIn.model, version: i.tradeIn.version ?? "", year: i.tradeIn.year, plate: i.tradeIn.plate,
        km: i.tradeIn.km, transmission: "Manual", fuel: "Bencina", bodyType: "SUV", color: "Por definir", condition: "USADO",
        price: Math.round((i.tradeIn.value * 1.15) / 10000) * 10000, cost: i.tradeIn.value, description: `Recibido en parte de pago (venta #${sale.number}).`,
      }, null, t);
      if (i.tradeIn.appraisalId) await t.appraisal.update({ where: { id: i.tradeIn.appraisalId }, data: { vehicleId: tv.id } });
      await t.payment.create({ data: { saleId: sale.id, amount: i.tradeIn.value, method: "Parte de pago", paidAt: sale.saleDate, idempotencyKey: `tradein-${sale.id}` } });
    }
    await computeCommissions(t, sale.id);
    await t.salesBookEntry.create({
      data: {
        saleId: sale.id, entryDate: sale.saleDate,
        snapshot: {
          cliente: sale.contact.name, rut: sale.contact.rut, vehiculo: `${v.brand} ${v.model} ${v.version} ${v.year}`.replace(/\s+/g, " "), patente: v.plate,
          tipo: v.ownership === "PROPIO" ? "Propio" : `Consignado ${v.consignment?.modality === "ONLINE" ? "online" : "físico"}`,
          vendedor: sale.seller.name, sucursal: sale.branch.name, precioLista: sale.listPrice, descuento: sale.discount, precioFinal: sale.finalPrice,
          costoBase: sale.costBasis, costoBaseLabel: v.ownership === "PROPIO" ? "Costo de adquisición" : "Monto a liquidar al propietario",
          ingresosAdicionales: sale.extraIncome, formaPago: sale.payMethod, financiado: sale.financedAmount, parteDePago: sale.tradeInValue,
          abonoReserva: resPaid, anticipo: i.downPayment?.amount ?? 0, publicadoAlCierre: v.published,
        },
      },
    });
    await audit(actor, "sale.confirm", "Sale", sale.id, `Venta #${sale.number} ${v.plate} por ${sale.finalPrice}`, { vehicleId: v.id, unpublished: v.published }, t);
    if (v.published) await audit(actor, "vehicle.unpublish", "Vehicle", v.id, `Despublicado automáticamente por venta #${sale.number}`, undefined, t);
    return sale;
  });
}

/** Anulación: conserva la venta (ANULADA), reversa los cobros como devoluciones y libera la unidad. */
export async function annulSale(id: string, reason: string, actor: Actor) {
  assert(actor, "payments");
  if (!reason.trim()) throw new AppError("Indica el motivo de anulación.");
  const s = await db.sale.findUnique({ where: { id }, include: { payments: true, vehicle: { include: { consignment: true } } } });
  if (!s) throw notFound();
  assertBranch(actor, s.branchId);
  await db.$transaction(async (t) => {
    const u = await t.sale.updateMany({ where: { id, status: "CONFIRMADA" }, data: { status: "ANULADA", annulledAt: new Date(), annulReason: reason } });
    if (!u.count) throw conflict("La venta ya está anulada.");
    for (const p of s.payments.filter((x) => x.status === "REGISTRADO")) await reversePayment(p.id, `Anulación venta #${s.number}`, actor, true, t);
    await t.salesBookEntry.updateMany({ where: { saleId: id }, data: { status: "ANULADO", annulledAt: new Date(), annulReason: reason } });
    await t.vehicle.update({ where: { id: s.vehicleId }, data: { status: "DISPONIBLE" } });
    if (s.vehicle.consignment) await t.consignment.update({ where: { id: s.vehicle.consignment.id }, data: { status: "VIGENTE" } });
    if (s.opportunityId) await changeStage(s.opportunityId, "NEGOCIANDO", actor, `Venta #${s.number} anulada`, t);
    await audit(actor, "sale.annul", "Sale", id, `Venta #${s.number} anulada: ${reason}`, undefined, t);
  });
}

export async function setDelivery(id: string, status: "PROGRAMADA" | "ENTREGADA", actor: Actor) {
  assert(actor, "sales.edit");
  const s = await db.sale.findUnique({ where: { id } });
  if (!s) throw notFound();
  assertBranch(actor, s.branchId);
  if (s.status === "ANULADA") throw conflict("Venta anulada.");
  await db.sale.update({ where: { id }, data: { delivery: status, deliveredAt: status === "ENTREGADA" ? new Date() : null } });
  await audit(actor, "sale.delivery", "Sale", id, status === "ENTREGADA" ? "Vehículo entregado" : "Entrega programada");
}
