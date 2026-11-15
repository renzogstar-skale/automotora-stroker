import { randomUUID } from "node:crypto";
import { guard } from "@/lib/auth";
import { db } from "@/lib/db";
import { branchScope, oppScope } from "@/lib/rbac";
import { PAY_LABEL, PAYMENT_METHODS } from "@/lib/labels";
import { clp } from "@/lib/format";
import { Card, Field, Notice, PageHeader } from "@/components/ui";
import { ActionForm, Submit } from "@/components/client/forms";
import { confirmSaleAction } from "../actions";

export default async function NewSale({ searchParams }: { searchParams: Promise<{ vehicle?: string; opp?: string; appraisal?: string }> }) {
  const a = await guard("sales.edit");
  const s = await searchParams;
  const bs = branchScope(a);
  const [vehicles, opps, sellers, appraisals] = await Promise.all([
    db.vehicle.findMany({ where: { status: { in: ["DISPONIBLE", "RESERVADO"] }, ...(bs ? { branchId: { in: bs } } : {}) }, include: { reservations: { where: { status: "ACTIVA" }, include: { contact: true } } }, orderBy: { brand: "asc" } }),
    db.opportunity.findMany({ where: { ...oppScope(a), deletedAt: null, closedAt: null }, include: { contact: true }, orderBy: { createdAt: "desc" }, take: 300 }),
    a.role === "VENDEDOR" ? [] : db.seller.findMany({ where: { active: true, ...(bs ? { branchId: { in: bs } } : {}) } }),
    db.appraisal.findMany({ where: { vehicleId: null, consignment: null }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  const v = vehicles.find((x) => x.id === s.vehicle);
  const ap = appraisals.find((x) => x.id === s.appraisal);
  return (
    <>
      <PageHeader title="Confirmar venta" desc="Actualiza vehículo, reserva, oportunidad, publicación, Libro de Ventas y comisiones en una sola operación." />
      {v?.reservations[0] && <div className="mb-3"><Notice>Reservado para {v.reservations[0].contact.name}: el abono de {clp(v.reservations[0].amount)} se imputará al precio.</Notice></div>}
      <Card>
        <ActionForm action={confirmSaleAction} className="grid gap-3 space-y-0 sm:grid-cols-2 lg:grid-cols-4">
          <input type="hidden" name="key" value={randomUUID()} />
          <Field label="Vehículo *" className="sm:col-span-2"><select name="vehicleId" required defaultValue={s.vehicle ?? ""} className="input"><option value="">Selecciona…</option>{vehicles.map((x) => <option key={x.id} value={x.id}>{x.brand} {x.model} {x.year} · {x.plate} · {clp(x.price)}{x.reservations[0] ? ` · reservado: ${x.reservations[0].contact.name}` : ""}</option>)}</select></Field>
          <Field label="Cliente / oportunidad *" className="sm:col-span-2"><select name="opportunityId" required defaultValue={s.opp ?? ""} className="input"><option value="">Selecciona…</option>{opps.map((o) => <option key={o.id} value={o.id}>{o.contact.name} · {o.contact.phone}</option>)}</select></Field>
          {sellers.length > 0 && <Field label="Vendedor"><select name="sellerId" className="input"><option value="">El de la oportunidad</option>{sellers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>}
          <Field label="Descuento (CLP)"><input name="discount" inputMode="numeric" defaultValue={0} className="input" /></Field>
          <Field label="Forma de pago"><select name="payMethod" className="input">{Object.entries(PAY_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
          <Field label="Monto financiado (CLP)" hint="Pagado por la financiera"><input name="financed" inputMode="numeric" defaultValue={0} className="input" /></Field>
          <Field label="Ganancia por crédito (CLP)" hint="Comisión de la financiera"><input name="creditIncome" inputMode="numeric" defaultValue={0} className="input" /></Field>
          <Field label="Otros ingresos adicionales" hint="Transferencia, accesorios…"><input name="extraIncome" inputMode="numeric" defaultValue={0} className="input" /></Field>
          <Field label="Anticipo hoy (CLP)" hint="Además del abono de reserva, que ya se imputa"><input name="downPayment" inputMode="numeric" defaultValue={0} className="input" /></Field>
          <Field label="Medio del anticipo"><select name="downMethod" className="input">{PAYMENT_METHODS.filter((m) => m !== "Parte de pago").map((m) => <option key={m}>{m}</option>)}</select></Field>
          <Field label="Vencimiento del saldo"><input type="date" name="balanceDueAt" className="input" /></Field>
          <Field label="Referido por"><input name="referredBy" className="input" /></Field>
          <fieldset className="grid gap-3 rounded-lg border border-line p-3 sm:col-span-2 sm:grid-cols-3 lg:col-span-4 lg:grid-cols-7">
            <legend className="px-1 text-xs font-medium text-muted">Auto en parte de pago (opcional)</legend>
            <Field label="Tasación vinculada"><select name="appraisalId" defaultValue={ap?.id ?? ""} className="input"><option value="">—</option>{appraisals.map((x) => <option key={x.id} value={x.id}>{x.plate} · {x.brand} {x.model} · {clp(x.suggested)}</option>)}</select></Field>
            <Field label="Valor aceptado"><input name="tiValue" inputMode="numeric" defaultValue={ap?.suggested} className="input" /></Field>
            <Field label="Patente"><input name="tiPlate" defaultValue={ap?.plate} className="input uppercase" /></Field>
            <Field label="Marca"><input name="tiBrand" defaultValue={ap?.brand} className="input" /></Field>
            <Field label="Modelo"><input name="tiModel" defaultValue={ap?.model} className="input" /></Field>
            <Field label="Año"><input name="tiYear" type="number" defaultValue={ap?.year} className="input" /></Field>
            <Field label="Km"><input name="tiKm" inputMode="numeric" defaultValue={ap?.km} className="input" /></Field>
          </fieldset>
          <div className="flex justify-end sm:col-span-2 lg:col-span-4"><Submit pendingText="Confirmando…">Confirmar venta</Submit></div>
        </ActionForm>
      </Card>
    </>
  );
}
