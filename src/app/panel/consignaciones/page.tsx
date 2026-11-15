import Link from "next/link";
import { Plus } from "lucide-react";
import { guard } from "@/lib/auth";
import { db } from "@/lib/db";
import { sp } from "@/lib/period";
import { CONS_STATUS } from "@/lib/labels";
import { clp, date, nowMs } from "@/lib/format";
import { Card, Empty, Kpi, PageHeader, StatusBadge, Table, Tabs } from "@/components/ui";

export default async function Consignments({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const a = await guard("consignments");
  const s = await searchParams;
  const st = sp(s, "estado");
  const vb = a.role === "ADMIN" ? {} : { vehicle: { branchId: { in: a.branchIds } } };
  const all = await db.consignment.findMany({ where: vb, include: { owner: true, responsible: true, payouts: true, vehicle: { include: { sales: { where: { status: "CONFIRMADA" } }, branch: true } } }, orderBy: { startDate: "desc" } });
  const rows = st ? all.filter((c) => c.status === st) : all;
  const pend = (c: (typeof all)[number]) => (c.vehicle.sales[0]?.costBasis ?? 0) - c.payouts.reduce((t, p) => t + p.amount, 0);
  const totalPend = all.filter((c) => c.status === "VENDIDA").reduce((t, c) => t + pend(c), 0);
  return (
    <>
      <PageHeader title="Consignaciones" actions={<Link href="/panel/tasacion" className="btn btn-primary"><Plus className="size-4" />Nueva (desde tasación)</Link>} />
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <Kpi label="Vigentes" value={all.filter((c) => c.status === "VIGENTE").length} />
        <Kpi label="Por vencer (7 días)" value={all.filter((c) => c.status === "VIGENTE" && c.endDate.getTime() < nowMs() + 7 * 864e5).length} />
        <Kpi label="Vendidas por liquidar" value={all.filter((c) => c.status === "VENDIDA").length} />
        <Kpi label="Saldo pendiente a propietarios" value={clp(totalPend)} exact={totalPend} />
      </div>
      <Tabs items={[{ k: undefined as string | undefined, l: "Todas" }, ...Object.entries(CONS_STATUS).map(([k, [l]]) => ({ k, l }))].map((t) => ({ href: `/panel/consignaciones${t.k ? `?estado=${t.k}` : ""}`, label: t.l, active: st === t.k, count: t.k ? all.filter((c) => c.status === t.k).length : all.length }))} />
      <Card bodyClass="p-0">
        {rows.length === 0 ? <Empty /> : (
          <Table><thead><tr><th>Vehículo</th><th>Propietario</th><th>Modalidad</th><th className="num">Precio publicado</th><th className="num">Acordado propietario</th><th className="num">Comisión</th><th>Vigencia</th><th>Docs</th><th>Responsable</th><th>Estado</th><th className="num">Por liquidar</th></tr></thead><tbody>
            {rows.map((c) => {
              const docs = Object.values(c.documents as Record<string, boolean>);
              return <tr key={c.id}><td><Link className="font-medium hover:text-accent" href={`/panel/consignaciones/${c.id}`}>{c.vehicle.brand} {c.vehicle.model} {c.vehicle.year}</Link><div className="text-xs text-muted">{c.vehicle.plate} · {c.vehicle.branch.name}</div></td><td>{c.owner.name}</td><td>{c.modality === "FISICA" ? "Física" : "Online"}</td><td className="num">{clp(c.vehicle.price)}</td><td className="num">{clp(c.agreedPrice)}</td><td className="num">{clp(c.vehicle.price - c.agreedPrice)}</td><td className="text-xs">{date(c.startDate)} → {date(c.endDate)}</td><td className="text-xs">{docs.filter(Boolean).length}/5</td><td>{c.responsible?.name ?? "—"}</td><td><StatusBadge map={CONS_STATUS} value={c.status} /></td><td className="num">{c.status === "VENDIDA" ? clp(pend(c)) : "—"}</td></tr>;
            })}
          </tbody></Table>)}
      </Card>
    </>
  );
}
