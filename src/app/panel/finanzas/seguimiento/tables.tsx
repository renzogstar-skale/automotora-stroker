import Link from "next/link";
import { clp, date } from "@/lib/format";
import { qs } from "@/lib/period";
import type { financeReport, pendingItems } from "@/server/finance";
import { Badge, Card, Empty, Table } from "@/components/ui";

type R = Awaited<ReturnType<typeof financeReport>>;
type P = Awaited<ReturnType<typeof pendingItems>>;
type SP = Record<string, string | string[] | undefined>;

export function Tables({ r, pend, q, s }: { r: R; pend: P; q: string; s: SP }) {
  const mv = (list: R["lastExpenses"], title: string, type: string) => (
    <Card title={title} bodyClass="p-0" action={<Link className="text-xs link" href={`/panel/finanzas/movimientos${qs(s, { type })}`}>Abrir con filtros</Link>}>
      {list.length === 0 ? <Empty compact /> : (
        <Table><thead><tr><th>Fecha</th><th>Categoría</th><th>Descripción</th><th>Socio</th><th className="num">Monto</th></tr></thead><tbody>
          {list.map((m) => <tr key={m.id}><td className="whitespace-nowrap">{date(m.date)}</td><td>{m.category.name}</td><td className="max-w-56 truncate"><Link className="link" title="Ver origen" href={m.saleId ? `/panel/ventas/${m.saleId}` : m.vehicleId ? `/panel/inventario/${m.vehicleId}` : `/panel/finanzas/movimientos?id=${m.id}`}>{m.description}</Link></td><td className="text-xs">{m.partner ? <>{m.partner.name}{m.scope === "SOCIO" && <Badge tone="violet" className="ml-1">fuera</Badge>}</> : "—"}</td><td className="num">{clp(m.amount)}</td></tr>)}
        </tbody></Table>)}
    </Card>
  );
  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <Card title="Gastos por inversionista o socio" bodyClass="p-0" sub="Dentro: gasto de empresa pagado por el socio · Fuera: gasto personal del socio">
        {r.byPartner.length === 0 ? <Empty compact /> : (
          <Table><thead><tr><th>Socio</th><th className="num">Dentro del balance</th><th className="num">Fuera del balance</th></tr></thead><tbody>
            {r.byPartner.map((p) => <tr key={p.name}><td>{p.name}</td><td className="num">{clp(p.inside)}</td><td className="num">{clp(p.outside)}</td></tr>)}
          </tbody></Table>)}
      </Card>
      <Card title="Resumen de ventas del período" bodyClass="p-0" action={<Link className="text-xs link" href={`/panel/finanzas/libro${q}`}>Libro de Ventas</Link>}>
        <Table><tbody>
          <tr><td>Unidades vendidas</td><td className="num">{r.sold.units} <span className="text-xs text-muted">({r.sold.own} propias · {r.sold.consigned} consignadas)</span></td></tr>
          <tr><td>Monto vendido</td><td className="num">{clp(r.sold.amount)}</td></tr>
          <tr><td>Ganancia por ventas (utilidad final)</td><td className="num">{clp(r.sold.profit)}</td></tr>
          <tr><td>Otros ingresos</td><td className="num">{clp(r.kpi.otherIncome)}</td></tr>
          <tr><td><Link className="link" href={`/panel/ventas${q}`}>Cobros pendientes</Link> <span className="text-xs text-muted">{pend.receivables.length} ventas</span></td><td className="num">{clp(pend.receivables.reduce((t, x) => t + x.econ.balance, 0))}</td></tr>
          <tr><td>Vencimientos <span className="text-xs text-muted">{pend.overdue.length} saldos vencidos</span></td><td className="num text-red-700 dark:text-red-400">{clp(pend.overdue.reduce((t, x) => t + x.econ.balance, 0))}</td></tr>
          <tr><td>Devoluciones por resolver <span className="text-xs text-muted">reservas expiradas/anuladas con abono</span></td><td className="num">{clp(pend.refunds.reduce((t, x) => t + x.payments.filter((p) => p.status === "REGISTRADO").reduce((u, p) => u + p.amount, 0), 0))}</td></tr>
          <tr><td><Link className="link" href="/panel/consignaciones?estado=VENDIDA">Liquidaciones pendientes</Link> <span className="text-xs text-muted">{pend.payouts.length} propietarios</span></td><td className="num">{clp(pend.payouts.reduce((t, x) => t + x.due - x.paid, 0))}</td></tr>
        </tbody></Table>
      </Card>
      {mv(r.lastExpenses, "Últimos 8 gastos", "EGRESO")}
      {mv(r.lastIncomes, "Últimos 8 ingresos", "INGRESO")}
      {pend.overdue.length + pend.refunds.length > 0 && (
        <Card title="Detalle de vencimientos y devoluciones" className="lg:col-span-2" bodyClass="p-0">
          <Table><tbody>
            {pend.overdue.map((x) => <tr key={x.id}><td><Badge tone="red">Saldo vencido</Badge></td><td><Link className="link" href={`/panel/ventas/${x.id}`}>Venta #{x.number}</Link> · {x.contact.name}</td><td>Vence {date(x.balanceDueAt)}</td><td className="num">{clp(x.econ.balance)}</td></tr>)}
            {pend.refunds.map((x) => <tr key={x.id}><td><Badge tone="amber">Devolución</Badge></td><td><Link className="link" href={`/panel/inventario/${x.vehicleId}`}>{x.vehicle.plate}</Link> · {x.contact.name}</td><td>Reserva {x.status.toLowerCase()}</td><td className="num">{clp(x.payments.filter((p) => p.status === "REGISTRADO").reduce((t, p) => t + p.amount, 0))}</td></tr>)}
          </tbody></Table>
        </Card>
      )}
    </div>
  );
}
