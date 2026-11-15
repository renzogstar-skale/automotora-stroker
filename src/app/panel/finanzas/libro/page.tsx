import Link from "next/link";
import { guard } from "@/lib/auth";
import { parsePeriod } from "@/lib/period";
import { clp, date } from "@/lib/format";
import { salesWithEcon } from "@/server/economics";
import { Badge, Empty, PageHeader } from "@/components/ui";
import { PeriodFilter, effectiveBranches } from "@/components/filters";

const H = ({ c, k }: { c: string; k: "i" | "c" }) => <th className="num">{c}<div className="text-[10px] font-normal uppercase">{k === "i" ? "ingresado" : "calculado"}</div></th>;
export default async function Book({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const a = await guard("inventory.cost");
  const s = await searchParams;
  const p = parsePeriod(s);
  const b = effectiveBranches(a, s);
  const rows = await salesWithEcon({ status: "CONFIRMADA", saleDate: { gte: p.from, lt: p.to }, ...(b ? { branchId: { in: b } } : {}) });
  const tot = rows.reduce((t, x) => ({ fp: t.fp + x.finalPrice, cb: t.cb + x.costBasis, ex: t.ex + x.extraIncome, pr: t.pr + x.econ.prep, di: t.di + x.econ.directOnly, mg: t.mg + x.econ.margin, co: t.co + x.econ.sellerComm, rp: t.rp + x.econ.split, pf: t.pf + x.econ.profit, bl: t.bl + x.econ.balance }), { fp: 0, cb: 0, ex: 0, pr: 0, di: 0, mg: 0, co: 0, rp: 0, pf: 0, bl: 0 });
  return (
    <>
      <PageHeader title="Libro de Ventas" desc="Un asiento por venta, creado en la misma transacción que la confirma. Misma operación que Ventas y Comisiones; anuladas excluidas." />
      <PeriodFilter a={a} s={s} />
      <div className="card overflow-x-auto">
        {rows.length === 0 ? <Empty title="Sin ventas en el período" /> : (
          <table className="tbl"><thead><tr><th>Asiento</th><th>Venta</th><th>Fecha</th><th>Vehículo</th><th>Tipo</th><H c="Precio final" k="i" /><H c="Costo / a liquidar" k="i" /><H c="Ingresos adicionales" k="i" /><H c="Margen bruto" k="c" /><H c="Preparación" k="i" /><H c="Gastos directos" k="i" /><H c="Comisiones" k="c" /><H c="Reparto" k="c" /><H c="Utilidad final" k="c" /><H c="Saldo por cobrar" k="c" /></tr></thead>
            <tbody>
              {rows.map((x) => (
                <tr key={x.id}>
                  <td className="text-xs text-muted">{x.bookEntry ? `L-${String(x.bookEntry.number).padStart(5, "0")}` : "—"}</td><td><Link className="link" href={`/panel/ventas/${x.id}`}>#{x.number}</Link></td><td className="whitespace-nowrap">{date(x.saleDate)}</td>
                  <td>{x.vehicle.brand} {x.vehicle.model} <span className="text-xs text-muted">{x.vehicle.plate}</span></td>
                  <td>{x.ownership === "PROPIO" ? "Propio" : <Badge tone="violet" icon={false}>Consignado {x.consModality === "ONLINE" ? "online" : "físico"}</Badge>}</td>
                  <td className="num">{clp(x.finalPrice)}</td><td className="num">{clp(x.costBasis)}</td><td className="num">{clp(x.extraIncome)}</td>
                  <td className="num font-medium">{clp(x.econ.margin)}</td><td className="num">{clp(x.econ.prep)}</td><td className="num">{clp(x.econ.directOnly)}</td>
                  <td className="num"><Link className="hover:underline" href={`/panel/finanzas/comisiones?sale=${x.id}`}>{clp(x.econ.sellerComm)}</Link></td><td className="num"><Link className="hover:underline" href={`/panel/finanzas/comisiones?sale=${x.id}`}>{clp(x.econ.split)}</Link></td>
                  <td className="num font-semibold">{clp(x.econ.profit)}</td><td className="num">{x.econ.balance ? clp(x.econ.balance) : "—"}</td>
                </tr>))}
              <tr className="bg-surface-2 font-semibold"><td colSpan={5}>Total ({rows.length})</td><td className="num">{clp(tot.fp)}</td><td className="num">{clp(tot.cb)}</td><td className="num">{clp(tot.ex)}</td><td className="num">{clp(tot.mg)}</td><td className="num">{clp(tot.pr)}</td><td className="num">{clp(tot.di)}</td><td className="num">{clp(tot.co)}</td><td className="num">{clp(tot.rp)}</td><td className="num">{clp(tot.pf)}</td><td className="num">{clp(tot.bl)}</td></tr>
            </tbody></table>)}
      </div>
      <p className="mt-2 text-[11px] text-muted">Margen bruto = precio final − costo de adquisición (propio) o monto a liquidar al propietario (consignado) + ingresos adicionales. Comisiones = vendedor y captador; reparto = gerencia y participaciones, según las reglas congeladas al cierre (ver bases en cada venta). Utilidad final = margen bruto − preparación − gastos directos − comisiones − reparto. «Ingresado» = dato de la operación; «calculado» = derivado.</p>
    </>
  );
}
