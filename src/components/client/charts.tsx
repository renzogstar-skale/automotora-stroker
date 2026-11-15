"use client";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Paleta categórica validada (orden fijo, nunca ciclada). Claro / oscuro.
export const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];
const clp = (n: number) => new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);
const short = (n: number) => (Math.abs(n) >= 1e6 ? `$${(n / 1e6).toLocaleString("es-CL", { maximumFractionDigits: 1 })} M` : Math.abs(n) >= 1e3 ? `$${Math.round(n / 1e3)} mil` : `$${n}`);
const fmt = (money: boolean) => (v: number) => (money ? clp(v) : v.toLocaleString("es-CL"));
const axis = { fontSize: 11, fill: "var(--muted)" };
const tip = { contentStyle: { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12, color: "var(--ink)" }, cursor: { fill: "var(--accent-soft)" } };

type S = { key: string; label: string };
/** Barras (una o más series) con eje Y identificado y tooltip con el monto exacto. */
export function Bars({ data, series, money = true, yLabel, height = 220, stacked }: { data: Record<string, unknown>[]; series: S[]; money?: boolean; yLabel: string; height?: number; stacked?: boolean }) {
  return (
    <div style={{ height }} role="img" aria-label={`${yLabel}: ${series.map((s) => s.label).join(", ")}`}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }} barGap={2}>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={{ stroke: "var(--line)" }} />
          <YAxis tick={axis} tickLine={false} axisLine={false} width={money ? 64 : 36} tickFormatter={money ? short : undefined} allowDecimals={false}
            label={{ value: yLabel, angle: -90, position: "insideLeft", style: { ...axis, textAnchor: "middle" } }} />
          <Tooltip {...tip} formatter={(v, n) => [fmt(money)(Number(v)), n]} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} iconType="square" />}
          {series.map((s, i) => <Bar key={s.key} dataKey={s.key} name={s.label} fill={SERIES[i]} radius={stacked ? 0 : [4, 4, 0, 0]} maxBarSize={36} stackId={stacked ? "a" : undefined} stroke="var(--surface)" strokeWidth={stacked ? 2 : 0} />)}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Lines({ data, series, money = true, yLabel, height = 220 }: { data: Record<string, unknown>[]; series: S[]; money?: boolean; yLabel: string; height?: number }) {
  return (
    <div style={{ height }} role="img" aria-label={yLabel}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={{ stroke: "var(--line)" }} />
          <YAxis tick={axis} tickLine={false} axisLine={false} width={64} tickFormatter={money ? short : undefined}
            label={{ value: yLabel, angle: -90, position: "insideLeft", style: { ...axis, textAnchor: "middle" } }} />
          <Tooltip {...tip} cursor={{ stroke: "var(--muted)", strokeDasharray: "3 3" }} formatter={(v, n) => [fmt(money)(Number(v)), n]} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {series.map((s, i) => <Line key={s.key} dataKey={s.key} name={s.label} stroke={SERIES[i]} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />)}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal para categorías (gastos por categoría, inventario por tipo): una serie, sin leyenda. */
export function HBars({ data, money = true, height, label }: { data: { name: string; value: number }[]; money?: boolean; height?: number; label: string }) {
  return (
    <div style={{ height: height ?? Math.max(120, data.length * 30 + 20) }} role="img" aria-label={label}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" tick={axis} tickLine={false} axisLine={false} width={150} />
          <Tooltip {...tip} formatter={(v) => [fmt(money)(Number(v)), label]} />
          <Bar dataKey="value" fill={SERIES[0]} radius={[0, 4, 4, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Donut({ data, money = false, height = 200, label }: { data: { name: string; value: number }[]; money?: boolean; height?: number; label: string }) {
  return (
    <div style={{ height }} role="img" aria-label={label}>
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="88%" paddingAngle={1} stroke="var(--surface)" strokeWidth={2}>
            {data.map((_, i) => <Cell key={i} fill={SERIES[i % SERIES.length]} />)}
          </Pie>
          <Tooltip {...tip} formatter={(v, n) => [fmt(money)(Number(v)), n]} />
          <Legend wrapperStyle={{ fontSize: 12 }} layout="vertical" align="right" verticalAlign="middle" iconType="circle" />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
