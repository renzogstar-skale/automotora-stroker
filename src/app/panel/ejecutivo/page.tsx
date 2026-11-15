import Link from "next/link";
import { Car, CircleDollarSign, Hash, Landmark, Percent, Receipt, Target, TrendingUp } from "lucide-react";
import { guard } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, oppScope } from "@/lib/rbac";
import { parsePeriod, qs, sp } from "@/lib/period";
import { addDays, clp, clpShort, date, num, pct, rate, ymd } from "@/lib/format";
import { financeReport } from "@/server/finance";
import { crmStats } from "@/server/crm";
import { conversion, currentState, marginRanking, salesSummary, topModels } from "@/server/metrics";
import { oppWhere } from "../crm/query";
import { Card, Empty, Kpi, PageHeader, Table } from "@/components/ui";
import { PeriodFilter, effectiveBranches } from "@/components/filters";
import { Bars, HBars } from "@/components/client/charts";

export const metadata = { title: "Dashboard Ejecutivo" };
type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function EjecutivoPage({ searchParams }: { searchParams: SP }) {
  const a = await guard("dashboard.exec");
  const s = await searchParams;
  const p = parsePeriod(s, "month");
  const branches = effectiveBranches(a, s);
  const branch = sp(s, "branch") && branches?.length === 1 ? branches[0] : undefined;
  const bw = branches ? { branchId: { in: branches } } : {};
  const showFin = can(a, "finance"), showMargin = can(a, "inventory.cost"), showCrm = can(a, "crm");
  // Universo CRM idéntico al de CRM/Leads (tipo Venta); sin acceso a CRM, el alcance por sucursal.
  const oWhere = showCrm ? oppWhere(a, { branch }) : { ...oppScope(a), ...bw, deletedAt: null, type: "VENTA" as const };
  // Ventas, ingresos, gastos y caja: definiciones únicas de server/finance y server/economics.
  const [r, conv, crm, state, sellers] = await Promise.all([
    financeReport(p, branches),
    conversion(p, { ...oppScope(a), ...bw }),
    crmStats(oWhere),
    currentState(branches, oWhere),
    db.seller.findMany({ where: bw, select: { id: true, name: true } }),
  ]);
  const rows = r.sales.map((x) => ({ sellerId: x.sellerId, finalPrice: x.finalPrice, margin: x.econ.margin, vehicle: x.vehicle }));
  const sum = salesSummary(rows);
  const ranking = marginRanking(rows, sellers);
  const models = topModels(rows);
  const convRate = rate(conv.num, conv.den);
  const cash = r.cash.in - r.cash.out;
  const q = qs(s);
  const join = (path: string, extra?: string) => { const u = [branch && `branch=${branch}`, extra].filter(Boolean).join("&"); return u ? `${path}?${u}` : path; };
  // Cohorte de leads del período en Leads: mismas fechas de creación, tipo Venta y sucursal.
  const cohort = (extra?: string) => join("/panel/leads", [`type=VENTA&from=${ymd(p.from)}&to=${ymd(addDays(p.to, -1))}`, extra].filter(Boolean).join("&"));
  const back = encodeURIComponent(`/panel/ejecutivo${q}`);
  const empty = r.sales.length === 0 && r.moves.length === 0;
  return (
    <>
      <PageHeader title="Dashboard ejecutivo"
        desc={<>Período: <b className="capitalize">{p.label}</b>. Las tarjetas <b>Período</b> responden al filtro; las tarjetas <b>Hoy</b> muestran el estado actual.</>} />
      <PeriodFilter a={a} s={s} />
      {empty && <Card className="mb-4"><Empty title="Sin actividad en el período" text="No hay ventas ni movimientos registrados con estos filtros. Los indicadores sin base de cálculo muestran «Sin datos»." /></Card>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        <Kpi scope="period" icon={CircleDollarSign} tone="accent" label="Ingresos" value={clpShort(r.kpi.income)} exact={r.kpi.income}
          sub={`Ventas ${clpShort(r.kpi.saleIncome)} + otros ${clpShort(r.kpi.otherIncome)}`} href={showFin ? `/panel/finanzas/seguimiento${q}` : undefined} />
        <Kpi scope="period" icon={Hash} label="Unidades vendidas" value={num(sum.units)} sub={`Monto vendido ${clpShort(sum.amount)}`} href={`/panel/ventas${q}`} />
        <Kpi scope="period" icon={Target} label="Conversión de leads" value={convRate.text}
          sub={`${num(conv.num)} concretados de ${num(conv.den)} leads creados en el período`} href={showCrm ? cohort() : undefined} />
        <Kpi scope="period" icon={Receipt} label="Ticket promedio" value={sum.ticket == null ? "Sin datos" : clpShort(sum.ticket)} exact={sum.ticket ?? undefined}
          sub={sum.units ? `${clpShort(sum.amount)} ÷ ${sum.units} unidades` : "Sin ventas en el período"} href={`/panel/ventas${q}`} />
        {showMargin && <Kpi scope="period" icon={Percent} label="Margen bruto" value={clpShort(sum.margin)} exact={sum.margin}
          sub={sum.marginRate == null ? "Sin ventas en el período" : `${pct(sum.marginRate)} del monto vendido`} href={`/panel/finanzas/libro${q}`} />}
        {showFin && <Kpi scope="period" icon={Landmark} label="Balance de caja" value={clpShort(cash)} exact={cash}
          sub={`Entradas ${clpShort(r.cash.in)} − salidas ${clpShort(r.cash.out)} (empresa)`} href={`/panel/finanzas/seguimiento${q}`} />}
        <Kpi scope="now" icon={TrendingUp} label="Oportunidades activas" value={num(crm.active)} sub="Leads de venta en etapas abiertas" href={showCrm ? join("/panel/crm") : undefined} />
        <Kpi scope="now" icon={Car} label="Stock disponible" value={num(state.available)} sub={`${state.reserved} reservados · ${state.stockTotal} en stock`} href={join("/panel/inventario", "status=DISPONIBLE")} />
      </div>
      {showCrm && conv.den > 0 && (
        <p className="mt-2 text-xs text-muted">
          Conversión por cohorte: <Link className="link" href={cohort("stage=CONCRETADO")}>{num(conv.num)} concretados</Link> ÷ <Link className="link" href={cohort()}>{num(conv.den)} leads de venta creados</Link> entre {date(p.from)} y {date(addDays(p.to, -1))}, con corte hoy.
        </p>
      )}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Ingresos mensuales" sub="Período · ingreso reconocido por fecha de venta + otros ingresos">
          {r.kpi.income ? <Bars data={r.monthly} series={[{ key: "ingresos", label: "Ingresos" }]} yLabel="Ingresos (CLP)" /> : <Empty compact title="Sin ingresos en el período" />}
        </Card>
        {showFin ? (
          <Card title="Distribución de gastos" sub="Período · egresos de empresa por categoría; «caja» no afecta utilidad"
            action={<Link className="text-xs link" href={`/panel/finanzas/movimientos${qs(s, { type: "EGRESO" })}`}>Ver movimientos</Link>}>
            {r.byCategory.length ? <HBars label="Egresos" data={r.byCategory.map((c) => ({ name: `${c.name}${c.pnl ? "" : " (caja)"}`, value: c.amount }))} /> : <Empty compact title="Sin egresos en el período" />}
          </Card>
        ) : (
          <Card title="Unidades vendidas por mes" sub="Período">
            {sum.units ? <Bars data={r.monthly} series={[{ key: "unidades", label: "Unidades" }]} money={false} yLabel="Unidades" /> : <Empty compact title="Sin ventas en el período" />}
          </Card>
        )}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {showMargin && (
          <Card title="Ranking por margen" sub="Período · margen bruto por vendedor" bodyClass="p-0"
            action={can(a, "ranking") && <Link className="text-xs link" href={`/panel/finanzas/ranking${q}`}>Ranking completo</Link>}>
            {ranking.length === 0 ? <Empty compact title="Sin ventas en el período" /> : (
              <Table><thead><tr><th>#</th><th>Vendedor</th><th className="num">Unid.</th><th className="num">Monto</th><th className="num">Margen</th><th className="num">%</th></tr></thead><tbody>
                {ranking.slice(0, 8).map((x, i) => <tr key={x.seller.id}><td className="font-semibold">{i + 1}</td><td>{x.seller.name}</td><td className="num">{x.units}</td><td className="num">{clp(x.amount)}</td><td className="num font-semibold">{clp(x.margin)}</td><td className="num">{pct(x.marginRate)}</td></tr>)}
              </tbody></Table>)}
          </Card>
        )}
        <Card title="Modelos más vendidos" sub="Período · por unidades y, en empate, monto" bodyClass="p-0">
          {models.length === 0 ? <Empty compact title="Sin ventas en el período" /> : (
            <Table><thead><tr><th>Modelo</th><th className="num">Unidades</th><th className="num">Monto vendido</th></tr></thead><tbody>
              {models.map((m) => <tr key={m.name}><td>{m.name}</td><td className="num font-semibold">{m.units}</td><td className="num">{clp(m.amount)}</td></tr>)}
            </tbody></Table>)}
        </Card>
      </div>
      <Card title={`Ventas del período (${sum.units})`} sub={`Período · total ${clp(sum.amount)}${showMargin ? ` · margen ${clp(sum.margin)}` : ""}`} className="mt-4" bodyClass="p-0"
        action={<Link className="text-xs link" href={`/panel/ventas${q}`}>Abrir en Ventas</Link>}>
        {r.sales.length === 0 ? <Empty compact title="Sin ventas en el período" /> : (
          <Table><thead><tr><th>#</th><th>Fecha</th><th>Cliente</th><th>Vehículo</th><th>Vendedor</th><th>Sucursal</th><th className="num">Precio</th>{showMargin && <th className="num">Margen</th>}</tr></thead><tbody>
            {r.sales.map((x) => <tr key={x.id}><td><Link className="link" href={`/panel/ventas/${x.id}?back=${back}`}>#{x.number}</Link></td><td className="whitespace-nowrap">{date(x.saleDate)}</td><td>{x.contact.name}</td><td>{x.vehicle.brand} {x.vehicle.model}</td><td>{x.seller.name}</td><td>{x.branch.name}</td><td className="num">{clp(x.finalPrice)}</td>{showMargin && <td className="num">{clp(x.econ.margin)}</td>}</tr>)}
          </tbody></Table>)}
      </Card>
    </>
  );
}
