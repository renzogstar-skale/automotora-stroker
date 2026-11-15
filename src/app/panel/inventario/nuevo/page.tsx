import { guard } from "@/lib/auth";
import { db } from "@/lib/db";
import { branchScope } from "@/lib/rbac";
import { BODY_TYPES, FUELS, TRANSMISSIONS } from "@/lib/labels";
import { Card, Field, PageHeader } from "@/components/ui";
import { ActionForm, Submit } from "@/components/client/forms";
import { createVehicleAction } from "../actions";

export default async function NewVehicle() {
  const a = await guard("inventory.edit");
  const bs = branchScope(a);
  const branches = await db.branch.findMany({ where: bs ? { id: { in: bs } } : {} });
  return (
    <>
      <PageHeader title="Agregar vehículo propio" desc="Para vehículos de terceros usa Consignaciones (Tasación → Consignación)." />
      <Card>
        <ActionForm action={createVehicleAction} className="grid gap-3 space-y-0 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Patente *" hint="AA1234 · BBBB12 · motos AA123 / BBB12"><input name="plate" required className="input uppercase" /></Field>
          <Field label="Marca *"><input name="brand" required className="input" /></Field>
          <Field label="Modelo *"><input name="model" required className="input" /></Field>
          <Field label="Versión"><input name="version" className="input" /></Field>
          <Field label="Año *"><input name="year" type="number" min={1980} max={2030} required className="input" /></Field>
          <Field label="Kilometraje *"><input name="km" inputMode="numeric" required className="input" /></Field>
          <Field label="VIN"><input name="vin" className="input" /></Field>
          <Field label="Color"><input name="color" className="input" /></Field>
          <Field label="Carrocería"><select name="bodyType" className="input">{BODY_TYPES.map((b) => <option key={b}>{b}</option>)}</select></Field>
          <Field label="Transmisión"><select name="transmission" className="input">{TRANSMISSIONS.map((b) => <option key={b}>{b}</option>)}</select></Field>
          <Field label="Combustible"><select name="fuel" className="input">{FUELS.map((b) => <option key={b}>{b}</option>)}</select></Field>
          <Field label="Condición"><select name="condition" defaultValue="USADO" className="input"><option value="USADO">Usado</option><option value="NUEVO">Nuevo</option></select></Field>
          <Field label="Sucursal"><select name="branchId" className="input">{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
          <Field label="Precio de venta (CLP) *"><input name="price" inputMode="numeric" required className="input" /></Field>
          <Field label="Costo de adquisición (CLP) *"><input name="cost" inputMode="numeric" required className="input" /></Field>
          <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" name="registerPurchase" defaultChecked />Registrar el pago de compra en caja</label>
          <Field label="Descripción para la web" className="sm:col-span-2 lg:col-span-4"><textarea name="description" rows={3} className="input" /></Field>
          <div className="flex justify-end sm:col-span-2 lg:col-span-4"><Submit>Ingresar al inventario</Submit></div>
        </ActionForm>
      </Card>
    </>
  );
}
