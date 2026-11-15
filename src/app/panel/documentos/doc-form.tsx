"use client";
import { useState } from "react";
import { ActionForm, Submit } from "@/components/client/forms";
import { Field } from "@/components/ui";
import { DOC_TYPE } from "@/lib/labels";
import type { ActionState } from "@/lib/action";

export type RefOption = { value: string; label: string; type: string };
export type ContactOpt = { name: string; rut: string; phone: string; email: string };
export type VehicleOpt = { plate: string; brand: string; model: string; version: string; year: number; vin: string; km: string; color: string; price: string };

/** Crear borrador: desde una ficha (reserva, venta, consignación o vehículo) o ingreso manual con autocompletado de contactos y vehículos. */
export function DocForm({ action, refs, contacts, vehicles, pre, preType }: {
  action: (s: ActionState, fd: FormData) => Promise<ActionState>;
  refs: RefOption[]; contacts: ContactOpt[]; vehicles: VehicleOpt[];
  pre: Record<string, string | undefined>; preType: string;
}) {
  const hasPre = Object.values(pre).some(Boolean);
  const [mode, setMode] = useState(hasPre || refs.length ? "record" : "manual");
  const [type, setType] = useState(preType);
  const [c, setC] = useState<ContactOpt>({ name: "", rut: "", phone: "", email: "" });
  const [v, setV] = useState<Omit<VehicleOpt, "year"> & { year: string }>({ plate: "", brand: "", model: "", version: "", year: "", vin: "", km: "", color: "", price: "" });
  const onName = (name: string) => { const m = contacts.find((x) => x.name === name); setC(m ?? { ...c, name }); };
  const onPlate = (raw: string) => { const plate = raw.toUpperCase().replace(/[^A-Z0-9]/g, ""); const m = vehicles.find((x) => x.plate === plate); setV(m ? { ...m, year: String(m.year) } : { ...v, plate }); };
  const options = refs.filter((r) => r.type === type || r.type === "*");
  return (
    <ActionForm action={action} className="grid gap-3 space-y-0 sm:grid-cols-2 lg:grid-cols-4">
      <input type="hidden" name="vehicleId" value={pre.vehicle ?? ""} /><input type="hidden" name="saleId" value={pre.sale ?? ""} />
      <input type="hidden" name="consignmentId" value={pre.consignment ?? ""} /><input type="hidden" name="reservationId" value={pre.reservation ?? ""} />
      <Field label="Tipo"><select name="type" value={type} onChange={(e) => setType(e.target.value)} className="input">{Object.entries(DOC_TYPE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
      <Field label="Origen de los datos"><select name="mode" value={mode} onChange={(e) => setMode(e.target.value)} className="input"><option value="record">Ficha vinculada</option><option value="manual">Ingreso manual</option></select></Field>
      {mode === "record" ? (
        <Field label="Ficha" className="sm:col-span-2">
          <select name="ref" className="input" defaultValue="">
            <option value="">{hasPre ? "Usar la ficha desde la que llegaste" : "Selecciona…"}</option>
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
      ) : (
        <>
          <Field label="Cliente"><input name="cName" list="doc-contacts" value={c.name} onChange={(e) => onName(e.target.value)} className="input" required /></Field>
          <Field label="RUT"><input name="cRut" value={c.rut} onChange={(e) => setC({ ...c, rut: e.target.value })} className="input" /></Field>
          <Field label="Teléfono"><input name="cPhone" value={c.phone} onChange={(e) => setC({ ...c, phone: e.target.value })} className="input" /></Field>
          <Field label="Correo"><input name="cEmail" value={c.email} onChange={(e) => setC({ ...c, email: e.target.value })} className="input" /></Field>
          <Field label="Patente"><input name="vPlate" list="doc-plates" value={v.plate} onChange={(e) => onPlate(e.target.value)} className="input uppercase" /></Field>
          <Field label="Marca"><input name="vBrand" value={v.brand} onChange={(e) => setV({ ...v, brand: e.target.value })} className="input" /></Field>
          <Field label="Modelo"><input name="vModel" value={v.model} onChange={(e) => setV({ ...v, model: e.target.value })} className="input" /></Field>
          <Field label="Año"><input name="vYear" value={v.year} onChange={(e) => setV({ ...v, year: e.target.value })} className="input" inputMode="numeric" /></Field>
          <input type="hidden" name="vVersion" value={v.version} /><input type="hidden" name="vVin" value={v.vin} /><input type="hidden" name="vKm" value={v.km} /><input type="hidden" name="vColor" value={v.color} />
          <Field label="Precio"><input name="vPrice" value={v.price} onChange={(e) => setV({ ...v, price: e.target.value })} className="input" /></Field>
          <datalist id="doc-contacts">{contacts.map((x) => <option key={x.name + x.rut} value={x.name}>{x.rut}</option>)}</datalist>
          <datalist id="doc-plates">{vehicles.map((x) => <option key={x.plate} value={x.plate}>{`${x.brand} ${x.model} ${x.year}`}</option>)}</datalist>
        </>
      )}
      <div className="flex items-end lg:col-end-5"><Submit className="btn btn-primary w-full">Crear borrador con folio</Submit></div>
    </ActionForm>
  );
}
