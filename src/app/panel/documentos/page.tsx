import Link from "next/link";
import { guard } from "@/lib/auth";
import { db } from "@/lib/db";
import { branchWhere, can, oppScope } from "@/lib/rbac";
import { sp } from "@/lib/period";
import { DOC_STATUS, DOC_TYPE } from "@/lib/labels";
import { clp, date, dateTime, km } from "@/lib/format";
import { docScope } from "@/server/documents";
import { Card, Empty, PageHeader, StatusBadge, Table, Tabs } from "@/components/ui";
import { ActionForm, Submit } from "@/components/client/forms";
import { DocForm, type RefOption } from "./doc-form";
import { createDocAction, templateAction } from "./actions";

export default async function Docs({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const a = await guard("documents");
  const s = await searchParams;
  const t0 = sp(s, "tab") ?? "documentos";
  const tab = t0 === "plantillas" && !can(a, "documents.templates") ? "documentos" : t0;
  const f = { cliente: sp(s, "cliente")?.trim(), patente: sp(s, "patente")?.toUpperCase().replace(/[^A-Z0-9]/g, ""), vehiculo: sp(s, "vehiculo")?.trim(), folio: sp(s, "folio")?.trim(), tipo: sp(s, "tipo") };
  const ci = "insensitive" as const;
  const vWords = f.vehiculo?.split(/\s+/).filter(Boolean) ?? [];
  const where = {
    AND: [
      docScope(a),
      tab === "historial" ? { status: { in: ["EMITIDO", "ANULADO"] } } : tab === "documentos" ? { status: "BORRADOR" } : {},
      f.cliente ? { clientName: { contains: f.cliente, mode: ci } } : {},
      f.patente ? { plate: { contains: f.patente } } : {},
      f.folio ? { folio: { contains: f.folio, mode: ci } } : {},
      f.tipo && DOC_TYPE[f.tipo] ? { type: f.tipo } : {},
      ...vWords.map((w) => ({ OR: [{ vehicle: { OR: [{ brand: { contains: w, mode: ci } }, { model: { contains: w, mode: ci } }] } }, { data: { path: ["vehiculo", "marca"], string_contains: w } }, { data: { path: ["vehiculo", "modelo"], string_contains: w } }] })),
    ],
  };
  const showForm = tab === "documentos" || !!sp(s, "nuevo");
  const vb = branchWhere(a), op = oppScope(a);
  const [docs, templates, reservations, sales, consignments, vehicles, contacts] = await Promise.all([
    tab === "plantillas" ? [] : db.document.findMany({ where, include: { vehicle: { select: { brand: true, model: true, year: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    tab === "plantillas" ? db.documentTemplate.findMany({ include: { versions: { orderBy: { version: "desc" }, take: 5 } } }) : [],
    showForm ? db.reservation.findMany({ where: { vehicle: vb, ...(a.role === "VENDEDOR" ? { sellerId: a.sellerId ?? "__none__" } : {}) }, include: { contact: true, vehicle: true }, orderBy: { createdAt: "desc" }, take: 60 }) : [],
    showForm ? db.sale.findMany({ where: { vehicle: vb, ...(a.role === "VENDEDOR" ? { sellerId: a.sellerId ?? "__none__" } : {}) }, include: { contact: true, vehicle: true }, orderBy: { createdAt: "desc" }, take: 60 }) : [],
    showForm && can(a, "consignments") ? db.consignment.findMany({ where: { vehicle: vb }, include: { owner: true, vehicle: true }, orderBy: { createdAt: "desc" }, take: 60 }) : [],
    showForm ? db.vehicle.findMany({ where: vb, orderBy: { createdAt: "desc" }, take: 300 }) : [],
    showForm ? db.contact.findMany({ where: a.role === "ADMIN" ? {} : { OR: [{ opportunities: { some: op } }, { consignments: { some: { vehicle: vb } } }] }, orderBy: { name: "asc" }, take: 500 }) : [],
  ]);
  const vLabel = (v: { brand: string; model: string; year: number; plate: string }) => `${v.brand} ${v.model} ${v.year} · ${v.plate}`;
  const refs: RefOption[] = [
    ...reservations.map((r) => ({ type: "RESERVA", value: `reservation:${r.id}`, label: `Reserva ${r.status.toLowerCase()} · ${r.contact.name} · ${vLabel(r.vehicle)} · ${date(r.createdAt)}` })),
    ...sales.map((x) => ({ type: "VENTA", value: `sale:${x.id}`, label: `Venta N° ${x.number} · ${x.contact.name} · ${vLabel(x.vehicle)}` })),
    ...consignments.map((x) => ({ type: "CONSIGNACION", value: `consignment:${x.id}`, label: `Consignación · ${x.owner.name} · ${vLabel(x.vehicle)}` })),
    ...vehicles.map((v) => ({ type: "*", value: `vehicle:${v.id}`, label: `Solo vehículo · ${vLabel(v)}` })),
  ];
  const pre = { vehicle: sp(s, "vehicle"), sale: sp(s, "sale"), consignment: sp(s, "consignment"), reservation: sp(s, "reservation") };
  const preType = pre.sale ? "VENTA" : pre.consignment ? "CONSIGNACION" : pre.reservation ? "RESERVA" : "VENTA";
  return (
    <>
      <PageHeader title="Documentos" desc="Ventas, reservas y consignaciones con folio único, borrador, vista previa y PDF." />
      <Tabs items={[["documentos", "Documentos"], ["historial", "Historial"], ...(can(a, "documents.templates") ? [["plantillas", "Plantillas"]] : [])].map(([k, l]) => ({ href: `/panel/documentos?tab=${k}`, label: l, active: tab === k }))} />
      {tab !== "plantillas" && (
        <>
          {showForm && (
            <Card title="Generar documento" sub="El folio se asigna al crear el borrador; los datos quedan editables hasta emitir." className="mb-4">
              <DocForm action={createDocAction} refs={refs} pre={pre} preType={preType}
                contacts={contacts.map((c) => ({ name: c.name, rut: c.rut ?? "", phone: c.phone ?? "", email: c.email ?? "" }))}
                vehicles={vehicles.map((v) => ({ plate: v.plate, brand: v.brand, model: v.model, version: v.version, year: v.year, vin: v.vin ?? "", km: km(v.km), color: v.color, price: clp(v.price) }))} />
            </Card>
          )}
          <form className="mb-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6" method="get">
            <input type="hidden" name="tab" value={tab} />
            <input name="cliente" defaultValue={f.cliente} placeholder="Cliente" className="input" aria-label="Filtrar por cliente" />
            <input name="patente" defaultValue={f.patente} placeholder="Patente" className="input uppercase" aria-label="Filtrar por patente" />
            <input name="vehiculo" defaultValue={f.vehiculo} placeholder="Vehículo (marca, modelo)" className="input" aria-label="Filtrar por vehículo" />
            <input name="folio" defaultValue={f.folio} placeholder="Folio" className="input" aria-label="Filtrar por folio" />
            <select name="tipo" defaultValue={f.tipo ?? ""} className="input" aria-label="Filtrar por tipo"><option value="">Todos los tipos</option>{Object.entries(DOC_TYPE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            <div className="flex gap-2"><button className="btn btn-dark flex-1">Filtrar</button><Link className="btn" href={`/panel/documentos?tab=${tab}`}>Limpiar</Link></div>
          </form>
          <Card bodyClass="p-0">
            {docs.length === 0 ? <Empty title={tab === "historial" ? "Sin documentos emitidos" : "Sin borradores"} /> : (
              <Table><thead><tr><th>Folio</th><th>Tipo</th><th>Cliente</th><th>Vehículo</th><th>Patente</th><th>Plantilla</th><th>Estado</th><th>Fecha</th><th /></tr></thead><tbody>
                {docs.map((d) => <tr key={d.id}><td><Link className="link" href={`/panel/documentos/${d.id}`}>{d.folio}</Link></td><td>{DOC_TYPE[d.type]}</td><td>{d.clientName ?? "—"}</td><td>{d.vehicle ? `${d.vehicle.brand} ${d.vehicle.model} ${d.vehicle.year}` : (() => { const x = (d.data as { vehiculo?: { marca?: string; modelo?: string } }).vehiculo; return [x?.marca, x?.modelo].filter(Boolean).join(" ") || "—"; })()}</td><td>{d.plate ?? "—"}</td><td>{d.status === "BORRADOR" ? "vigente" : `v${d.templateVersion}`}</td><td><StatusBadge map={DOC_STATUS} value={d.status} /></td><td>{dateTime(d.emittedAt ?? d.createdAt)}</td><td><a className="text-xs link" href={`/api/documents/${d.id}/pdf`} target="_blank">PDF</a></td></tr>)}
              </tbody></Table>)}
          </Card>
        </>
      )}
      {tab === "plantillas" && (
        <div className="space-y-4">
          <p className="text-sm text-muted">Textos demo editables. Campos disponibles: {"{{folio}} {{fecha}} {{empresa.nombre}} {{cliente.nombre}} {{cliente.rut}} {{vehiculo.marca}} {{vehiculo.modelo}} {{vehiculo.patente}} {{vehiculo.vin}} {{venta.precio}} {{reserva.monto}} {{consignacion.monto_acordado}}"}…</p>
          {templates.map((t) => (
            <Card key={t.id} title={`${t.name} · v${t.version}`} sub={`Versiones: ${t.versions.map((v) => `v${v.version} (${dateTime(v.createdAt)})`).join(", ")}`}>
              <ActionForm action={templateAction}>
                <input type="hidden" name="id" value={t.id} />
                <input name="name" defaultValue={t.name} className="input" aria-label="Nombre" />
                <textarea name="body" defaultValue={t.body} rows={10} className="input font-mono text-xs" aria-label="Texto" />
                <div className="flex justify-end"><Submit>Guardar nueva versión</Submit></div>
              </ActionForm>
            </Card>))}
        </div>
      )}
    </>
  );
}
