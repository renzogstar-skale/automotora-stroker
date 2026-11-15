import { guard } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateTime } from "@/lib/format";
import { getSetting } from "@/server/settings";
import { Card, Field, PageHeader } from "@/components/ui";
import { ActionForm, Submit } from "@/components/client/forms";
import { companyAction, branchAction, noticesAction } from "./actions";

export const metadata = { title: "Configuración" };

const NOTICES: [key: string, label: string, hint: string][] = [
  ["noContactHours", "Lead sin primer contacto (horas)", "Alerta si un lead nuevo no recibe llamada ni mensaje en este plazo."],
  ["followUpGraceHours", "Tolerancia de seguimiento vencido (horas)", "Margen antes de marcar un seguimiento como atrasado."],
  ["staleStockDays", "Vehículo sin rotación (días)", "Stock con más días que esto aparece como inventario lento."],
  ["noPhotoDays", "Vehículo sin fotos (días)", "Avisa al fotógrafo y gerencia si el auto sigue sin fotos."],
  ["reservationWarnHours", "Reserva por vencer (horas)", "Anticipación del aviso antes de que expire una reserva."],
];

export default async function ConfiguracionPage() {
  await guard("config");
  const [company, notices, branches, log] = await Promise.all([
    getSetting("company"), getSetting("notices"), db.branch.findMany({ orderBy: { name: "asc" } }),
    db.auditLog.findMany({ where: { action: { startsWith: "config." } }, orderBy: { createdAt: "desc" }, take: 8 }),
  ]);
  return (
    <>
      <PageHeader title="Configuración" desc="Datos de la automotora, sucursales, horarios y avisos. Cada cambio queda registrado en auditoría." />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Datos de la automotora" sub="Se usan en documentos, notas de venta y la web.">
          <ActionForm action={companyAction} className="grid grid-cols-2 gap-2 space-y-0">
            <Field label="Razón social" className="col-span-2"><input name="name" defaultValue={company.name} required className="input" /></Field>
            <Field label="RUT"><input name="rut" defaultValue={company.rut} required className="input" placeholder="77.123.456-7" /></Field>
            <Field label="Teléfono"><input name="phone" defaultValue={company.phone} required className="input" /></Field>
            <Field label="Dirección" className="col-span-2"><input name="address" defaultValue={company.address} required className="input" /></Field>
            <Field label="Correo de contacto" className="col-span-2"><input name="email" type="email" defaultValue={company.email} required className="input" /></Field>
            <div className="col-span-2 flex justify-end"><Submit>Guardar</Submit></div>
          </ActionForm>
        </Card>

        <Card title="Preferencias de avisos" sub="Umbrales de las alertas del panel «Hoy».">
          <ActionForm action={noticesAction} className="grid grid-cols-2 gap-2 space-y-0">
            {NOTICES.map(([k, label, hint]) => (
              <Field key={k} label={label} hint={hint}><input name={k} type="number" min={0} required defaultValue={(notices as Record<string, number>)[k]} className="input" /></Field>
            ))}
            <div className="col-span-2 flex justify-end"><Submit>Guardar</Submit></div>
          </ActionForm>
        </Card>

        {branches.map((b) => {
          const h = (b.hours ?? {}) as Record<string, string>;
          return (
            <Card key={b.id} title={`Sucursal · ${b.name}`} sub={`Código ${b.code}`}>
              <ActionForm action={branchAction} className="grid grid-cols-2 gap-2 space-y-0">
                <input type="hidden" name="id" value={b.id} />
                <Field label="Nombre" className="col-span-2"><input name="name" defaultValue={b.name} required className="input" /></Field>
                <Field label="Dirección" className="col-span-2"><input name="address" defaultValue={b.address} required className="input" /></Field>
                <Field label="Comuna"><input name="comuna" defaultValue={b.comuna} required className="input" /></Field>
                <Field label="Región"><input name="region" defaultValue={b.region} required className="input" /></Field>
                <Field label="Teléfono"><input name="phone" defaultValue={b.phone} required className="input" /></Field>
                <Field label="WhatsApp"><input name="whatsapp" defaultValue={b.whatsapp} required className="input" /></Field>
                <fieldset className="col-span-2 grid grid-cols-3 gap-2"><legend className="mb-1 text-xs font-medium text-muted">Horario de atención</legend>
                  <Field label="Lunes a viernes"><input name="lunVie" defaultValue={h.lunVie} placeholder="09:30–19:00" className="input" /></Field>
                  <Field label="Sábado"><input name="sab" defaultValue={h.sab} placeholder="10:00–14:00" className="input" /></Field>
                  <Field label="Domingo"><input name="dom" defaultValue={h.dom} placeholder="Cerrado" className="input" /></Field>
                </fieldset>
                <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={b.active} />Sucursal activa</label>
                <div className="col-span-2 flex justify-end"><Submit>Guardar sucursal</Submit></div>
              </ActionForm>
            </Card>
          );
        })}

        <Card title="Últimos cambios de configuración" className="xl:col-span-2">
          {log.length === 0 ? <p className="text-sm text-muted">Sin cambios registrados.</p> : (
            <ul className="space-y-2 text-sm">{log.map((l) => <li key={l.id}>{l.summary} <span className="text-xs text-muted">· {l.actorName} · {dateTime(l.createdAt)}</span></li>)}</ul>
          )}
        </Card>
      </div>
    </>
  );
}
