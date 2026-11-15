import Link from "next/link";
import type { Stage } from "@prisma/client";
import { guard } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { ACTIVE_STAGES } from "@/lib/labels";
import { clp, rate } from "@/lib/format";
import { parsePeriod, qs } from "@/lib/period";
import { salesLite } from "@/server/economics";
import { getSetting } from "@/server/settings";
import { teamToday } from "@/server/team";
import { PeriodFilter, effectiveBranches, visibleBranches } from "@/components/filters";
import { Badge, Card, Empty, Kpi, Money, PageHeader, Table } from "@/components/ui";

export const metadata = { title: "Informe CEO" };
type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function InformeCeo({ searchParams }: { searchParams: SP }) {
  const a = await guard("ceo");
  const s = await searchParams;
  const p = parsePeriod(s);
  const ids = effectiveBranches(a, s);
  const branches = (await visibleBranches(a)).filter((b) => !ids || ids.includes(b.id));
  // Ventas y margen vienen del módulo financiero (definición única en server/economics). El margen solo para quien ve costos.
  const showSales = can(a, "sales"), showMargin = can(a, "inventory.cost");
  const notices = await getSetting("notices");
  const now = new Date(), period = { gte: p.from, lt: p.to };
  const perBranch = await Promise.all(branches.map(async (b) => {
    const ob = { branchId: b.id, deletedAt: null };
    const [leads, contacted, appts, followOver, noContact, unassigned, apptOver, sales, team] = await Promise.all([
      db.opportunity.count({ where: { ...ob, createdAt: period } }),
      db.opportunity.count({ where: { ...ob, createdAt: period, activities: { some: { type: { in: ["LLAMADA", "MENSAJE"] } } } } }),
      db.appointment.groupBy({ by: ["status"], where: { branchId: b.id, startAt: period }, _count: true }),
      db.opportunity.count({ where: { ...ob, stage: { in: ACTIVE_STAGES as Stage[] }, nextFollowUpAt: { lt: now } } }),
      db.opportunity.count({ where: { ...ob, stage: "NUEVO", createdAt: { lt: new Date(now.getTime() - notices.noContactHours * 3600e3) }, activities: { none: { type: { in: ["LLAMADA", "MENSAJE"] } } } } }),
      db.opportunity.count({ where: { ...ob, sellerId: null, closedAt: null } }),
      db.appointment.count({ where: { branchId: b.id, status: { in: ["PROGRAMADA", "CONFIRMADA"] }, endAt: { lt: now } } }),
      showSales ? salesLite({ branchId: b.id, status: "CONFIRMADA", saleDate: period }) : Promise.resolve([]),
      teamToday(a, b.id),
    ]);
    const ap = Object.fromEntries(appts.map((x) => [x.status, x._count])) as Record<string, number>;
    const reportsDue = team.rows.filter((r) => r.hasAccount).length;
    return {
      b, leads, contacted, ap, apTotal: appts.reduce((t, x) => t + x._count, 0), followOver, noContact, unassigned, apptOver,
      sales: sales.length, revenue: sales.reduce((t, x) => t + x.finalPrice, 0), margin: sales.reduce((t, x) => t + x.margin, 0),
      reportsSent: team.rows.filter((r) => r.report === "ENVIADO").length, reportsDue, inactive: team.rows.filter((r) => r.inactive),
    };
  }));
  const tot = (k: "leads" | "contacted" | "apTotal" | "sales" | "revenue" | "margin") => perBranch.reduce((t, x) => t + x[k], 0);
  const keep = qs(s);
  return (
    <>
      <PageHeader title="Informe CEO" desc={`Actividad comercial y excepciones por sucursal · ${p.label}`} />
      <PeriodFilter a={a} s={s} />
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Leads" value={tot("leads")} href={`/panel/leads${keep}`} />
        <Kpi label="Contactados" value={rate(tot("contacted"), tot("leads")).text} sub={`${tot("contacted")} de ${tot("leads")}`} />
        <Kpi label="Citas" value={tot("apTotal")} href="/panel/citas?view=month" />
        {showSales && <Kpi label="Ventas" value={tot("sales")} href={`/panel/ventas${keep}`} />}
        {showSales && <Kpi label="Monto vendido" value={clp(tot("revenue"))} exact={tot("revenue")} href={`/panel/ventas${keep}`} />}
        {showMargin && <Kpi label="Margen bruto" value={clp(tot("margin"))} exact={tot("margin")} href={`/panel/finanzas/libro${keep}`} />}
      </div>
      {perBranch.length === 0 ? <Card><Empty title="Sin sucursales visibles" /></Card> : (
        <>
          <Card title="Actividad comercial por sucursal" bodyClass="p-0" className="mb-4">
            <Table>
              <thead><tr><th>Sucursal</th><th className="text-right">Leads</th><th className="text-right">Contactados</th><th className="text-right">Citas</th><th className="text-right">Completadas</th><th className="text-right">Canceladas</th><th className="text-right">Informes hoy</th>{showSales && <th className="text-right">Ventas</th>}{showSales && <th className="text-right">Monto</th>}{showMargin && <th className="text-right">Margen</th>}</tr></thead>
              <tbody>{perBranch.map((x) => (
                <tr key={x.b.id}>
                  <td className="font-medium">{x.b.name}</td>
                  <td className="text-right tabular-nums"><Link className="link" href={`/panel/leads${qs(s, { branch: x.b.id })}`}>{x.leads}</Link></td>
                  <td className="text-right tabular-nums">{x.contacted} <span className="text-xs text-muted">({rate(x.contacted, x.leads).text})</span></td>
                  <td className="text-right tabular-nums">{x.apTotal}</td>
                  <td className="text-right tabular-nums">{x.ap.COMPLETADA ?? 0}</td>
                  <td className="text-right tabular-nums">{x.ap.CANCELADA ?? 0}</td>
                  <td className="text-right tabular-nums"><Link className="link" href="/panel/informe-diario">{x.reportsSent}/{x.reportsDue}</Link></td>
                  {showSales && <td className="text-right tabular-nums"><Link className="link" href={`/panel/ventas${qs(s, { branch: x.b.id })}`}>{x.sales}</Link></td>}
                  {showSales && <td className="text-right"><Link className="link" href={`/panel/ventas${qs(s, { branch: x.b.id })}`}><Money v={x.revenue} /></Link></td>}
                  {showMargin && <td className="text-right"><Link className="link" href={`/panel/finanzas/libro${qs(s, { branch: x.b.id })}`}><Money v={x.margin} /></Link> <span className="text-xs text-muted">{rate(x.margin, x.revenue).text}</span></td>}
                </tr>
              ))}</tbody>
            </Table>
          </Card>
          <div className="grid gap-4 lg:grid-cols-2">
            {perBranch.map((x) => {
              const items: [string, number, string, "red" | "amber"][] = [
                ["Seguimientos vencidos", x.followOver, `/panel/crm${qs(s, { branch: x.b.id, scope: "all" }, [])}`, "red"],
                [`Leads sin contacto > ${notices.noContactHours} h`, x.noContact, `/panel/crm${qs(s, { branch: x.b.id, stage: "NUEVO", scope: "all" }, [])}`, "red"],
                ["Leads sin vendedor", x.unassigned, `/panel/leads${qs(s, { branch: x.b.id }, [])}`, "amber"],
                ["Citas pasadas sin cerrar", x.apptOver, "/panel/citas?view=agenda", "amber"],
                ["Vendedores inactivos", x.inactive.length, `/panel/equipo?branch=${x.b.id}`, "red"],
                ["Informes diarios pendientes", x.reportsDue - x.reportsSent, "/panel/informe-diario", "amber"],
              ];
              const active = items.filter((i) => i[1] > 0);
              return (
                <Card key={x.b.id} title={`Excepciones · ${x.b.name}`} sub="Estado actual" bodyClass="p-0">
                  {active.length === 0 ? <Empty compact title="Sin excepciones" /> : (
                    <ul>{active.map(([l, v, h, t]) => (
                      <li key={l}><Link href={h} className="flex items-center justify-between gap-2 border-b border-line px-4 py-2 text-sm last:border-0 hover:bg-surface-2"><span>{l}</span><Badge tone={t}>{v}</Badge></Link></li>
                    ))}</ul>
                  )}
                  {x.inactive.length > 0 && <p className="border-t border-line px-4 py-2 text-xs text-muted">Inactivos: {x.inactive.map((r) => r.seller.name).join(", ")}</p>}
                </Card>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
