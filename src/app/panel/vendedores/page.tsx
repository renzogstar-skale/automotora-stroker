import Link from "next/link";
import { guard } from "@/lib/auth";
import { db } from "@/lib/db";
import { branchWhere, can } from "@/lib/rbac";
import { sp } from "@/lib/period";
import { clp, dateTime, startOfMonth, rate } from "@/lib/format";
import { salesLite } from "@/server/economics";
import { Badge, Card, Field, PageHeader, Table } from "@/components/ui";
import { ActionForm, Submit } from "@/components/client/forms";
import { visibleBranches } from "@/components/filters";
import { sellerAction } from "./actions";

export default async function Sellers({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const a = await guard("sellers");
  const s = await searchParams;
  const m0 = startOfMonth();
  const [sellers, branches, sales, comms] = await Promise.all([
    db.seller.findMany({ where: branchWhere(a), include: { branch: true, user: { select: { email: true, active: true, lastSeenAt: true } } }, orderBy: [{ active: "desc" }, { name: "asc" }] }),
    visibleBranches(a),
    salesLite({ status: "CONFIRMADA", saleDate: { gte: m0 }, ...branchWhere(a) }),
    db.saleCommission.findMany({ where: { sale: { status: "CONFIRMADA", saleDate: { gte: m0 } } }, select: { sellerId: true, amount: true } }),
  ]);
  const acts = await db.activity.findMany({ where: { userId: { in: sellers.map((x) => x.userId).filter(Boolean) as string[] } }, select: { userId: true, createdAt: true }, orderBy: { createdAt: "desc" }, distinct: ["userId"] });
  const edit = sellers.find((x) => x.id === sp(s, "id"));
  return (
    <>
      <PageHeader title="Vendedores" desc="La ficha comercial usa el mismo identificador en ventas, citas, oportunidades y comisiones; se vincula a la cuenta de usuario." />
      <div className="grid gap-4 xl:grid-cols-3">
        <Card bodyClass="p-0" className="xl:col-span-2">
          <Table><thead><tr><th>Vendedor</th><th>Sucursal</th><th>Cuenta</th><th>Última actividad</th><th className="num">Ventas del mes / meta</th><th className="num">Monto</th><th className="num">Comisiones mes</th><th /></tr></thead><tbody>
            {sellers.map((x) => {
              const mine = sales.filter((v) => v.sellerId === x.id), g = rate(mine.length, x.monthlyGoal);
              const la = acts.find((l) => l.userId === x.userId)?.createdAt;
              return <tr key={x.id} className={x.active ? "" : "opacity-55"}>
                <td className="font-medium">{x.name}<div className="text-xs font-normal text-muted">{x.email} · {x.phone}</div></td><td>{x.branch.name}</td>
                <td>{x.user ? <Badge tone={x.user.active ? "green" : "gray"}>{x.user.active ? "Vinculada" : "Desactivada"}</Badge> : <Badge tone="amber">Sin cuenta</Badge>}</td>
                <td className="text-xs">{dateTime(la ?? x.user?.lastSeenAt)}</td>
                <td className="num"><b>{mine.length}</b> / {x.monthlyGoal} <span className="text-xs text-muted">({g.text})</span></td>
                <td className="num">{clp(mine.reduce((t, v) => t + v.finalPrice, 0))}</td>
                <td className="num">{can(a, "commissions") || can(a, "inventory.cost") ? clp(comms.filter((c) => c.sellerId === x.id).reduce((t, c) => t + c.amount, 0)) : "—"}</td>
                <td className="whitespace-nowrap text-xs"><Link className="link" href={`?id=${x.id}`}>Editar</Link> · <Link className="link" href={`/panel/crm?seller=${x.id}`}>CRM</Link></td>
              </tr>;
            })}
          </tbody></Table>
        </Card>
        <Card title={edit ? `Editar ficha · ${edit.name}` : "Nueva ficha de vendedor"}>
          <ActionForm action={sellerAction} className="grid grid-cols-2 gap-2 space-y-0">
            {edit && <input type="hidden" name="id" value={edit.id} />}
            <Field label="Nombre" className="col-span-2"><input name="name" defaultValue={edit?.name} required className="input" /></Field>
            <Field label="Correo"><input name="email" type="email" defaultValue={edit?.email} required className="input" /></Field>
            <Field label="Teléfono"><input name="phone" defaultValue={edit?.phone} className="input" /></Field>
            <Field label="Sucursal"><select name="branchId" defaultValue={edit?.branchId} className="input">{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
            <Field label="Meta mensual (unidades)"><input name="goal" type="number" min={1} defaultValue={edit?.monthlyGoal ?? 5} className="input" /></Field>
            <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={edit?.active ?? true} />Activo</label>
            <div className="col-span-2 flex justify-end gap-2">{edit && <Link href="?" className="btn">Nueva</Link>}<Submit>Guardar</Submit></div>
          </ActionForm>
          <p className="mt-2 text-[11px] text-muted">Para dar acceso, invita al usuario en Sistema → Usuarios y elige esta ficha.</p>
        </Card>
      </div>
    </>
  );
}
