import type { Prisma } from "@prisma/client";
import { guard } from "@/lib/auth";
import { db } from "@/lib/db";
import { parsePeriod, sp } from "@/lib/period";
import { clp, date, addDays, ymd } from "@/lib/format";
import { Badge, Card, Empty, Field, Kpi, PageHeader, Table, cx } from "@/components/ui";
import { ActionForm, InlineAction, Submit } from "@/components/client/forms";
import { PeriodFilter, effectiveBranches, visibleBranches } from "@/components/filters";
import { movementAction, reverseMovementAction, settlePendingAction } from "../actions";

export default async function Movements({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const a = await guard("finance");
  const s = await searchParams;
  const p = parsePeriod(s, "month");
  const b = effectiveBranches(a, s);
  const cat = sp(s, "cat"), type = sp(s, "type"), scope = sp(s, "scope"), partner = sp(s, "partner");
  const bw: Prisma.MovementWhereInput = b ? { OR: [{ branchId: { in: b } }, { branchId: null }] } : {};
  const id = sp(s, "id");
  // ?id=: acceso directo a un movimiento de origen (desde Seguimiento Financiero), sin filtro de período.
  const where: Prisma.MovementWhereInput = id ? { ...bw, id } : {
    ...bw, isPending: false, date: { gte: p.from, lt: p.to },
    ...(cat === "cobros" ? { category: { name: { in: ["Cobro de venta", "Cobro de reserva"] } } } : cat ? { categoryId: cat } : {}),
    ...(type ? { type } : {}), ...(scope ? { scope } : {}), ...(partner ? { partnerId: partner } : {}),
  };
  const since = addDays(new Date(), -30);
  const [rows, cats, partners, branches, last30, pending] = await Promise.all([
    db.movement.findMany({ where, include: { category: true, partner: true, branch: true, reversedBy: true }, orderBy: { date: "desc" }, take: 300 }),
    db.category.findMany({ orderBy: [{ type: "asc" }, { name: "asc" }] }),
    db.partner.findMany(),
    visibleBranches(a),
    db.movement.findMany({ where: { ...bw, isPending: false, scope: "EMPRESA", date: { gte: since } }, select: { type: true, amount: true } }),
    db.movement.findMany({ where: { ...bw, isPending: true }, include: { category: true }, orderBy: { dueDate: "asc" } }),
  ]);
  const inc = last30.filter((m) => m.type === "INGRESO").reduce((t, m) => t + m.amount, 0);
  const out = last30.filter((m) => m.type === "EGRESO").reduce((t, m) => t + m.amount, 0);
  return (
    <>
      <PageHeader title="Gastos e ingresos" desc="Movimientos de caja de empresa y de socios. Los cobros y liquidaciones se generan desde ventas y consignaciones (una sola vez)." />
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <Kpi label="Ingresos últimos 30 días" value={clp(inc)} exact={inc} />
        <Kpi label="Egresos últimos 30 días" value={clp(out)} exact={out} />
        <Kpi label="Neto 30 días" value={clp(inc - out)} exact={inc - out} />
        <Kpi label="Promedio diario neto" value={clp(Math.round((inc - out) / 30))} sub="Neto ÷ 30 días (empresa)" />
      </div>
      <Card title="Registrar movimiento" className="mb-4">
        <ActionForm action={movementAction} resetOnOk className="grid gap-2 space-y-0 sm:grid-cols-3 lg:grid-cols-6">
          <Field label="Categoría">
            <select name="categoryId" className="input">{cats.map((c) => <option key={c.id} value={c.id}>{c.type === "INGRESO" ? "↑" : "↓"} {c.name}{c.pnl ? "" : " (caja)"}</option>)}</select>
          </Field>
          <Field label="Monto"><input name="amount" inputMode="numeric" required className="input" /></Field>
          <Field label="Fecha / vencimiento"><input type="date" name="date" defaultValue={ymd(new Date())} className="input" /></Field>
          <Field label="Descripción"><input name="description" className="input" /></Field>
          <Field label="Alcance"><select name="scope" className="input"><option value="EMPRESA">Empresa</option><option value="SOCIO">Socio (fuera del balance)</option></select></Field>
          <Field label="Socio"><select name="partnerId" className="input"><option value="">—</option>{partners.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
          <Field label="Sucursal"><select name="branchId" className="input"><option value="">General</option>{branches.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
          <Field label="Venta N° (gasto directo)"><input name="saleId" inputMode="numeric" className="input" /></Field>
          <Field label="Etiquetas"><input name="tags" placeholder="separadas por coma" className="input" /></Field>
          <label className="flex items-end gap-1.5 pb-2 text-sm"><input type="checkbox" name="pending" />Pendiente (por cobrar/pagar)</label>
          <label className="flex items-end gap-1.5 pb-2 text-sm"><input type="checkbox" name="refund" />Devolución</label>
          <div className="flex items-end"><Submit className="btn btn-primary w-full">Registrar</Submit></div>
        </ActionForm>
      </Card>
      {pending.length > 0 && (
        <Card title={`Cobros y pagos pendientes (${pending.length})`} className="mb-4" bodyClass="p-0">
          <Table>
            <tbody>
              {pending.map((m) => (
                <tr key={m.id}>
                  <td>{m.type === "INGRESO" ? <Badge tone="green">Por cobrar</Badge> : <Badge tone="amber">Por pagar</Badge>}</td>
                  <td>{m.description}</td><td>{m.category.name}</td>
                  <td className={cx(m.dueDate && m.dueDate < new Date() && "font-medium text-red-700")}>Vence {date(m.dueDate)}</td>
                  <td className="num">{clp(m.amount)}</td>
                  <td className="text-right"><InlineAction action={settlePendingAction} fields={{ id: m.id }} label="Marcar realizado" /></td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
      <PeriodFilter a={a} s={s} extra={<>
        <label><span className="label">Tipo</span><select name="type" defaultValue={type ?? ""} className="input w-32"><option value="">Todos</option><option value="INGRESO">Ingresos</option><option value="EGRESO">Egresos</option></select></label>
        <label><span className="label">Categoría</span><select name="cat" defaultValue={cat ?? ""} className="input w-48"><option value="">Todas</option><option value="cobros">Cobros (venta + reserva)</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label><span className="label">Alcance</span><select name="scope" defaultValue={scope ?? ""} className="input w-32"><option value="">Todos</option><option value="EMPRESA">Empresa</option><option value="SOCIO">Socio</option></select></label>
        <label><span className="label">Socio</span><select name="partner" defaultValue={partner ?? ""} className="input w-44"><option value="">Todos</option>{partners.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      </>} />
      <Card bodyClass="p-0">
        {rows.length === 0 ? <Empty title="Sin movimientos con estos filtros" /> : (
          <Table>
            <thead><tr><th>Fecha</th><th>Categoría</th><th>Descripción</th><th>Alcance</th><th>Sucursal</th><th className="num">Monto</th><th /></tr></thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} className={cx((m.reversedBy || m.reversalOfId) && "opacity-60")}>
                  <td className="whitespace-nowrap">{date(m.date)}</td>
                  <td>{m.category.name}{!m.category.pnl && <span className="ml-1 text-[10px] text-muted">caja</span>}{m.pozo && <Badge tone="violet" className="ml-1">Pozo</Badge>}{m.refund && <Badge tone="amber" className="ml-1">Devolución</Badge>}</td>
                  <td className="max-w-80 truncate">{m.description}{m.tags.length > 0 && <span className="ml-1 text-xs text-muted">#{m.tags.join(" #")}</span>}</td>
                  <td>{m.scope === "SOCIO" ? <Badge tone="violet">Socio · {m.partner?.name}</Badge> : m.partner ? <span className="text-xs">Empresa (pagó {m.partner.name})</span> : "Empresa"}</td>
                  <td className="text-xs">{m.branch?.name ?? "General"}</td>
                  <td className={cx("num font-medium", m.type === "INGRESO" && "text-emerald-700 dark:text-emerald-400")}>{m.type === "INGRESO" ? "+" : "−"}{clp(m.amount)}</td>
                  <td className="text-right">{!m.reversedBy && !m.reversalOfId && !m.paymentId && !m.payoutId && <InlineAction action={reverseMovementAction} fields={{ id: m.id }} reasonLabel="Motivo" label="Reversar" className="btn btn-sm" />}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
