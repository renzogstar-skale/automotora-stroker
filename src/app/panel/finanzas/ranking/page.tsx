import Link from "next/link";
import { guard } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { parsePeriod, sp, qs } from "@/lib/period";
import { clp, pct } from "@/lib/format";
import { salesLite, type SaleLite } from "@/server/economics";
import { Badge, Card, Empty, PageHeader, Table, Tabs } from "@/components/ui";
import { PeriodFilter, effectiveBranches } from "@/components/filters";

export default async function Ranking({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const a = await guard("ranking");
  const s = await searchParams;
  const tab = sp(s, "tab") ?? "ventas", hist = sp(s, "hist") === "1";
  const p = parsePeriod(s);
  const from = hist ? new Date(0) : p.from, to = hist ? new Date(8.64e15) : p.to;
  const b = effectiveBranches(a, s);
  const bw = b ? { branchId: { in: b } } : {};
  const cur: SaleLite[] = await salesLite({ status: "CONFIRMADA", saleDate: { gte: from, lt: to }, ...bw });
  const prev: SaleLite[] = hist ? [] : await salesLite({ status: "CONFIRMADA", saleDate: { gte: p.prev.from, lt: p.prev.to }, ...bw });
  const sellers = await db.seller.findMany({ where: bw, include: { branch: true } });
  const cons = await db.consignment.findMany({ where: { startDate: { gte: from, lt: to }, ...(b ? { vehicle: { branchId: { in: b } } } : {}) }, select: { responsibleId: true, modality: true, status: true } });
  const showMargin = can(a, "inventory.cost");
  const rows = sellers.map((x) => {
    const mine = cur.filter((v) => v.sellerId === x.id), before = prev.filter((v) => v.sellerId === x.id);
    const amount = mine.reduce((t, v) => t + v.finalPrice, 0), prevAmount = before.reduce((t, v) => t + v.finalPrice, 0);
    const c = cons.filter((k) => k.responsibleId === x.id);
    return { x, units: mine.length, amount, margin: mine.reduce((t, v) => t + v.margin, 0), dUnits: mine.length - before.length, dAmount: prevAmount ? (amount - prevAmount) / prevAmount : null, cons: c.length, consSold: c.filter((k) => k.status === "VENDIDA" || k.status === "CERRADA").length, fis: c.filter((k) => k.modality === "FISICA").length };
  });
  const sorted = tab === "ventas" ? [...rows].sort((p1, p2) => p2.units - p1.units || p2.amount - p1.amount) : [...rows].sort((p1, p2) => p2.cons - p1.cons || p2.consSold - p1.consSold);
  return (
    <>
      <PageHeader title="Ranking de vendedores" desc={hist ? "Histórico completo" : `${p.label} · comparación contra el período anterior de igual duración`} />
      <Tabs items={[["ventas", "Ventas"], ["consignaciones", "Consignaciones"]].map(([k, l]) => ({ href: `/panel/finanzas/ranking${qs(s, { tab: k }, ["period", "ref", "from", "to", "branch", "hist"])}`, label: l, active: tab === k }))} />
      <PeriodFilter a={a} s={s} extra={<label className="flex items-end gap-1.5 pb-2 text-sm"><input type="checkbox" name="hist" value="1" defaultChecked={hist} />Histórico</label>} />
      <Card bodyClass="p-0">
        {sorted.length === 0 ? <Empty /> : tab === "ventas" ? (
          <Table><thead><tr><th>#</th><th>Vendedor</th><th>Sucursal</th><th className="num">Unidades</th><th className="num">Monto vendido</th>{showMargin && <th className="num">Margen bruto</th>}{!hist && <><th className="num">Δ unidades</th><th className="num">Δ monto</th></>}<th className="num">Consig. captadas</th></tr></thead><tbody>
            {sorted.map((r, i) => <tr key={r.x.id}><td className="font-semibold">{i + 1}</td><td><Link className="link" href={`/panel/vendedores?id=${r.x.id}`}>{r.x.name}</Link>{!r.x.active && <Badge className="ml-1">Inactivo</Badge>}</td><td>{r.x.branch.name}</td><td className="num font-semibold">{r.units}</td><td className="num">{clp(r.amount)}</td>{showMargin && <td className="num">{clp(r.margin)}</td>}{!hist && <><td className="num">{r.dUnits > 0 ? `+${r.dUnits}` : r.dUnits}</td><td className="num">{r.dAmount == null ? "Sin datos" : `${r.dAmount > 0 ? "+" : ""}${pct(r.dAmount)}`}</td></>}<td className="num">{r.cons}</td></tr>)}
          </tbody></Table>
        ) : (
          <Table><thead><tr><th>#</th><th>Vendedor</th><th className="num">Captadas</th><th className="num">Físicas</th><th className="num">Online</th><th className="num">Vendidas</th></tr></thead><tbody>
            {sorted.map((r, i) => <tr key={r.x.id}><td className="font-semibold">{i + 1}</td><td>{r.x.name}</td><td className="num font-semibold">{r.cons}</td><td className="num">{r.fis}</td><td className="num">{r.cons - r.fis}</td><td className="num">{r.consSold}</td></tr>)}
          </tbody></Table>
        )}
      </Card>
      <p className="mt-2 text-[11px] text-muted">Orden de ventas: unidades y, en empate, monto vendido. Se consolidan por ficha de vendedor (mismo identificador que su cuenta de usuario).</p>
    </>
  );
}
