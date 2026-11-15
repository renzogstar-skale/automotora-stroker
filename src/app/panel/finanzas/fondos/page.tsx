import { guard } from "@/lib/auth";
import { db } from "@/lib/db";
import { parsePeriod, sp, monthKey, monthName } from "@/lib/period";
import { clp, clpShort, daysBetween, rate, ymd, date } from "@/lib/format";
import { salesWithEcon } from "@/server/economics";
import { pendingItems } from "@/server/finance";
import { signed } from "@/server/categories";
import { Card, Kpi, PageHeader, Table } from "@/components/ui";
import { PeriodFilter, effectiveBranches } from "@/components/filters";
import { Bars, Donut } from "@/components/client/charts";

export default async function Funds({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const a = await guard("finance");
  const s = await searchParams;
  const p = parsePeriod(s, "6m");
  const b = effectiveBranches(a, s);
  const bw = b ? { branchId: { in: b } } : {};
  const byDay = sp(s, "group") === "day";
  const [sales, cons, stock, aportes, pend, payouts] = await Promise.all([
    salesWithEcon({ status: "CONFIRMADA", saleDate: { gte: p.from, lt: p.to }, ...bw }),
    db.consignment.findMany({ where: { startDate: { gte: p.from, lt: p.to }, ...(b ? { vehicle: { branchId: { in: b } } } : {}) }, select: { startDate: true } }),
    db.vehicle.findMany({ where: { ...bw, status: { in: ["DISPONIBLE", "RESERVADO"] } }, include: { movements: { include: { category: true } } } }),
    db.movement.findMany({ where: { category: { name: { in: ["Aporte de socio", "Retiro de socio"] } }, date: { gte: p.from, lt: p.to } }, include: { partner: true, category: true } }),
    pendingItems(b),
    db.ownerPayout.findMany({ where: { paidAt: { gte: p.from, lt: p.to } } }),
  ]);
  const key = (d: Date) => (byDay ? ymd(d) : monthKey(d));
  const buckets = byDay ? [...new Set([...sales.map((x) => key(x.saleDate)), ...cons.map((x) => key(x.startDate))])].sort() : p.months.map(monthKey);
  const series = buckets.map((k, i) => ({ label: byDay ? k.slice(5) : monthName(p.months[i]), ventas: sales.filter((x) => key(x.saleDate) === k).length, consignaciones: cons.filter((x) => key(x.startDate) === k).length, facturacion: sales.filter((x) => key(x.saleDate) === k).reduce((t, x) => t + x.finalPrice, 0) }));
  const prepOf = (v: (typeof stock)[number]) => -v.movements.filter((m) => m.category.name === "Preparación de vehículo").reduce((t, m) => t + signed(m), 0);
  const own = stock.filter((v) => v.ownership === "PROPIO");
  const invested = own.reduce((t, v) => t + v.cost + prepOf(v), 0);
  const prepStock = stock.reduce((t, v) => t + prepOf(v), 0);
  const credit = sales.filter((x) => x.payMethod === "FINANCIAMIENTO").length;
  const cr = rate(credit, sales.length);
  const avgStock = stock.length ? Math.round(stock.reduce((t, v) => t + daysBetween(v.stockSince), 0) / stock.length) : null;
  const avgSell = sales.length ? Math.round(sales.reduce((t, x) => t + daysBetween(x.vehicle.stockSince, x.saleDate), 0) / sales.length) : null;
  const referred = sales.filter((x) => x.referredBy);
  return (
    <>
      <PageHeader title="Gestión de fondos" desc="Capital, stock, aportes, créditos, saldos y liquidaciones." />
      <PeriodFilter a={a} s={s} def="6m" extra={<label><span className="label">Agrupar</span><select name="group" defaultValue={byDay ? "day" : "month"} className="input w-28"><option value="month">Por mes</option><option value="day">Por día</option></select></label>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Facturación del período" value={clpShort(sales.reduce((t, x) => t + x.finalPrice, 0))} sub={`${sales.length} ventas`} />
        <Kpi label="Capital invertido en stock propio (hoy)" value={clpShort(invested)} exact={invested} sub={`${own.length} propios · ${stock.length - own.length} consignados`} />
        <Kpi label="Costos de preparación en stock" value={clpShort(prepStock)} exact={prepStock} sub="Se reconocen como costo al vender" />
        <Kpi label="Ganancias por crédito" value={clpShort(sales.reduce((t, x) => t + x.creditIncome, 0))} sub={`Crédito ${cr.text} de las ventas (${cr.detail})`} />
        <Kpi label="Aportes de socios (período)" value={clpShort(aportes.filter((m) => m.category.name === "Aporte de socio").reduce((t, m) => t + m.amount, 0))} sub={`Retiros ${clp(aportes.filter((m) => m.category.name === "Retiro de socio").reduce((t, m) => t + m.amount, 0))}`} />
        <Kpi label="Saldos pendientes de clientes" value={clpShort(pend.receivables.reduce((t, x) => t + x.econ.balance, 0))} sub={`${pend.receivables.length} ventas`} href="/panel/finanzas/seguimiento" />
        <Kpi label="Liquidaciones" value={clpShort(pend.payouts.reduce((t, x) => t + x.due - x.paid, 0))} sub={`Pendiente · pagado en período ${clp(payouts.reduce((t, x) => t + x.amount, 0))}`} href="/panel/consignaciones?estado=VENDIDA" />
        <Kpi label="Días en stock" value={avgStock == null ? "Sin datos" : `${avgStock} días`} sub={`Promedio actual · venta en ${avgSell ?? "—"} días`} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title={`Ventas y consignaciones por ${byDay ? "día" : "mes"}`} className="lg:col-span-2"><Bars data={series} series={[{ key: "ventas", label: "Ventas" }, { key: "consignaciones", label: "Consignaciones captadas" }]} money={false} yLabel="Unidades" /></Card>
        <Card title="Crédito frente a contado" sub={`${sales.length} ventas del período`}>
          {sales.length ? <Donut label="Forma de pago" data={[{ name: "Financiamiento", value: credit }, { name: "Contado", value: sales.filter((x) => x.payMethod === "CONTADO").length }, { name: "Parte de pago", value: sales.filter((x) => x.payMethod === "PARTE_PAGO").length }]} /> : <p className="text-sm text-muted">Sin datos</p>}
        </Card>
        <Card title="Facturación" className="lg:col-span-2"><Bars data={series} series={[{ key: "facturacion", label: "Facturación" }]} yLabel="CLP" /></Card>
        <Card title={`Referidos (${referred.length})`} bodyClass="p-0">
          {referred.length === 0 ? <p className="p-4 text-sm text-muted">Sin ventas referidas en el período.</p> : <Table><tbody>{referred.map((x) => <tr key={x.id}><td>{x.referredBy}</td><td>#{x.number} · {date(x.saleDate)}</td><td className="num">{clp(x.finalPrice)}</td></tr>)}</tbody></Table>}
        </Card>
      </div>
    </>
  );
}
