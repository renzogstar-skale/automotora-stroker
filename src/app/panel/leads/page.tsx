import Link from "next/link";
import { Download, Pencil } from "lucide-react";
import { guard } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, branchScope } from "@/lib/rbac";
import { sp, qs } from "@/lib/period";
import { STAGES, STAGE_LABEL, STAGE_TONE, SOURCE_LABEL, OPP_TYPE_LABEL } from "@/lib/labels";
import { clp, date } from "@/lib/format";
import { Badge, Card, Empty, PageHeader, Pagination, Table } from "@/components/ui";
import { CsvImport } from "@/components/client/csv-import";
import { oppWhere } from "../crm/query";
import { commitImport, validateImport } from "./actions";

type SP = Promise<Record<string, string | string[] | undefined>>;
const KEEP = ["q", "type", "stage", "source", "seller", "branch", "from", "to", "scope", "all"];
export default async function Leads({ searchParams }: { searchParams: SP }) {
  const a = await guard("crm");
  const s = await searchParams;
  const page = Math.max(1, +(sp(s, "page") ?? 1));
  const where = oppWhere(a, s, { ignoreType: !sp(s, "type") });
  const bs = branchScope(a);
  const [total, rows, branches] = await Promise.all([
    db.opportunity.count({ where }),
    db.opportunity.findMany({ where, include: { contact: true, seller: true, branch: true }, orderBy: { createdAt: "desc" }, skip: (page - 1) * 30, take: 30 }),
    db.branch.findMany({ where: bs ? { id: { in: bs } } : {} }),
  ]);
  const filterQs = qs(s, {}, KEEP);
  return (
    <>
      <PageHeader title="Leads" desc={`${total} registros con los filtros actuales`}
        actions={can(a, "leads.export") ? <a href={`/api/export/leads${filterQs}`} className="btn"><Download className="size-4" />Exportar CSV filtrado</a> : null} />
      <form className="card mb-3 grid grid-cols-2 gap-2 p-3 md:grid-cols-4 xl:grid-cols-7" method="get">
        <input name="q" defaultValue={sp(s, "q")} placeholder="Buscar contacto" className="input col-span-2" aria-label="Buscar" />
        <select name="type" defaultValue={sp(s, "type") ?? ""} className="input" aria-label="Tipo"><option value="">Todos los tipos</option>{Object.entries(OPP_TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <select name="stage" defaultValue={sp(s, "stage") ?? ""} className="input" aria-label="Etapa"><option value="">Etapa</option>{STAGES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <select name="source" defaultValue={sp(s, "source") ?? ""} className="input" aria-label="Origen"><option value="">Origen</option>{Object.entries(SOURCE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <input type="date" name="from" defaultValue={sp(s, "from")} className="input" aria-label="Desde" />
        <div className="flex gap-2"><input type="date" name="to" defaultValue={sp(s, "to")} className="input" aria-label="Hasta" /><button className="btn btn-dark">Filtrar</button></div>
      </form>
      <Card bodyClass="p-0">
        {rows.length === 0 ? <Empty title="Sin leads con estos filtros" /> : (
          <Table><thead><tr><th>Contacto</th><th>Teléfono / correo</th><th>Tipo</th><th>Etapa</th><th>Origen</th><th>Vendedor</th><th>Sucursal</th><th className="num">Presupuesto</th><th>Creado</th><th /></tr></thead><tbody>
            {rows.map((o) => (
              <tr key={o.id}>
                <td className="font-medium">{o.contact.name}{o.contact.rut && <div className="text-xs font-normal text-muted">{o.contact.rut}</div>}</td>
                <td className="text-xs">{o.contact.phone}<div className="text-muted">{o.contact.email}</div></td>
                <td>{OPP_TYPE_LABEL[o.type]}</td><td><Badge tone={STAGE_TONE[o.stage]}>{STAGE_LABEL[o.stage]}</Badge></td>
                <td>{SOURCE_LABEL[o.source]}</td><td>{o.seller?.name ?? "—"}</td><td>{o.branch.name}</td>
                <td className="num">{clp(o.budget)}</td><td className="text-muted">{date(o.createdAt)}</td>
                <td><Link href={`/panel/crm/${o.id}`} className="btn btn-ghost btn-sm" aria-label="Editar"><Pencil className="size-3.5" /></Link></td>
              </tr>))}
          </tbody></Table>)}
        <Pagination page={page} pages={Math.ceil(total / 30)} href={(p) => `/panel/leads${qs(s, { page: String(p) }, KEEP)}`} />
      </Card>
      {can(a, "leads.import") && (
        <Card title="Importar leads desde CSV" sub="Vista previa, validación por fila y detección de duplicados antes de importar" className="mt-4">
          <CsvImport branches={branches} validate={validateImport} commit={commitImport} />
        </Card>
      )}
    </>
  );
}
