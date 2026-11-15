import { guard } from "@/lib/auth";
import { db } from "@/lib/db";
import { branchScope } from "@/lib/rbac";
import { BODY_TYPES, FUELS, TRANSMISSIONS } from "@/lib/labels";
import { clp } from "@/lib/format";
import { Card, Field, Notice, PageHeader } from "@/components/ui";
import { ActionForm, Submit } from "@/components/client/forms";
import { createConsignmentAction } from "../actions";

const DOCS = [["padron", "Padrón"], ["permiso", "Permiso de circulación"], ["revision", "Revisión técnica"], ["mandato", "Mandato de venta"], ["poder", "Poder notarial"]];
export default async function NewConsignment({ searchParams }: { searchParams: Promise<{ appraisal?: string }> }) {
  const a = await guard("consignments");
  const { appraisal } = await searchParams;
  const bs = branchScope(a);
  const [ap, branches, sellers] = await Promise.all([
    appraisal ? db.appraisal.findUnique({ where: { id: appraisal } }) : null,
    db.branch.findMany({ where: bs ? { id: { in: bs } } : {} }),
    db.seller.findMany({ where: { active: true, ...(bs ? { branchId: { in: bs } } : {}) } }),
  ]);
  return (
    <>
      <PageHeader title="Nueva consignación" desc="Registra propietario, vehículo, modalidad, monto acordado y vigencia." />
      {ap && <div className="mb-3"><Notice tone="blue">Vinculada a la tasación {ap.plate}: rango {clp(ap.minValue)} – {clp(ap.maxValue)} ({ap.source}).</Notice></div>}
      <Card>
        <ActionForm action={createConsignmentAction} className="grid gap-3 space-y-0 sm:grid-cols-2 lg:grid-cols-4">
          <input type="hidden" name="appraisalId" value={ap?.id ?? ""} />
          <p className="text-xs font-medium text-muted sm:col-span-2 lg:col-span-4">Propietario</p>
          <Field label="Nombre *"><input name="ownerName" required className="input" /></Field>
          <Field label="Teléfono *"><input name="ownerPhone" required className="input" /></Field>
          <Field label="Correo"><input name="ownerEmail" type="email" className="input" /></Field>
          <Field label="RUT"><input name="ownerRut" className="input" /></Field>
          <p className="text-xs font-medium text-muted sm:col-span-2 lg:col-span-4">Vehículo</p>
          <Field label="Patente *"><input name="plate" required defaultValue={ap?.plate} className="input uppercase" /></Field>
          <Field label="Marca *"><input name="brand" required defaultValue={ap?.brand} className="input" /></Field>
          <Field label="Modelo *"><input name="model" required defaultValue={ap?.model} className="input" /></Field>
          <Field label="Versión"><input name="version" defaultValue={ap?.version ?? ""} className="input" /></Field>
          <Field label="Año *"><input name="year" type="number" required defaultValue={ap?.year} className="input" /></Field>
          <Field label="Kilometraje *"><input name="km" inputMode="numeric" required defaultValue={ap?.km} className="input" /></Field>
          <Field label="Color"><input name="color" className="input" /></Field>
          <Field label="Carrocería"><select name="bodyType" className="input">{BODY_TYPES.map((x) => <option key={x}>{x}</option>)}</select></Field>
          <Field label="Transmisión"><select name="transmission" className="input">{TRANSMISSIONS.map((x) => <option key={x}>{x}</option>)}</select></Field>
          <Field label="Combustible"><select name="fuel" className="input">{FUELS.map((x) => <option key={x}>{x}</option>)}</select></Field>
          <Field label="Sucursal"><select name="branchId" className="input">{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
          <Field label="Responsable"><select name="responsibleId" defaultValue={a.sellerId ?? ""} className="input"><option value="">—</option>{sellers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
          <p className="text-xs font-medium text-muted sm:col-span-2 lg:col-span-4">Acuerdo</p>
          <Field label="Modalidad"><select name="modality" className="input"><option value="FISICA">Física (en sucursal)</option><option value="ONLINE">Online</option></select></Field>
          <Field label="Precio publicado *"><input name="price" inputMode="numeric" required defaultValue={ap?.maxValue} className="input" /></Field>
          <Field label="Monto acordado al propietario *" hint="Neto a liquidar al vender"><input name="agreedPrice" inputMode="numeric" required defaultValue={ap?.suggested} className="input" /></Field>
          <Field label="Vigencia (días)"><input name="days" type="number" defaultValue={60} className="input" /></Field>
          <div className="flex flex-wrap gap-3 text-sm sm:col-span-2 lg:col-span-4">{DOCS.map(([k, l]) => <label key={k} className="flex items-center gap-1.5"><input type="checkbox" name={`doc_${k}`} />{l}</label>)}</div>
          <Field label="Descripción para la web" className="sm:col-span-2 lg:col-span-4"><textarea name="description" rows={2} className="input" /></Field>
          <div className="flex justify-end sm:col-span-2 lg:col-span-4"><Submit>Crear consignación</Submit></div>
        </ActionForm>
      </Card>
    </>
  );
}
