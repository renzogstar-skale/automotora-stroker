import { db } from "@/lib/db";
import { branchScope, type Actor } from "@/lib/rbac";
import { OPP_TYPE_LABEL, PAY_LABEL, SOURCE_LABEL } from "@/lib/labels";
import { toLocalInput } from "@/lib/format";
import { Field } from "@/components/ui";

type Init = Partial<{ name: string; phone: string | null; email: string | null; rut: string | null; region: string | null; comuna: string | null; type: string; source: string; branchId: string; sellerId: string | null; vehicleId: string | null; interest: string | null; budget: number | null; payMethod: string | null; tradeIn: string | null; nextFollowUpAt: Date | null }>;

/** Campos de la ficha comercial (alta y edición). */
export async function LeadFields({ a, init = {}, isNew }: { a: Actor; init?: Init; isNew?: boolean }) {
  const bs = branchScope(a);
  const [branches, sellers, vehicles] = await Promise.all([
    db.branch.findMany({ where: bs ? { id: { in: bs } } : {} }),
    db.seller.findMany({ where: { active: true, ...(bs ? { branchId: { in: bs } } : {}) }, include: { branch: true }, orderBy: { name: "asc" } }),
    db.vehicle.findMany({ where: { status: { in: ["DISPONIBLE", "RESERVADO"] }, ...(bs ? { branchId: { in: bs } } : {}) }, orderBy: { brand: "asc" } }),
  ]);
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Field label="Nombre *"><input name="name" required defaultValue={init.name} className="input" /></Field>
      <Field label="Teléfono"><input name="phone" type="tel" defaultValue={init.phone ?? ""} placeholder="+56 9 …" className="input" /></Field>
      <Field label="Correo"><input name="email" type="email" defaultValue={init.email ?? ""} className="input" /></Field>
      <Field label="RUT (si corresponde)"><input name="rut" defaultValue={init.rut ?? ""} placeholder="12.345.678-9" className="input" /></Field>
      <Field label="Región"><input name="region" defaultValue={init.region ?? ""} className="input" /></Field>
      <Field label="Comuna"><input name="comuna" defaultValue={init.comuna ?? ""} className="input" /></Field>
      {isNew && <>
        <Field label="Tipo"><select name="type" defaultValue={init.type ?? "VENTA"} className="input">{Object.entries(OPP_TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Canal de origen"><select name="source" defaultValue={init.source ?? "PRESENCIAL"} className="input">{Object.entries(SOURCE_LABEL).filter(([k]) => k !== "N8N").map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Sucursal"><select name="branchId" defaultValue={init.branchId ?? branches[0]?.id} className="input">{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
      </>}
      {a.role !== "VENDEDOR" && <Field label="Vendedor"><select name="sellerId" defaultValue={init.sellerId ?? ""} className="input"><option value="">{isNew ? "Asignación automática" : "Sin asignar"}</option>{sellers.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.branch.name}</option>)}</select></Field>}
      <Field label="Vehículo de interés"><select name="vehicleId" defaultValue={init.vehicleId ?? ""} className="input"><option value="">— Ninguno en particular —</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.brand} {v.model} {v.year} · {v.plate}{v.status === "RESERVADO" ? " (reservado)" : ""}</option>)}</select></Field>
      <Field label="Interés / búsqueda"><input name="interest" defaultValue={init.interest ?? ""} placeholder="SUV automático hasta $18M" className="input" /></Field>
      <Field label="Presupuesto (CLP)"><input name="budget" inputMode="numeric" defaultValue={init.budget ?? ""} className="input" /></Field>
      <Field label="Forma de compra"><select name="payMethod" defaultValue={init.payMethod ?? ""} className="input"><option value="">Por definir</option>{Object.entries(PAY_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
      <Field label="Auto en parte de pago"><input name="tradeIn" defaultValue={init.tradeIn ?? ""} placeholder="Marca, modelo, año, km" className="input" /></Field>
      <Field label="Próximo seguimiento"><input type="datetime-local" name="nextFollowUpAt" defaultValue={init.nextFollowUpAt ? toLocalInput(init.nextFollowUpAt) : ""} className="input" /></Field>
    </div>
  );
}
