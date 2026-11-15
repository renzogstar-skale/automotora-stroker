import Link from "next/link";
import { guard } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, oppScope, branchWhere } from "@/lib/rbac";
import { STAGE_LABEL, VEHICLE_STATUS } from "@/lib/labels";
import { clp } from "@/lib/format";
import { Card, Empty, PageHeader, StatusBadge, Badge } from "@/components/ui";

/** Búsqueda global con los mismos filtros de permisos que cada módulo. */
export default async function Search({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const a = await guard();
  const q = ((await searchParams).q ?? "").trim();
  const ci = { contains: q, mode: "insensitive" as const };
  const plateQ = q.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const [opps, vehicles, docs, sales] = q.length < 2 ? [[], [], [], []] : await Promise.all([
    can(a, "crm") ? db.opportunity.findMany({ where: { ...oppScope(a), deletedAt: null, contact: { OR: [{ name: ci }, { phone: { contains: q } }, { email: ci }, { rut: { contains: q } }] } }, include: { contact: true }, take: 10 }) : [],
    can(a, "inventory") ? db.vehicle.findMany({ where: { ...branchWhere(a), OR: [{ plate: { contains: plateQ || q } }, { brand: ci }, { model: ci }, { vin: ci }] }, take: 10 }) : [],
    can(a, "documents") ? db.document.findMany({ where: { ...(a.role === "ADMIN" ? {} : { branchId: { in: a.branchIds } }), OR: [{ folio: ci }, { clientName: ci }, { plate: { contains: plateQ || q } }] }, take: 10 }) : [],
    can(a, "sales") ? db.sale.findMany({ where: { ...branchWhere(a), ...(a.role === "VENDEDOR" ? { sellerId: a.sellerId ?? "-" } : {}), OR: [{ contact: { name: ci } }, { vehicle: { plate: { contains: plateQ || q } } }, ...(/^\d+$/.test(q) ? [{ number: +q }, { finalPrice: +q }] : [])] }, include: { contact: true, vehicle: true }, take: 10 }) : [],
  ]);
  const total = opps.length + vehicles.length + docs.length + sales.length;
  return (
    <>
      <PageHeader title={`Resultados para «${q}»`} desc={q.length < 2 ? "Escribe al menos 2 caracteres." : `${total} coincidencias en tus módulos autorizados`} />
      {q.length >= 2 && total === 0 && <Card><Empty title="Sin coincidencias" text="Prueba con nombre, teléfono, RUT, patente o folio." /></Card>}
      <div className="grid gap-4 lg:grid-cols-2">
        {opps.length > 0 && <Card title="Clientes y oportunidades" bodyClass="p-0"><ul>{opps.map((o) => <li key={o.id} className="border-b border-line last:border-0"><Link href={`/panel/crm/${o.id}`} className="flex justify-between px-4 py-2 text-sm hover:bg-surface-2"><span>{o.contact.name}<span className="ml-2 text-muted">{o.contact.phone}</span></span><Badge>{STAGE_LABEL[o.stage]}</Badge></Link></li>)}</ul></Card>}
        {vehicles.length > 0 && <Card title="Vehículos" bodyClass="p-0"><ul>{vehicles.map((v) => <li key={v.id} className="border-b border-line last:border-0"><Link href={`/panel/inventario/${v.id}`} className="flex justify-between px-4 py-2 text-sm hover:bg-surface-2"><span>{v.brand} {v.model} {v.year} · {v.plate}</span><StatusBadge map={VEHICLE_STATUS} value={v.status} /></Link></li>)}</ul></Card>}
        {sales.length > 0 && <Card title="Ventas" bodyClass="p-0"><ul>{sales.map((s) => <li key={s.id} className="border-b border-line last:border-0"><Link href={`/panel/ventas/${s.id}`} className="flex justify-between px-4 py-2 text-sm hover:bg-surface-2"><span>#{s.number} {s.contact.name} · {s.vehicle.plate}</span><span className="tabular-nums">{clp(s.finalPrice)}</span></Link></li>)}</ul></Card>}
        {docs.length > 0 && <Card title="Documentos" bodyClass="p-0"><ul>{docs.map((d) => <li key={d.id} className="border-b border-line last:border-0"><Link href={`/panel/documentos/${d.id}`} className="flex justify-between px-4 py-2 text-sm hover:bg-surface-2"><span>{d.folio} · {d.clientName}</span><span className="text-muted">{d.plate}</span></Link></li>)}</ul></Card>}
      </div>
    </>
  );
}
