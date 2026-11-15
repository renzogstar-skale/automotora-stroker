import Link from "next/link";
import { Plus } from "lucide-react";
import { guard } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { parsePeriod, sp, qs } from "@/lib/period";
import { clp, date } from "@/lib/format";
import { DELIVERY, PAY_LABEL } from "@/lib/labels";
import { salesWithEcon } from "@/server/economics";
import { Badge, Card, Empty, Kpi, Money, PageHeader, StatusBadge, Table } from "@/components/ui";
import { PeriodFilter, effectiveBranches } from "@/components/filters";

type SP = Promise<Record<string, string | string[] | undefined>>;
export default async function Sales({ searchParams }: { searchParams: SP }) {
  const a = await guard("sales");
  const s = await searchParams;
  const p = parsePeriod(s);
  const b = effectiveBranches(a, s);
  const q = sp(s, "q")?.trim();
  const showCost = can(a, "inventory.cost");
  let rows = await salesWithEcon({ saleDate: { gte: p.from, lt: p.to }, ...(b ? { branchId: { in: b } } : {}), ...(a.role === "VENDEDOR" ? { sellerId: a.sellerId ?? "-" } : {}) });
  if (q) {
    const n = q.replace(/\D/g, "");
    rows = rows.filter((x) => [x.contact.name, x.seller.name, x.vehicle.brand, x.vehicle.model, x.vehicle.plate].some((f) => f.toLowerCase().includes(q.toLowerCase())) || (n && (String(x.finalPrice).includes(n) || String(x.number) === n)));
  }
  const ok = rows.filter((x) => x.status === "CONFIRMADA");
  const sum = (f: (x: (typeof ok)[number]) => number) => ok.reduce((t, x) => t + f(x), 0);
  return (
    <>
      <PageHeader title="Ventas" desc="Ventas, Libro de Ventas y Comisiones consultan la misma operación." actions={can(a, "sales.edit") && <Link className="btn btn-primary" href="/panel/ventas/nueva"><Plus className="size-4" />Nueva venta</Link>} />
      <PeriodFilter a={a} s={s} extra={<label><span className="label">Buscar</span><input name="q" defaultValue={q} placeholder="Cliente, vendedor, vehículo o monto" className="input w-60" /></label>} />
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-5">
        <Kpi label="Unidades" value={ok.length} sub={rows.length > ok.length ? `${rows.length - ok.length} anuladas excluidas` : undefined} />
        <Kpi label="Monto vendido" value={<Money v={sum((x) => x.finalPrice)} />} />
        {showCost && <><Kpi label="Margen antes de gastos directos" value={<Money v={sum((x) => x.econ.margin)} />} />
        <Kpi label="Gastos directos" value={<Money v={sum((x) => x.econ.direct)} />} sub="Preparación + gastos de la venta" />
        <Kpi label="Utilidad final" value={<Money v={sum((x) => x.econ.profit)} />} sub="Después de comisiones" href={`/panel/finanzas/libro${qs(s)}`} /></>}
      </div>
      <Card bodyClass="p-0">
        {rows.length === 0 ? <Empty title="Sin ventas en el período" /> : (
          <Table><thead><tr><th>#</th><th>Fecha</th><th>Cliente</th><th>Vehículo</th><th>Vendedor</th><th>Pago</th><th className="num">Precio</th><th className="num">Descuento</th><th className="num">Saldo</th>{showCost && <th className="num">Utilidad</th>}<th>Entrega</th></tr></thead><tbody>
            {rows.map((x) => (
              <tr key={x.id} className={x.status === "ANULADA" ? "opacity-55" : ""}>
                <td><Link className="link" href={`/panel/ventas/${x.id}?back=${encodeURIComponent(`/panel/ventas${qs(s, { q })}`)}`}>#{x.number}</Link></td><td>{date(x.saleDate)}</td><td>{x.contact.name}</td>
                <td>{x.vehicle.brand} {x.vehicle.model} <span className="text-xs text-muted">{x.vehicle.plate}</span>{x.ownership === "CONSIGNADO" && <Badge tone="violet" icon={false} className="ml-1">Consig.</Badge>}</td>
                <td>{x.seller.name}</td><td className="text-xs">{PAY_LABEL[x.payMethod]}</td>
                <td className="num">{clp(x.finalPrice)}</td><td className="num">{clp(x.discount)}</td>
                <td className="num">{x.status === "ANULADA" ? <Badge tone="red">Anulada</Badge> : x.econ.balance > 0 ? <span className="text-amber-700 dark:text-amber-400">{clp(x.econ.balance)}</span> : <Badge tone="green">Pagada</Badge>}</td>
                {showCost && <td className="num">{clp(x.econ.profit)}</td>}
                <td><StatusBadge map={DELIVERY} value={x.delivery} /></td>
              </tr>))}
          </tbody></Table>)}
      </Card>
    </>
  );
}
