import { guard } from "@/lib/auth";
import { Card, Field, PageHeader } from "@/components/ui";
import { ActionForm, Submit } from "@/components/client/forms";
import { LeadFields } from "../lead-fields";
import { createLeadAction } from "../actions";

export default async function NewLead({ searchParams }: { searchParams: Promise<{ type?: string; vehicleId?: string }> }) {
  const a = await guard("crm");
  const s = await searchParams;
  return (
    <>
      <PageHeader title="Nuevo lead" desc="Si el teléfono o correo ya existe, la oportunidad se agrega al mismo contacto." />
      <Card>
        <ActionForm action={createLeadAction}>
          <LeadFields a={a} isNew init={{ type: s.type, vehicleId: s.vehicleId }} />
          <Field label="Nota inicial"><textarea name="note" rows={2} className="input" /></Field>
          <div className="flex justify-end"><Submit>Crear oportunidad</Submit></div>
        </ActionForm>
      </Card>
    </>
  );
}
