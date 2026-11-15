import { guard } from "@/lib/auth";
import { db } from "@/lib/db";
import { oppScope } from "@/lib/rbac";
import { dateTime } from "@/lib/format";
import { STAGE_LABEL } from "@/lib/labels";
import { Card, Empty, PageHeader, Table } from "@/components/ui";
import { InlineAction } from "@/components/client/forms";
import { restoreAction } from "../actions";

export default async function Trash() {
  const a = await guard("crm.trash");
  const rows = await db.opportunity.findMany({ where: { ...oppScope(a), deletedAt: { not: null } }, include: { contact: true, seller: true }, orderBy: { deletedAt: "desc" } });
  return (
    <>
      <PageHeader title="Papelera del CRM" desc="Las oportunidades eliminadas se conservan y pueden recuperarse. Solo gerencia y administración." />
      <Card bodyClass="p-0">
        {rows.length === 0 ? <Empty title="Papelera vacía" /> : (
          <Table><thead><tr><th>Contacto</th><th>Etapa</th><th>Vendedor</th><th>Eliminada</th><th /></tr></thead><tbody>
            {rows.map((o) => <tr key={o.id}><td>{o.contact.name}</td><td>{STAGE_LABEL[o.stage]}</td><td>{o.seller?.name}</td><td>{dateTime(o.deletedAt)}</td><td className="text-right"><InlineAction action={restoreAction} fields={{ id: o.id }} label="Recuperar" /></td></tr>)}
          </tbody></Table>)}
      </Card>
    </>
  );
}
