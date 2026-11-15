import Link from "next/link";
import { guard } from "@/lib/auth";
import { db } from "@/lib/db";
import { sp } from "@/lib/period";
import { addDays, dateTime, toLocalInput } from "@/lib/format";
import { INTEGRATION_STATUS, POST_STATUS } from "@/lib/labels";
import { demoMode } from "@/server/integrations";
import { NETWORKS, accountScope, canPublishPersonal, missingNetworkEnv, postScope, publishDue, type Network } from "@/server/social";
import { Badge, Card, Empty, Field, Notice, PageHeader, StatusBadge, Table, Tabs } from "@/components/ui";
import { ActionForm, InlineAction, Submit } from "@/components/client/forms";
import { accountAction, connectAction, deleteAction, disconnectAction, postAction, publishAction, scheduleAction, unscheduleAction } from "./actions";

export const metadata = { title: "Redes sociales" };
type SP = Promise<Record<string, string | string[] | undefined>>;
const ACC_STATUS: typeof INTEGRATION_STATUS = { ...INTEGRATION_STATUS, SIN_CONECTAR: ["Sin conectar", "gray"], PENDIENTE: ["Autorización pendiente", "amber"] };
const TABS = [["BORRADOR", "Borradores"], ["PROGRAMADA", "Programadas"], ["PUBLICADA", "Publicadas"], ["ERROR", "Errores"], ["cuentas", "Cuentas"]] as const;

export default async function RedesPage({ searchParams }: { searchParams: SP }) {
  const a = await guard("social");
  const s = await searchParams;
  const tab = sp(s, "tab") ?? "BORRADOR";
  // Sin cron en demo, las programadas vencidas se publican al abrir la vista.
  if (demoMode()) await publishDue();
  const [accounts, posts, counts, vehicles] = await Promise.all([
    db.socialAccount.findMany({ where: accountScope(a), include: { user: true }, orderBy: [{ kind: "asc" }, { network: "asc" }] }),
    tab === "cuentas" ? [] : db.socialPost.findMany({ where: { ...postScope(a), status: tab }, include: { account: true, vehicle: true }, orderBy: tab === "PUBLICADA" ? { publishedAt: "desc" } : tab === "PROGRAMADA" ? { scheduledAt: "asc" } : { createdAt: "desc" }, take: 100 }),
    db.socialPost.groupBy({ by: ["status"], where: postScope(a), _count: true }),
    db.vehicle.findMany({ where: { published: true }, select: { id: true, brand: true, model: true, year: true }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  const count = (st: string) => counts.find((c) => c.status === st)?._count ?? 0;
  const manager = a.role === "ADMIN" || a.role === "GERENCIA";
  const mine = accounts.filter((x) => (x.kind === "CORPORATIVA" ? manager : x.userId === a.id || manager));
  const soon = toLocalInput(addDays(new Date(), 1));

  return (
    <>
      <PageHeader title="Redes sociales" desc="Cuentas corporativas y personales, borradores, programación y seguimiento de publicaciones." />
      {demoMode() && <Notice tone="blue">Modo demo: la conexión y la publicación se simulan. Con credenciales reales se usa OAuth de cada red con los permisos indicados en Cuentas.</Notice>}
      <div className="mt-4">
        <Tabs items={TABS.map(([k, l]) => ({ href: `/panel/redes?tab=${k}`, label: l, active: tab === k, count: k === "cuentas" ? accounts.length : count(k) }))} />
      </div>

      {tab === "cuentas" ? (
        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2" title="Cuentas" bodyClass="p-0">
            {accounts.length === 0 ? <Empty compact title="Sin cuentas" /> : (
              <Table>
                <thead><tr><th>Cuenta</th><th>Tipo</th><th>Permisos requeridos</th><th>Estado</th><th /></tr></thead>
                <tbody>{accounts.map((x) => {
                  const net = x.network as Network, n = NETWORKS[net];
                  const kind = x.kind as "CORPORATIVA" | "PERSONAL";
                  const missing = n ? missingNetworkEnv(net) : [];
                  return (
                    <tr key={x.id} data-account={x.id}>
                      <td><b>{n?.label}</b> · {x.handle}</td>
                      <td>{kind === "CORPORATIVA" ? "Corporativa" : `Personal · ${x.user?.name ?? ""}`}</td>
                      <td className="text-xs text-muted">{n?.scopes[kind].join(", ") || "—"}<br />{n?.note[kind]}{missing.length > 0 && <><br />Falta en servidor: {missing.join(", ")}</>}</td>
                      <td><StatusBadge map={ACC_STATUS} value={x.status} /></td>
                      <td className="whitespace-nowrap">{mine.includes(x) && (["DEMO", "CONECTADO"].includes(x.status)
                        ? <InlineAction action={disconnectAction} fields={{ id: x.id }} label="Desconectar" />
                        : (kind === "CORPORATIVA" || canPublishPersonal(net)) && <InlineAction action={connectAction} fields={{ id: x.id }} label="Conectar" className="btn btn-sm btn-primary" />)}</td>
                    </tr>
                  );
                })}</tbody>
              </Table>
            )}
          </Card>
          <Card title="Agregar cuenta">
            <ActionForm action={accountAction} resetOnOk>
              <Field label="Red"><select name="network" className="input">{Object.entries(NETWORKS).map(([k, n]) => <option key={k} value={k}>{n.label}</option>)}</select></Field>
              <Field label="Tipo"><select name="kind" className="input"><option value="PERSONAL">Personal (mía)</option>{manager && <option value="CORPORATIVA">Corporativa</option>}</select></Field>
              <Field label="Usuario o página"><input name="handle" required maxLength={80} className="input" placeholder="@stroker.autos" /></Field>
              <Submit>Agregar</Submit>
            </ActionForm>
          </Card>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2" bodyClass="p-0" title={TABS.find(([k]) => k === tab)?.[1]}>
            {posts.length === 0 ? <Empty compact title="Sin publicaciones" /> : (
              <ul className="divide-y divide-line">
                {posts.map((p) => (
                  <li key={p.id} className="space-y-2 px-5 py-4" data-post={p.id}>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                      <Badge tone="blue">{NETWORKS[p.account.network as Network]?.label}</Badge>{p.account.handle}
                      <StatusBadge map={POST_STATUS} value={p.status} />
                      {p.vehicle && <Link className="link" href={`/panel/inventario/${p.vehicleId}`}>{p.vehicle.brand} {p.vehicle.model} {p.vehicle.year}</Link>}
                      {p.scheduledAt && p.status === "PROGRAMADA" && <span>Programada: {dateTime(p.scheduledAt)}</span>}
                      {p.publishedAt && <span>Publicada: {dateTime(p.publishedAt)}</span>}
                    </div>
                    <p className="whitespace-pre-wrap text-sm">{p.text}</p>
                    {p.error && <p className="text-xs text-red-700 dark:text-red-400">Error: {p.error}</p>}
                    {mine.some((m) => m.id === p.accountId) && p.status !== "PUBLICADA" && (
                      <div className="flex flex-wrap items-center gap-2">
                        <InlineAction action={publishAction} fields={{ id: p.id }} label={p.status === "ERROR" ? "Reintentar" : "Publicar ahora"} className="btn btn-sm btn-primary" />
                        {p.status === "PROGRAMADA" ? <InlineAction action={unscheduleAction} fields={{ id: p.id }} label="Pasar a borrador" /> : (
                          <ActionForm action={scheduleAction} className="flex gap-1 space-y-0">
                            <input type="hidden" name="id" value={p.id} />
                            <input type="datetime-local" name="at" required defaultValue={soon} className="input h-8 text-xs" aria-label="Programar para" />
                            <Submit className="btn btn-sm">Programar</Submit>
                          </ActionForm>
                        )}
                        <InlineAction action={deleteAction} fields={{ id: p.id }} label="Eliminar" confirm />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Nueva publicación">
            {mine.length === 0 ? <Empty compact title="Sin cuentas propias" text="Agrega una cuenta en la pestaña Cuentas." /> : (
              <ActionForm action={postAction} resetOnOk>
                <Field label="Cuenta"><select name="accountId" className="input">{mine.map((x) => <option key={x.id} value={x.id}>{NETWORKS[x.network as Network]?.label} · {x.handle}{x.kind === "PERSONAL" ? " (personal)" : ""}</option>)}</select></Field>
                <Field label="Vehículo (opcional)"><select name="vehicleId" className="input"><option value="">—</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.brand} {v.model} {v.year}</option>)}</select></Field>
                <Field label="Texto" hint="Instagram 2.200 · LinkedIn 3.000 caracteres"><textarea name="text" required rows={5} maxLength={3000} className="input" /></Field>
                <Field label="Programar para (si eliges programar)"><input type="datetime-local" name="scheduledAt" defaultValue={soon} className="input" /></Field>
                <div className="flex flex-wrap gap-2">
                  <button name="mode" value="draft" className="btn">Guardar borrador</button>
                  <button name="mode" value="schedule" className="btn">Programar</button>
                  <button name="mode" value="publish" className="btn btn-primary">Publicar ahora</button>
                </div>
              </ActionForm>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
