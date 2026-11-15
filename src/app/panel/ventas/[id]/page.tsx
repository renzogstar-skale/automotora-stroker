import Link from "next/link";
import { notFound } from "next/navigation";
import { randomUUID } from "node:crypto";
import { FileSignature } from "lucide-react";
import { guard } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, branchScope } from "@/lib/rbac";
import { clp, date, dateTime, ymd } from "@/lib/format";
import { DELIVERY, PAY_LABEL, PAYMENT_METHODS } from "@/lib/labels";
import { econ, saleInclude } from "@/server/economics";
import { Badge, Card, Field, Notice, PageHeader, StatusBadge, Table } from "@/components/ui";
import { ActionForm, InlineAction, Submit } from "@/components/client/forms";
import { annulAction, deliveryAction, paymentAction, reversePaymentAction } from "../actions";

export default async function SaleDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ back?: string }> }) {
  const a = await guard("sales");
  const { id } = await params;
  // Vuelve a la vista de origen con sus filtros (solo rutas internas del panel).
  const backRaw = (await searchParams).back;
  const back = backRaw?.startsWith("/panel") && !backRaw.startsWith("//") ? backRaw : "/panel/ventas";
  const s = await db.sale.findUnique({ where: { id }, include: saleInclude });
  const [docs, opp] = s ? await Promise.all([db.document.findMany({ where: { saleId: id } }), s.opportunityId ? db.opportunity.findUnique({ where: { id: s.opportunityId }, select: { id: true } }) : null]) : [[], null];
  const bs = branchScope(a);
  if (!s || (bs && !bs.includes(s.branchId)) || (a.role === "VENDEDOR" && s.sellerId !== a.sellerId)) notFound();
  const e = econ(s);
  const history = await db.auditLog.findMany({ where: { entityId: { in: [s.id, ...s.payments.map((p) => p.id)] } }, orderBy: { createdAt: "desc" }, take: 50 });
  const showCost = can(a, "inventory.cost");
  const row = (label: string, v: number, kind: "in" | "calc", strong?: boolean) => (
    <tr><td className={strong ? "font-semibold" : ""}>{label} <span className="text-[10px] uppercase text-muted">{kind === "in" ? "ingresado" : "calculado"}</span></td><td className={`num ${strong ? "font-semibold" : ""}`}>{clp(v)}</td></tr>
  );
  return (
    <>
      <PageHeader title={`Venta #${s.number}`} desc={<>{date(s.saleDate)} · {s.contact.name} · {s.vehicle.brand} {s.vehicle.model} {s.vehicle.plate} · {s.seller.name} · {s.branch.name}</>}
        actions={<>
          <Link className="btn btn-ghost" href={back}>← Volver</Link>
          {s.status === "ANULADA" ? <Badge tone="red">Anulada</Badge> : <Badge tone="green">Confirmada</Badge>}
          <StatusBadge map={DELIVERY} value={s.delivery} />
          {can(a, "documents") && <Link className="btn" href={`/panel/documentos?nuevo=1&sale=${s.id}`}><FileSignature className="size-4" />Nota de venta</Link>}
        </>} />
      {s.status === "ANULADA" && <div className="mb-4"><Notice tone="red">Anulada el {dateTime(s.annulledAt)}: {s.annulReason}. Los cobros se reversaron como devoluciones y la unidad volvió a disponible.</Notice></div>}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Cobros" sub={`Precio final ${clp(s.finalPrice)} − cobrado ${clp(e.paid)} = saldo ${clp(e.balance)}${e.pendingFinance ? ` (incluye ${clp(e.pendingFinance)} a cobrar a la financiera)` : ""}${s.balanceDueAt ? ` · vence ${date(s.balanceDueAt)}` : ""}`} bodyClass="p-0">
            <Table><thead><tr><th>Fecha</th><th>Medio</th><th className="num">Monto</th><th>Estado</th><th /></tr></thead><tbody>
              {s.payments.length === 0 && <tr><td colSpan={5} className="text-center text-muted">Sin cobros registrados</td></tr>}
              {s.payments.map((p) => (
                <tr key={p.id} className={p.status === "REVERSADO" ? "opacity-60" : ""}>
                  <td>{date(p.paidAt)}</td><td>{p.method}{p.reservationId && <span className="text-xs text-muted"> (abono de reserva)</span>}</td><td className="num">{clp(p.amount)}</td>
                  <td>{p.status === "REVERSADO" ? <Badge tone="red">Reversado</Badge> : <Badge tone="green">Registrado</Badge>}{p.reverseReason && <div className="text-[11px] text-muted">{p.reverseReason}</div>}</td>
                  <td className="text-right">{p.status === "REGISTRADO" && can(a, "payments") && s.status === "CONFIRMADA" && <InlineAction action={reversePaymentAction} fields={{ id: p.id }} reasonLabel="Motivo" label="Reversar" className="btn btn-sm btn-danger" />}</td>
                </tr>))}
            </tbody></Table>
            {can(a, "payments") && s.status === "CONFIRMADA" && e.balance > 0 && (
              <ActionForm action={paymentAction} className="grid gap-2 space-y-0 border-t border-line p-3 sm:grid-cols-4">
                <input type="hidden" name="saleId" value={s.id} /><input type="hidden" name="key" value={randomUUID()} />
                <Field label="Monto"><input name="amount" inputMode="numeric" defaultValue={e.balance} className="input" /></Field>
                <Field label="Medio"><select name="method" className="input">{PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}</select></Field>
                <Field label="Fecha de pago"><input type="date" name="paidAt" defaultValue={ymd(new Date())} className="input" /></Field>
                <div className="flex items-end"><Submit className="btn btn-dark w-full">Registrar cobro</Submit></div>
                <p className="text-[11px] text-muted sm:col-span-4">Cada formulario lleva una clave única: si el envío se repite, el cobro no se duplica.</p>
              </ActionForm>
            )}
          </Card>
          {showCost && (
            <Card title="Comisiones y repartos aplicados" sub="Snapshot de las reglas vigentes al cierre, con la base usada en cada una" bodyClass="p-0">
              <Table><thead><tr><th>Orden</th><th>Tipo</th><th>Beneficiario</th><th>Regla</th><th>Base</th><th className="num">Monto base</th><th className="num">Monto</th></tr></thead><tbody>
                {s.commissions.map((c) => { const r = c.rule as { name: string; kind: string; value: number; beneficiary: string }; return <tr key={c.id}><td>{c.order}</td><td>{["GERENCIA", "SOCIO"].includes(r.beneficiary) ? "Reparto" : "Comisión"}</td><td>{c.beneficiary}</td><td>{r.name} · {r.kind === "FIJO" ? clp(r.value) : `${r.value}%`}</td><td className="text-xs text-muted">{c.baseLabel}</td><td className="num">{c.baseAmount ? clp(c.baseAmount) : "—"}</td><td className="num">{clp(c.amount)}</td></tr>; })}
              </tbody></Table>
            </Card>
          )}
        </div>
        <div className="space-y-4">
          <Card title="Operación" bodyClass="p-0">
            <Table><tbody>
              {row("Precio de lista", s.listPrice, "in")}{row("Descuento", -s.discount, "in")}{row("Precio final", s.finalPrice, "calc", true)}
              {showCost && <>{row(s.ownership === "PROPIO" ? "Costo de adquisición" : "Monto a liquidar al propietario", -s.costBasis, "in")}
              {row("Ingresos adicionales", s.extraIncome, "in")}{row("Margen antes de gastos directos", e.margin, "calc", true)}
              {row("Preparación", -e.prep, "in")}{row("Gastos directos de venta", -e.directOnly, "in")}{row("Comisiones (vendedor / captador)", -e.sellerComm, "calc")}{row("Reparto (gerencia / socios)", -e.split, "calc")}
              {row("Utilidad final", e.profit, "calc", true)}</>}
            </tbody></Table>
            <p className="px-4 py-2 text-xs text-muted">Pago: {PAY_LABEL[s.payMethod]}{s.financedAmount ? ` · financiado ${clp(s.financedAmount)}` : ""}{s.tradeInValue ? ` · parte de pago ${clp(s.tradeInValue)}` : ""}{s.referredBy ? ` · referido: ${s.referredBy}` : ""}</p>
          </Card>
          {s.status === "CONFIRMADA" && can(a, "sales.edit") && s.delivery !== "ENTREGADA" && (
            <Card title="Entrega"><div className="flex flex-wrap gap-2">
              {s.delivery === "PENDIENTE" && <InlineAction action={deliveryAction} fields={{ id: s.id, status: "PROGRAMADA" }} label="Marcar programada" />}
              <InlineAction action={deliveryAction} fields={{ id: s.id, status: "ENTREGADA" }} label="Registrar entrega" className="btn btn-sm btn-dark" />
              <Link href={`/panel/citas?nueva=1${s.opportunityId ? `&opp=${s.opportunityId}` : ""}`} className="btn btn-sm">Agendar entrega</Link>
            </div>{e.balance > 0 && <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-400">Aún hay saldo pendiente por {clp(e.balance)}.</p>}</Card>
          )}
          {s.delivery === "ENTREGADA" && <Card title="Entrega"><p className="text-sm">Entregado el {dateTime(s.deliveredAt)}</p></Card>}
          {s.bookEntry && <Card title="Libro de Ventas"><p className="text-sm">Asiento <b>L-{String(s.bookEntry.number).padStart(5, "0")}</b> · {date(s.bookEntry.entryDate)} · {s.bookEntry.status === "ANULADO" ? <Badge tone="red">Anulado</Badge> : <Badge tone="green">Vigente</Badge>}</p>{showCost && <Link className="link text-xs" href="/panel/finanzas/libro">Ver Libro</Link>}</Card>}
          <Card title="Historial" sub="Confirmación, cobros, reversos, entrega y anulación" bodyClass="p-0">
            <ul className="max-h-80 overflow-y-auto">{history.map((h) => <li key={h.id} className="border-b border-line px-4 py-2 text-xs last:border-0"><span className="text-muted">{dateTime(h.createdAt)}</span> · {h.summary}</li>)}</ul>
          </Card>
          {docs.length > 0 && <Card title="Documentos" bodyClass="p-0"><ul>{docs.map((d) => <li key={d.id} className="border-b border-line px-4 py-2 text-sm last:border-0"><Link className="link" href={`/panel/documentos/${d.id}`}>{d.folio}</Link> · {d.status.toLowerCase()}</li>)}</ul></Card>}
          {opp && <Link className="btn w-full" href={`/panel/crm/${opp.id}`}>Ver oportunidad</Link>}
          {s.status === "CONFIRMADA" && can(a, "payments") && <Card title="Anular venta"><InlineAction action={annulAction} fields={{ id: s.id }} reasonLabel="Motivo" label="Anular" className="btn btn-sm btn-danger" confirm /><p className="mt-1 text-[11px] text-muted">Reversa los cobros como devoluciones, libera la unidad y devuelve la oportunidad a Negociando. Se conserva el historial.</p></Card>}
        </div>
      </div>
    </>
  );
}
