import Link from "next/link";
import { guard } from "@/lib/auth";
import { parsePeriod, qs } from "@/lib/period";
import { clp, clpShort, pct } from "@/lib/format";
import { financeReport, pendingItems } from "@/server/finance";
import { Card, Empty, Kpi, PageHeader } from "@/components/ui";
import { PeriodFilter, effectiveBranches } from "@/components/filters";
import { Bars, HBars, Lines } from "@/components/client/charts";
import { Tables } from "./tables";

export default async function Tracking({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const a = await guard("finance");
  const s = await searchParams;
  const p = parsePeriod(s, "6m");
  const b = effectiveBranches(a, s);
  const [r, pend] = await Promise.all([financeReport(p, b), pendingItems(b)]);
  const k = r.kpi;
  const q = qs(s);
  const empty = r.sales.length === 0 && r.moves.length === 0;
  return (
    <>
      <PageHeader title="Seguimiento Financiero" desc={<>Período <b>{p.label}</b>. Monto vendido, cobros, utilidad y saldo de caja se calculan por separado.</>} />
      <PeriodFilter a={a} s={s} def="6m" />
      {empty && <Card className="mb-4"><Empty title="Sin actividad en el período" text="No hay ventas ni movimientos registrados. Los indicadores muestran «Sin datos» cuando no hay base de cálculo." /></Card>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Ingresos del período" value={clpShort(k.income)} exact={k.income} sub={`Ventas ${clpShort(k.saleIncome)} + otros ${clpShort(k.otherIncome)}`} />
        <Kpi label="Gastos de empresa" value={clpShort(k.expenses)} exact={k.expenses} sub={`Directos ${clpShort(k.direct)} · comisiones ${clpShort(k.commissions)} · operativos ${clpShort(k.opex)}`} href={`/panel/finanzas/movimientos${qs(s, { type: "EGRESO", scope: "EMPRESA" })}`} />
        <Kpi label="Utilidad neta" value={clpShort(k.net)} exact={k.net} sub={`Ingresos − costo unidades propias (${clpShort(k.cogs)}) − gastos`} tone="accent" />
        <Kpi label="Margen neto" value={pct(k.margin)} sub={k.margin == null ? "Sin ingresos en el período" : `${clp(k.net)} ÷ ${clp(k.income)}`} />
      </div>
      <details className="card mt-2 px-4 py-2 text-xs text-muted">
        <summary className="cursor-pointer font-medium text-ink">Cómo se calcula</summary>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          <li><b>Venta propia:</b> ingreso = precio final + adicionales; costo = adquisición (se reconoce al vender, no al comprar).</li>
          <li><b>Venta consignada:</b> ingreso = precio final − monto a liquidar al propietario + adicionales (solo la comisión es ingreso de Stroker). El monto vendido sí incluye el precio completo.</li>
          <li><b>Gastos de empresa:</b> preparación de unidades vendidas + gastos directos de venta + comisiones (snapshot al cierre) + categorías operativas (arriendo, sueldos, publicidad, servicios, generales). Cada costo se usa una vez.</li>
          <li><b>No son resultado:</b> compras de vehículos, cobros, aportes y retiros de socios, liquidaciones, comisiones pagadas y pozo (solo afectan caja).</li>
          <li><b>Gastos de socios:</b> con alcance «Socio» quedan fuera del balance de empresa; con alcance «Empresa» y socio indicado, el socio pagó un gasto de la empresa y sí se incluye.</li>
        </ul>
      </details>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Ingresos vs. gastos por mes" sub="Base de resultado (devengado por fecha de venta)"><Bars data={r.monthly} series={[{ key: "ingresos", label: "Ingresos" }, { key: "gastos", label: "Costos y gastos" }]} yLabel="CLP" /></Card>
        <Card title="Flujo de caja por mes" sub="Cobros y pagos realizados (empresa)"><Bars data={r.monthly} series={[{ key: "entradas", label: "Entradas" }, { key: "salidas", label: "Salidas" }]} yLabel="CLP" /></Card>
        <Card title="Tendencia de ventas" sub="Monto vendido (izq.) y unidades (der.) en gráficos separados">
          <div className="grid gap-2 sm:grid-cols-2">
            <Bars data={r.monthly} series={[{ key: "vendido", label: "Monto vendido" }]} yLabel="Monto vendido (CLP)" height={190} />
            <Bars data={r.monthly} series={[{ key: "unidades", label: "Unidades" }]} money={false} yLabel="Unidades" height={190} />
          </div>
        </Card>
        <Card title={r.opening != null ? "Balance acumulado" : "Flujo acumulado del período"} sub={r.opening != null ? `Saldo inicial al comienzo del período: ${clp(r.opening)}` : "No hay saldo inicial anterior al período; se acumula desde cero"}>
          <Lines data={r.cumulative} series={[{ key: "saldo", label: "Saldo" }]} yLabel="CLP" />
        </Card>
        <Card title="Gastos por categoría" sub="Egresos de empresa; «caja» = no afecta utilidad" action={<Link className="text-xs link" href={`/panel/finanzas/movimientos${qs(s, { type: "EGRESO" })}`}>Ver movimientos</Link>}>
          {r.byCategory.length ? <HBars label="Egresos" data={r.byCategory.map((c) => ({ name: `${c.name}${c.pnl ? "" : " (caja)"}`, value: c.amount }))} /> : <Empty compact />}
        </Card>
        <Card title="Desglose de ingresos" sub="Ingresos reconocidos del período">
          <HBars label="Ingresos" data={r.incomeBreakdown} height={130} />
        </Card>
      </div>
      <Tables r={r} pend={pend} q={q} s={s} />
    </>
  );
}
