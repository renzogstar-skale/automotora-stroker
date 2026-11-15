import { db } from "@/lib/db";
import { branchScope, oppScope, type Actor } from "@/lib/rbac";
import { APPT_TYPE } from "@/lib/labels";
import { toLocalInput, addDays } from "@/lib/format";
import { Field } from "@/components/ui";
import { ActionForm, Submit } from "@/components/client/forms";
import { createApptAction } from "./actions";

export async function ApptForm({ a, oppId }: { a: Actor; oppId?: string }) {
  const bs = branchScope(a);
  const [branches, sellers, vehicles, opps] = await Promise.all([
    db.branch.findMany({ where: bs ? { id: { in: bs } } : {} }),
    db.seller.findMany({ where: { active: true, ...(bs ? { branchId: { in: bs } } : {}), ...(a.role === "VENDEDOR" ? { id: a.sellerId ?? "-" } : {}) } }),
    db.vehicle.findMany({ where: { status: { in: ["DISPONIBLE", "RESERVADO", "VENDIDO"] }, ...(bs ? { branchId: { in: bs } } : {}) }, orderBy: { brand: "asc" }, take: 200 }),
    db.opportunity.findMany({ where: { ...oppScope(a), deletedAt: null, closedAt: null }, include: { contact: true }, orderBy: { createdAt: "desc" }, take: 200 }),
  ]);
  const pre = oppId ? opps.find((o) => o.id === oppId) : undefined;
  const next = addDays(new Date(), 1);
  return (
    <ActionForm action={createApptAction} resetOnOk className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Field label="Tipo"><select name="type" className="input">{Object.entries(APPT_TYPE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
      <Field label="Fecha y hora"><input type="datetime-local" name="startAt" required defaultValue={toLocalInput(new Date(Math.ceil(next.getTime() / 36e5) * 36e5))} className="input" /></Field>
      <Field label="Duración"><select name="duration" defaultValue="60" className="input"><option value="30">30 min</option><option value="60">1 hora</option><option value="90">1 h 30</option><option value="120">2 horas</option></select></Field>
      <Field label="Sucursal"><select name="branchId" defaultValue={pre?.branchId} className="input">{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
      <Field label="Cliente / oportunidad"><select name="opportunityId" defaultValue={oppId ?? ""} className="input"><option value="">— Sin vincular —</option>{opps.map((o) => <option key={o.id} value={o.id}>{o.contact.name}</option>)}</select></Field>
      <Field label="Vendedor"><select name="sellerId" defaultValue={pre?.sellerId ?? ""} className="input"><option value="">Del lead / yo</option>{sellers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
      <Field label="Vehículo"><select name="vehicleId" defaultValue={pre?.vehicleId ?? ""} className="input"><option value="">— Ninguno —</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.brand} {v.model} · {v.plate}</option>)}</select></Field>
      <Field label="Notas"><input name="notes" className="input" /></Field>
      <div className="flex items-end justify-end sm:col-span-2 lg:col-span-4"><Submit>Agendar cita</Submit></div>
    </ActionForm>
  );
}
