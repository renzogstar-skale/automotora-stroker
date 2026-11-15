import Link from "next/link";
import { notFound } from "next/navigation";
import { randomUUID } from "node:crypto";
import { guard } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, branchScope } from "@/lib/rbac";
import { CONS_STATUS } from "@/lib/labels";
import { clp, date } from "@/lib/format";
import { Card, Field, PageHeader, StatusBadge, Table } from "@/components/ui";
import { ActionForm, InlineAction, Submit } from "@/components/client/forms";
import { closeConsignmentAction, docsAction, payoutAction, retireConsignmentAction } from "../actions";

const DOCS = [["padron", "Padrón"], ["permiso", "Permiso de circulación"], ["revision", "Revisión técnica"], ["mandato", "Mandato de venta"], ["poder", "Poder notarial"]];
export default async function Consignment({ params }: { params: Promise<{ id: string }> }) {
  const a = await guard("consignments");
  const { id } = await params;
  const c = await db.consignment.findUnique({ where: { id }, include: { owner: true, responsible: true, appraisal: true, payouts: { orderBy: { paidAt: "asc" } }, vehicle: { include: { branch: true } } } });
  const sale = c ? await db.sale.findFirst({ where: { vehicleId: c.vehicleId, status: "CONFIRMADA" }, include: { contact: true } }) : null;
  const bs = branchScope(a);
  if (!c || (bs && !bs.includes(c.vehicle.branchId))) notFound();

  const due = sale?.costBasis ?? 0, paid = c.payouts.reduce((t, p) => t + p.amount, 0), pending = due - paid;
  const docs = c.documents as Record<string, boolean>;
  return (
    <>
      <PageHeader title={`Consignación · ${c.vehicle.brand} ${c.vehicle.model} ${c.vehicle.year}`} desc={`${c.vehicle.plate} · propietario ${c.owner.name} · ${c.modality === "FISICA" ? "física" : "online"} · ${c.vehicle.branch.name}`}
        actions={<><StatusBadge map={CONS_STATUS} value={c.status} /><Link className="btn" href={`/panel/inventario/${c.vehicleId}`}>Ficha del vehículo</Link><Link className="btn" href={`/panel/albumes/${c.vehicleId}`}>Fotos</Link><Link className="btn" href={`/panel/documentos?nuevo=1&consignment=${c.id}`}>Contrato</Link></>} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Acuerdo">
          <dl className="grid grid-cols-2 gap-y-1 text-sm">
            <dt className="text-muted">Precio publicado</dt><dd className="num">{clp(c.vehicle.price)}</dd>
            <dt className="text-muted">Acordado al propietario</dt><dd className="num">{clp(c.agreedPrice)}</dd>
            <dt className="text-muted">Comisión estimada</dt><dd className="num">{clp(c.vehicle.price - c.agreedPrice)}</dd>
            <dt className="text-muted">Vigencia</dt><dd className="num">{date(c.startDate)} → {date(c.endDate)}</dd>
            <dt className="text-muted">Responsable</dt><dd className="text-right">{c.responsible?.name ?? "—"}</dd>
            <dt className="text-muted">Contacto</dt><dd className="text-right">{c.owner.phone}</dd>
          </dl>
          {c.appraisal && <p className="mt-2 text-xs text-muted">Tasación: {clp(c.appraisal.minValue)} – {clp(c.appraisal.maxValue)} · {c.appraisal.source}</p>}
        </Card>
        <Card title="Documentos del propietario">
          <ActionForm action={docsAction}>
            <input type="hidden" name="id" value={c.id} />
            <div className="space-y-1.5 text-sm">{DOCS.map(([k, l]) => <label key={k} className="flex items-center gap-2"><input type="checkbox" name={`doc_${k}`} defaultChecked={!!docs[k]} />{l}</label>)}</div>
            <Submit className="btn btn-sm">Guardar</Submit>
          </ActionForm>
        </Card>
        <Card title="Liquidación al propietario">
          {!sale ? <p className="text-sm text-muted">Se habilita cuando la venta esté confirmada.</p> : (
            <>
              <p className="text-sm">Vendido a {sale.contact.name} el {date(sale.saleDate)} por {clp(sale.finalPrice)}.</p>
              <dl className="my-2 grid grid-cols-2 gap-y-1 text-sm"><dt className="text-muted">A liquidar</dt><dd className="num">{clp(due)}</dd><dt className="text-muted">Pagado</dt><dd className="num">{clp(paid)}</dd><dt className="font-medium">Saldo pendiente</dt><dd className="num font-semibold">{clp(pending)}</dd></dl>
              {pending > 0 && can(a, "payments") && (
                <ActionForm action={payoutAction} className="flex gap-2 space-y-0">
                  <input type="hidden" name="id" value={c.id} /><input type="hidden" name="key" value={randomUUID()} />
                  <Field label="Monto" className="flex-1"><input name="amount" inputMode="numeric" defaultValue={pending} className="input" /></Field>
                  <div className="flex items-end"><Submit className="btn btn-dark">Pagar</Submit></div>
                </ActionForm>
              )}
            </>
          )}
        </Card>
      </div>
      {c.payouts.length > 0 && <Card title="Pagos al propietario" className="mt-4" bodyClass="p-0"><Table><tbody>{c.payouts.map((p) => <tr key={p.id}><td>{date(p.paidAt)}</td><td className="num">{clp(p.amount)}</td></tr>)}</tbody></Table></Card>}
      <div className="mt-4 flex flex-wrap gap-3">
        {c.status === "VIGENTE" && <InlineAction action={retireConsignmentAction} fields={{ id: c.id }} reasonLabel="Motivo del retiro" label="Retirar consignación" className="btn btn-sm btn-danger" confirm />}
        {["VENDIDA", "RETIRADA"].includes(c.status) && <InlineAction action={closeConsignmentAction} fields={{ id: c.id }} label="Cerrar consignación" className="btn btn-sm" />}
      </div>
    </>
  );
}
