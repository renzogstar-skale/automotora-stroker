import Link from "next/link";
import { guard } from "@/lib/auth";
import { db } from "@/lib/db";
import { parsePeriod, sp } from "@/lib/period";
import { clp, date, ymd } from "@/lib/format";
import { Badge, Card, Field, PageHeader, Table } from "@/components/ui";
import { ActionForm, InlineAction, Submit } from "@/components/client/forms";
import { PeriodFilter, effectiveBranches } from "@/components/filters";
import { payCommissionAction, ruleAction } from "../actions";

const BEN: Record<string, string> = { VENDEDOR: "Vendedor de la venta", CAPTADOR: "Captador de la consignación", GERENCIA: "Gerencia", SOCIO: "Socio / participación" };
const BASE: Record<string, string> = { PRECIO_VENTA: "Precio final de venta", MARGEN_BRUTO: "Margen bruto", UTILIDAD_RESTANTE: "Utilidad restante tras órdenes anteriores" };
const APPLY: Record<string, string> = { TODAS: "Todas las ventas", PROPIA: "Solo propias", CONSIGNACION_FISICA: "Consignación física", CONSIGNACION_ONLINE: "Consignación online" };

export default async function Commissions({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const a = await guard("commissions");
  const s = await searchParams;
  const p = parsePeriod(s);
  const b = effectiveBranches(a, s);
  const saleId = sp(s, "sale");
  const [rules, comms] = await Promise.all([
    db.commissionRule.findMany({ orderBy: [{ order: "asc" }, { createdAt: "asc" }] }),
    db.saleCommission.findMany({ where: saleId ? { saleId } : { sale: { status: "CONFIRMADA", saleDate: { gte: p.from, lt: p.to }, ...(b ? { branchId: { in: b } } : {}) } }, include: { sale: { include: { vehicle: true } }, seller: true }, orderBy: [{ sale: { saleDate: "desc" } }, { order: "asc" }] }),
  ]);
  const edit = rules.find((r) => r.id === sp(s, "edit"));
  const byBen = new Map<string, number>();
  for (const c of comms) byBen.set(c.seller?.name ?? c.beneficiary, (byBen.get(c.seller?.name ?? c.beneficiary) ?? 0) + c.amount);
  return (
    <>
      <PageHeader title="Comisiones y descuentos" desc="Reglas editables por orden y vigencia. Al cerrar cada venta se guarda el snapshot de las reglas aplicadas." />
      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="Reglas" className="xl:col-span-2" bodyClass="p-0">
          <Table><thead><tr><th>Orden</th><th>Regla</th><th>Beneficiario</th><th>Valor</th><th>Base</th><th>Aplica a</th><th>Vigencia</th><th /></tr></thead><tbody>
            {rules.map((r) => <tr key={r.id} className={r.active ? "" : "opacity-50"}><td>{r.order}</td><td>{r.name}</td><td className="text-xs">{BEN[r.beneficiary]}{r.beneficiaryName && ` · ${r.beneficiaryName}`}</td><td className="num">{r.kind === "FIJO" ? clp(r.value) : `${r.value.toLocaleString("es-CL")}%`}</td><td className="text-xs">{r.kind === "FIJO" ? "—" : BASE[r.base]}</td><td className="text-xs">{APPLY[r.appliesTo]}</td><td className="text-xs">{date(r.validFrom)} → {r.validTo ? date(r.validTo) : "sin término"}</td><td><Link className="text-xs link" href={`?edit=${r.id}`}>Editar</Link></td></tr>)}
          </tbody></Table>
          <p className="px-4 py-2 text-[11px] text-muted">Las reglas de igual orden comparten la misma base. «Utilidad restante» = margen bruto − preparación − comisiones de órdenes anteriores. Ejemplo: gerencia 10% (orden 2) se calcula después de vendedor y captación (orden 1); las participaciones 3%, 3% y 4% (orden 3) sobre lo que queda después de gerencia.</p>
        </Card>
        <Card title={edit ? `Editar: ${edit.name}` : "Nueva regla"}>
          <ActionForm action={ruleAction} className="grid grid-cols-2 gap-2 space-y-0">
            {edit && <input type="hidden" name="id" value={edit.id} />}
            <Field label="Nombre" className="col-span-2"><input name="name" defaultValue={edit?.name} required className="input" /></Field>
            <Field label="Beneficiario"><select name="beneficiary" defaultValue={edit?.beneficiary} className="input">{Object.entries(BEN).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
            <Field label="Nombre beneficiario"><input name="beneficiaryName" defaultValue={edit?.beneficiaryName ?? ""} className="input" /></Field>
            <Field label="Tipo"><select name="kind" defaultValue={edit?.kind} className="input"><option value="FIJO">Monto fijo</option><option value="PORCENTAJE">Porcentaje</option></select></Field>
            <Field label="Valor"><input name="value" defaultValue={edit?.value} required className="input" /></Field>
            <Field label="Base (porcentajes)" className="col-span-2"><select name="base" defaultValue={edit?.base ?? "UTILIDAD_RESTANTE"} className="input">{Object.entries(BASE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
            <Field label="Aplica a"><select name="appliesTo" defaultValue={edit?.appliesTo} className="input">{Object.entries(APPLY).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
            <Field label="Orden"><input name="order" type="number" defaultValue={edit?.order ?? 1} className="input" /></Field>
            <Field label="Vigente desde"><input type="date" name="validFrom" defaultValue={ymd(edit?.validFrom ?? new Date())} className="input" /></Field>
            <Field label="Hasta"><input type="date" name="validTo" defaultValue={edit?.validTo ? ymd(edit.validTo) : ""} className="input" /></Field>
            <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={edit?.active ?? true} />Activa</label>
            <div className="col-span-2 flex justify-end gap-2">{edit && <Link href="?" className="btn">Nueva</Link>}<Submit>Guardar regla</Submit></div>
          </ActionForm>
        </Card>
      </div>
      <div className="mt-4"><PeriodFilter a={a} s={s} /></div>
      <div className="mb-3 flex flex-wrap gap-2 text-sm">{[...byBen].map(([k, v]) => <span key={k} className="card px-3 py-1.5">{k}: <b>{clp(v)}</b></span>)}</div>
      <Card title={saleId ? "Comisiones de la venta" : "Comisiones generadas en el período"} bodyClass="p-0">
        <Table><thead><tr><th>Venta</th><th>Fecha</th><th>Beneficiario</th><th>Base</th><th className="num">Monto base</th><th className="num">Comisión</th><th>Estado</th></tr></thead><tbody>
          {comms.map((c) => <tr key={c.id}><td><Link className="link" href={`/panel/ventas/${c.saleId}`}>#{c.sale.number}</Link> <span className="text-xs text-muted">{c.sale.vehicle.plate}</span></td><td>{date(c.sale.saleDate)}</td><td>{c.seller?.name ?? c.beneficiary}</td><td className="text-xs">{c.baseLabel}</td><td className="num">{c.baseAmount ? clp(c.baseAmount) : "—"}</td><td className="num">{clp(c.amount)}</td><td>{c.paidAt ? <Badge tone="green">Pagada {date(c.paidAt)}</Badge> : <InlineAction action={payCommissionAction} fields={{ id: c.id }} label="Pagar" />}</td></tr>)}
        </tbody></Table>
      </Card>
    </>
  );
}
