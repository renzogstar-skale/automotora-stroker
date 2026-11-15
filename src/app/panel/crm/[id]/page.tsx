import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarPlus, Calculator, FileSignature, MessageCircle, Phone, ShoppingCart } from "lucide-react";
import { guard } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { STAGES, STAGE_LABEL, STAGE_TONE, SOURCE_LABEL, OPP_TYPE_LABEL, APPT_TYPE, APPT_STATUS, RES_STATUS, PAY_LABEL } from "@/lib/labels";
import { clp, dateTime, date } from "@/lib/format";
import { getOppForActor } from "@/server/crm";
import { Badge, Card, Field, PageHeader, StatusBadge } from "@/components/ui";
import { ActionForm, InlineAction, Submit } from "@/components/client/forms";
import { LeadFields } from "../lead-fields";
import { activityAction, stageFormAction, trashAction, updateOppAction } from "../actions";

const ICON: Record<string, string> = { LLAMADA: "📞", NOTA: "📝", MENSAJE: "💬", CITA: "📅", ETAPA: "➜", SISTEMA: "⚙" };
export default async function Opp({ params }: { params: Promise<{ id: string }> }) {
  const a = await guard("crm");
  const { id } = await params;
  try { await getOppForActor(id, a); } catch { notFound(); }
  const o = await db.opportunity.findUniqueOrThrow({
    where: { id },
    include: { contact: true, seller: true, branch: true, vehicle: true, activities: { orderBy: { createdAt: "desc" } }, appointments: { orderBy: { startAt: "desc" }, include: { vehicle: true } }, reservations: { include: { vehicle: true } }, sales: true, simulations: { orderBy: { createdAt: "desc" } }, conversations: true },
  });
  const others = await db.opportunity.findMany({ where: { contactId: o.contactId, id: { not: o.id }, deletedAt: null }, select: { id: true, type: true, stage: true, createdAt: true } });
  const wa = o.contact.phone?.replace(/\D/g, "");
  return (
    <>
      <PageHeader title={o.contact.name} desc={<>{OPP_TYPE_LABEL[o.type]} · {SOURCE_LABEL[o.source]} · {o.branch.name} · creado {date(o.createdAt)}</>}
        actions={<>
          <Badge tone={STAGE_TONE[o.stage]}>{STAGE_LABEL[o.stage]}</Badge>
          {o.contact.phone && <a className="btn" href={`tel:${o.contact.phone}`}><Phone className="size-4" />Llamar</a>}
          {wa && <a className="btn" href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer"><MessageCircle className="size-4" />WhatsApp</a>}
          <Link className="btn" href={`/panel/citas?nueva=1&opp=${o.id}`}><CalendarPlus className="size-4" />Agendar</Link>
          <Link className="btn" href={`/panel/finanzas/calculadora?opp=${o.id}${o.vehicle ? `&price=${o.vehicle.price}` : ""}`}><Calculator className="size-4" />Simular crédito</Link>
          {can(a, "sales.edit") && o.stage !== "CONCRETADO" && <Link className="btn btn-primary" href={`/panel/ventas/nueva?opp=${o.id}${o.vehicleId ? `&vehicle=${o.vehicleId}` : ""}`}><ShoppingCart className="size-4" />Reservar / vender</Link>}
        </>} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Ficha comercial">
            <ActionForm action={updateOppAction}>
              <input type="hidden" name="id" value={o.id} />
              <LeadFields a={a} init={{ ...o.contact, ...o, name: o.contact.name }} />
              <div className="flex justify-end"><Submit>Guardar ficha</Submit></div>
            </ActionForm>
          </Card>
          <Card title="Registrar actividad">
            <ActionForm action={activityAction} resetOnOk className="grid gap-2 sm:grid-cols-6">
              <input type="hidden" name="id" value={o.id} />
              <Field label="Tipo" className="sm:col-span-1"><select name="type" className="input"><option value="LLAMADA">Llamada</option><option value="NOTA">Nota</option><option value="MENSAJE">Mensaje</option></select></Field>
              <Field label="Resultado" className="sm:col-span-1"><select name="outcome" className="input"><option value="">—</option><option>Contestó</option><option>No contesta</option><option>Agendó visita</option><option>Pidió cotización</option></select></Field>
              <Field label="Detalle" className="sm:col-span-2"><input name="body" required className="input" /></Field>
              <Field label="Próximo seguimiento" className="sm:col-span-2"><input type="datetime-local" name="nextFollowUpAt" className="input" /></Field>
              <div className="sm:col-span-6 flex justify-end"><Submit>Registrar</Submit></div>
            </ActionForm>
          </Card>
          <Card title="Cronología" sub="Llamadas, notas, mensajes, citas y cambios" bodyClass="p-0">
            <ol>{o.activities.map((x) => (
              <li key={x.id} className="flex gap-3 border-b border-line px-4 py-2.5 text-sm last:border-0">
                <span className="w-5 shrink-0 text-center" aria-hidden>{ICON[x.type]}</span>
                <div className="min-w-0 flex-1"><p>{x.body}{x.outcome && <span className="ml-2 text-xs text-muted">({x.outcome})</span>}</p><p className="text-xs text-muted">{x.type.toLowerCase()} · {x.userName ?? "Sistema"} · {dateTime(x.createdAt)}</p></div>
              </li>))}</ol>
          </Card>
        </div>
        <div className="space-y-4">
          <Card title="Etapa">
            <ActionForm action={stageFormAction}>
              <input type="hidden" name="id" value={o.id} />
              <select name="stage" defaultValue={o.stage} className="input">{STAGES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              <input name="reason" placeholder="Motivo (obligatorio al cancelar)" className="input" />
              <Submit className="btn btn-dark w-full">Cambiar etapa</Submit>
            </ActionForm>
            {o.cancelReason && <p className="mt-2 text-xs text-muted">Motivo de cancelación: {o.cancelReason}</p>}
          </Card>
          <Card title="Resumen">
            <dl className="grid grid-cols-2 gap-y-1.5 text-sm">
              <dt className="text-muted">Vendedor</dt><dd>{o.seller?.name ?? "Sin asignar"}</dd>
              <dt className="text-muted">Presupuesto</dt><dd>{clp(o.budget)}</dd>
              <dt className="text-muted">Forma de compra</dt><dd>{o.payMethod ? PAY_LABEL[o.payMethod] : "—"}</dd>
              <dt className="text-muted">Seguimiento</dt><dd>{dateTime(o.nextFollowUpAt)}</dd>
              {o.vehicle && <><dt className="text-muted">Vehículo</dt><dd><Link className="link" href={`/panel/inventario/${o.vehicle.id}`}>{o.vehicle.brand} {o.vehicle.model} · {clp(o.vehicle.price)}</Link></dd></>}
            </dl>
          </Card>
          <Card title={`Citas (${o.appointments.length})`} bodyClass="p-0">
            {o.appointments.length === 0 ? <p className="px-4 py-3 text-sm text-muted">Sin citas.</p> : <ul>{o.appointments.map((x) => <li key={x.id} className="flex items-center justify-between border-b border-line px-4 py-2 text-sm last:border-0"><span>{APPT_TYPE[x.type]} · {dateTime(x.startAt)}</span><StatusBadge map={APPT_STATUS} value={x.status} /></li>)}</ul>}
          </Card>
          {(o.reservations.length > 0 || o.sales.length > 0) && (
            <Card title="Reservas y ventas" bodyClass="p-0"><ul>
              {o.reservations.map((r) => <li key={r.id} className="flex items-center justify-between border-b border-line px-4 py-2 text-sm"><span>Reserva {r.vehicle.plate} · {clp(r.amount)}</span><StatusBadge map={RES_STATUS} value={r.status} /></li>)}
              {o.sales.map((x) => <li key={x.id} className="flex items-center justify-between border-b border-line px-4 py-2 text-sm last:border-0"><Link className="link" href={`/panel/ventas/${x.id}`}>Venta #{x.number}</Link><span>{clp(x.finalPrice)}</span></li>)}
            </ul></Card>
          )}
          {o.simulations.length > 0 && (
            <Card title="Simulaciones de crédito" bodyClass="p-0"><ul>{o.simulations.map((x) => {
              const r = x.result as { cuota: number }; const i = x.inputs as { plazo: number; tasa: number };
              return <li key={x.id} className="border-b border-line px-4 py-2 text-sm last:border-0">Cuota {clp(r.cuota)} · {i.plazo} meses · {i.tasa}% anual<div className="text-xs text-muted">{dateTime(x.createdAt)} · {x.createdBy}</div></li>;
            })}</ul></Card>
          )}
          {others.length > 0 && <Card title="Otras oportunidades del contacto" bodyClass="p-0"><ul>{others.map((x) => <li key={x.id} className="border-b border-line px-4 py-2 text-sm last:border-0"><Link href={`/panel/crm/${x.id}`} className="link">{OPP_TYPE_LABEL[x.type]}</Link> · {STAGE_LABEL[x.stage]} · {date(x.createdAt)}</li>)}</ul></Card>}
          {o.conversations.length > 0 && <Link href={`/panel/whatsapp?c=${o.conversations[0].id}`} className="btn w-full"><MessageCircle className="size-4" />Ver conversación de WhatsApp</Link>}
          <Link href={`/panel/documentos?nuevo=1${o.vehicleId ? `&vehicle=${o.vehicleId}` : ""}`} className="btn w-full"><FileSignature className="size-4" />Generar documento</Link>
          {can(a, "crm.trash") && <div className="text-right"><InlineAction action={trashAction} fields={{ id: o.id }} label="Enviar a papelera" className="btn btn-sm btn-danger" confirm /></div>}
        </div>
      </div>
    </>
  );
}
