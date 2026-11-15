import { guard } from "@/lib/auth";
import { db } from "@/lib/db";
import { APPT_TYPE, INTEGRATION_STATUS } from "@/lib/labels";
import { dateTime } from "@/lib/format";
import { getGcal } from "@/server/gcal";
import { API_PERMS } from "@/server/apikeys";
import { demoMode, getIntegrations } from "@/server/integrations";
import { Badge, Card, Field, Notice, PageHeader, StatusBadge, Table } from "@/components/ui";
import { ActionForm, InlineAction, Submit } from "@/components/client/forms";
import { createKeyAction, disconnectAction, gcalAction, revokeKeyAction, testAction } from "./actions";
import { KeyForm } from "./key-form";

export const metadata = { title: "Integraciones" };

export default async function IntegracionesPage() {
  await guard("integrations");
  const [items, gcal, sellers, branches, keys, logs] = await Promise.all([
    getIntegrations(), getGcal(),
    db.seller.findMany({ where: { active: true }, include: { branch: true }, orderBy: { name: "asc" } }),
    db.branch.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.apiKey.findMany({ include: { branch: true }, orderBy: { createdAt: "desc" } }),
    db.ingestLog.findMany({ include: { apiKey: true }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const c = gcal.config;
  return (
    <>
      <PageHeader title="Integraciones" desc="Conexiones externas, claves API para n8n y registro de ingesta. Las credenciales viven solo en variables de entorno del servidor." />
      {demoMode() && <Notice tone="blue">Modo demo activo: las integraciones sin credenciales usan datos simulados. Con <code>INTEGRATIONS_DEMO=0</code> aparecen como «Sin configurar».</Notice>}

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((i) => (
          <Card key={i.key} title={i.name} sub={i.desc} action={<StatusBadge map={INTEGRATION_STATUS} value={i.status} />}>
            <dl className="space-y-1 text-sm" data-integration={i.key} data-status={i.status}>
              <div className="flex justify-between gap-2"><dt className="text-muted">Última sincronización</dt><dd>{i.lastSyncAt ? dateTime(i.lastSyncAt) : "Nunca"}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-muted">Credenciales</dt><dd>{i.live ? <Badge tone="green">En servidor</Badge> : <Badge tone="gray">Faltan {i.missing.length}</Badge>}</dd></div>
              {i.sample && <p className="text-xs text-muted">{i.sample}</p>}
              {i.lastError && <p className="text-xs text-red-700 dark:text-red-400">{i.lastError}</p>}
              {!i.live && <p className="text-[11px] text-muted">Variables: {i.missing.join(", ")}</p>}
            </dl>
            <div className="mt-3 flex flex-wrap gap-2">
              <InlineAction action={testAction} fields={{ key: i.key }} label={i.status === "DESCONECTADO" ? "Probar y reconectar" : "Probar conexión"} className="btn btn-sm btn-primary" />
              {i.status !== "DESCONECTADO" && i.status !== "SIN_CONFIGURAR" && <InlineAction action={disconnectAction} fields={{ key: i.key }} label="Desconectar" confirm />}
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-6" title="Claves API (n8n y agenda)" sub="Cada clave pertenece a una sucursal: los leads y citas se crean en ella. Endpoints: POST /api/n8n-lead-ingest y POST /api/appointment-ingest">
        <KeyForm action={createKeyAction} branches={branches.map((b) => ({ id: b.id, name: b.name }))} perms={API_PERMS} />
        <div className="mt-4">
          <Table>
            <thead><tr><th>Nombre</th><th>Prefijo</th><th>Sucursal</th><th>Permisos</th><th>Último uso</th><th>Estado</th><th /></tr></thead>
            <tbody>{keys.map((k) => (
              <tr key={k.id} data-key={k.id}>
                <td>{k.name}<div className="text-xs text-muted">por {k.createdBy} · {dateTime(k.createdAt)}</div></td>
                <td><code>{k.prefix}…</code></td>
                <td>{k.branch.name}</td>
                <td className="text-xs">{k.permissions.join(", ")}</td>
                <td>{k.lastUsedAt ? dateTime(k.lastUsedAt) : "—"}</td>
                <td>{k.revokedAt ? <Badge tone="red">Revocada</Badge> : <Badge tone="green">Activa</Badge>}</td>
                <td>{!k.revokedAt && <InlineAction action={revokeKeyAction} fields={{ id: k.id }} label="Revocar" confirm />}</td>
              </tr>
            ))}</tbody>
          </Table>
        </div>
      </Card>

      <Card className="mt-6" title="Registro de ingesta" sub="Últimas 20 solicitudes. Sin datos personales: solo estado e identificadores internos." bodyClass="p-0">
        <Table>
          <thead><tr><th>Fecha</th><th>Clave</th><th>Endpoint</th><th>Estado</th><th>Resultado</th></tr></thead>
          <tbody>{logs.map((l) => (
            <tr key={l.id}><td>{dateTime(l.createdAt)}</td><td>{l.apiKey?.name ?? "—"}</td><td><code>{l.endpoint}</code></td><td><Badge tone={l.status < 300 ? "green" : l.status < 500 ? "amber" : "red"}>{l.status}</Badge></td><td className="text-xs">{l.result}</td></tr>
          ))}</tbody>
        </Table>
      </Card>

      <div id="GCAL" className="mt-6 scroll-mt-20">
        <Card title="Google Calendar · configuración" sub="Calendario por vendedor y reglas de sincronización de citas" action={<StatusBadge map={INTEGRATION_STATUS} value={gcal.status} />}>
          <ActionForm action={gcalAction} className="grid gap-3 sm:grid-cols-3">
            <label className="flex items-center gap-2 text-sm sm:col-span-3"><input type="checkbox" name="enabled" defaultChecked={c.enabled} /> Sincronizar citas cuando la conexión esté activa</label>
            <Field label="Dirección"><select name="direction" defaultValue={c.direction} className="input"><option value="PUSH">Solo enviar citas a Google</option><option value="BIDIRECCIONAL">Bidireccional (bloquea horarios ocupados)</option></select></Field>
            <Field label="Recordatorio (minutos antes)"><input type="number" name="reminderMin" min={0} max={1440} defaultValue={c.reminderMin} className="input" /></Field>
            <Field label="Tipos a sincronizar"><div className="flex flex-wrap gap-3 pt-1 text-sm">{Object.entries(APPT_TYPE).map(([k, l]) => <label key={k} className="flex items-center gap-1"><input type="checkbox" name="types" value={k} defaultChecked={c.types.includes(k)} />{l}</label>)}</div></Field>
            <div className="sm:col-span-3">
              <p className="mb-1 text-sm font-medium">Calendario de cada vendedor</p>
              <div className="grid gap-2 sm:grid-cols-2">{sellers.map((s) => <Field key={s.id} label={`${s.name} · ${s.branch.name}`}><input name={`cal_${s.id}`} type="email" defaultValue={c.calendars[s.id] ?? s.email} className="input" /></Field>)}</div>
            </div>
            <div className="flex justify-end sm:col-span-3"><Submit>Guardar configuración</Submit></div>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
