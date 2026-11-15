import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { guard } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, oppScope } from "@/lib/rbac";
import { sp } from "@/lib/period";
import { randomToken } from "@/lib/crypto";
import { ago, dateTime, time } from "@/lib/format";
import { INTEGRATION_STATUS } from "@/lib/labels";
import { assignableUsers } from "@/server/tasks";
import { convScope, getConversation, numberStatus } from "@/server/whatsapp";
import { visibleBranches } from "@/components/filters";
import { Badge, Card, Empty, Field, Notice, PageHeader, StatusBadge, Tabs, cx } from "@/components/ui";
import { ActionForm, InlineAction, Submit } from "@/components/client/forms";
import { addNumberAction, assignAction, leadAction, linkAction, numberStatusAction, sendAction } from "./actions";

export const metadata = { title: "WhatsApp Business" };
type SP = Promise<Record<string, string | string[] | undefined>>;
const NUMBER_STATUS: typeof INTEGRATION_STATUS = { ...INTEGRATION_STATUS, DESACTIVADO: ["Desactivado", "gray"] };
const MSG_STATUS: Record<string, string> = { PENDIENTE: "Enviando…", ENVIADO: "Enviado", ENTREGADO: "Entregado", LEIDO: "Leído", ERROR: "Error al enviar" };

export default async function WhatsappPage({ searchParams }: { searchParams: SP }) {
  const a = await guard("whatsapp");
  const s = await searchParams;
  const tab = sp(s, "tab") ?? (a.role === "VENDEDOR" ? "mine" : "all");
  const numberId = sp(s, "n");
  const base: Prisma.ConversationWhereInput = { ...convScope(a), ...(numberId ? { numberId } : {}) };
  const where = tab === "mine" ? { ...base, assignedToId: a.id } : tab === "unassigned" ? { ...base, assignedToId: null } : base;
  const [convs, numbers, nMine, nFree, nAll] = await Promise.all([
    db.conversation.findMany({ where, include: { number: true, assignedTo: true, messages: { orderBy: { sentAt: "desc" }, take: 1 } }, orderBy: { lastMessageAt: "desc" }, take: 100 }),
    db.waNumber.findMany({ where: a.role === "ADMIN" ? {} : { branchId: { in: a.branchIds } }, include: { branch: true }, orderBy: { label: "asc" } }),
    db.conversation.count({ where: { ...base, assignedToId: a.id } }),
    db.conversation.count({ where: { ...base, assignedToId: null } }),
    db.conversation.count({ where: base }),
  ]);
  const statuses = await Promise.all(numbers.map((n) => numberStatus(n)));
  const selId = sp(s, "c") ?? convs[0]?.id;
  const sel = selId ? await getConversation(selId, a).catch(() => null) : null;
  const [users, opps] = sel ? await Promise.all([
    assignableUsers(a),
    db.opportunity.findMany({ where: { ...oppScope(a), deletedAt: null, closedAt: null, branchId: sel.number.branchId }, include: { contact: true }, orderBy: { createdAt: "desc" }, take: 150 }),
  ]) : [[], []];
  const href = (o: Record<string, string | undefined>) => `/panel/whatsapp?${new URLSearchParams(Object.entries({ tab, n: numberId, ...o }).filter(([, v]) => v) as [string, string][])}`;
  const isAdmin = can(a, "integrations");
  const branches = isAdmin ? await visibleBranches(a) : [];
  const tabs: [string, string, number][] = [["mine", "Mías", nMine], ["unassigned", "Sin asignar", nFree], ["all", "Todas", nAll]];

  return (
    <>
      <PageHeader title="WhatsApp Business" desc="Bandeja de conversaciones por número autorizado, con asignación y vínculo al lead." />
      {statuses.includes("DEMO") && <Notice tone="blue">Modo demo: los envíos se simulan y no salen al proveedor. Configura las credenciales en Sistema › Integraciones para operar en real.</Notice>}
      <div className="my-4 flex flex-wrap gap-2">
        {numbers.map((n, i) => (
          <Link key={n.id} href={href({ n: numberId === n.id ? undefined : n.id, c: undefined })} className={cx("card flex items-center gap-3 px-4 py-2.5 text-sm", numberId === n.id && "ring-2 ring-accent")}>
            <span className="min-w-0"><b className="block">{n.label}</b><span className="text-xs text-muted">{n.phone} · {n.provider === "META" ? "Meta Cloud API" : "YCloud"} · {n.branch.name}</span></span>
            <StatusBadge map={NUMBER_STATUS} value={statuses[i]} />
          </Link>
        ))}
        {numbers.length === 0 && <p className="text-sm text-muted">No hay números autorizados en tus sucursales.</p>}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className="min-w-0">
          <Tabs items={tabs.map(([k, l, c]) => ({ href: href({ tab: k, c: undefined }), label: l, count: c, active: tab === k }))} />
          <Card bodyClass="p-0">
            {convs.length === 0 ? <Empty compact title="Sin conversaciones" /> : (
              <ul className="divide-y divide-line" data-testid="wa-inbox">
                {convs.map((c) => (
                  <li key={c.id}>
                    <Link href={href({ c: c.id })} data-conv={c.id} className={cx("block px-4 py-3 hover:bg-surface-2", sel?.id === c.id && "bg-surface-2")}>
                      <div className="flex items-center justify-between gap-2">
                        <b className="truncate text-sm">{c.contactName}</b>
                        <span className="shrink-0 text-xs text-muted">{ago(c.lastMessageAt)}</span>
                      </div>
                      <p className="truncate text-xs text-muted">{c.messages[0]?.direction === "OUT" && "Tú: "}{c.messages[0]?.body}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {c.unread > 0 && <Badge tone="green">{c.unread} nuevo(s)</Badge>}
                        <Badge tone={c.assignedTo ? "blue" : "amber"}>{c.assignedTo?.name ?? "Sin asignar"}</Badge>
                        <Badge tone={c.opportunityId ? "violet" : "gray"}>{c.opportunityId ? "Lead vinculado" : "Sin lead"}</Badge>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {sel ? (
          <Card title={`${sel.contactName} · ${sel.contactPhone}`} sub={`${sel.number.label} (${sel.number.phone})`} bodyClass="p-0">
            <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-2">
              <div>
                <p className="label mb-1">Asignación</p>
                {a.role === "VENDEDOR" ? (
                  sel.assignedToId === a.id ? <InlineAction action={assignAction} fields={{ id: sel.id, userId: "" }} label="Liberar conversación" />
                    : !sel.assignedToId ? <InlineAction action={assignAction} fields={{ id: sel.id, userId: a.id }} label="Tomar conversación" className="btn btn-sm btn-primary" />
                    : <span className="text-sm">{sel.assignedTo?.name}</span>
                ) : (
                  <ActionForm action={assignAction} className="flex gap-2 space-y-0">
                    <input type="hidden" name="id" value={sel.id} />
                    <select name="userId" defaultValue={sel.assignedToId ?? ""} className="input h-9" aria-label="Asignar a"><option value="">Sin asignar</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
                    <Submit className="btn btn-sm">Asignar</Submit>
                  </ActionForm>
                )}
              </div>
              <div>
                <p className="label mb-1">Lead</p>
                {sel.opportunity ? (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Link className="link" href={`/panel/crm/${sel.opportunity.id}`}>{sel.opportunity.contact.name}</Link>
                    <InlineAction action={linkAction} fields={{ id: sel.id, oppId: "" }} label="Desvincular" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <ActionForm action={linkAction} className="flex gap-2 space-y-0">
                      <input type="hidden" name="id" value={sel.id} />
                      <select name="oppId" required className="input h-9" aria-label="Lead a vincular"><option value="">Elegir lead…</option>{opps.map((o) => <option key={o.id} value={o.id}>{o.contact.name} · {o.contact.phone ?? o.contact.email}</option>)}</select>
                      <Submit className="btn btn-sm">Vincular</Submit>
                    </ActionForm>
                    {can(a, "crm") && <InlineAction action={leadAction} fields={{ id: sel.id }} label="Crear lead desde el chat" />}
                  </div>
                )}
              </div>
            </div>
            <ol className="max-h-[28rem] space-y-2 overflow-y-auto p-4" data-testid="wa-thread">
              {sel.messages.map((m) => (
                <li key={m.id} className={cx("max-w-[80%] rounded-xl px-3 py-2 text-sm", m.direction === "OUT" ? "ml-auto bg-accent/10" : "bg-surface-2")}>
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p className="mt-1 text-right text-[11px] text-muted" title={dateTime(m.sentAt)}>{time(m.sentAt)}{m.direction === "OUT" && MSG_STATUS[m.status] ? ` · ${MSG_STATUS[m.status]}` : ""}</p>
                </li>
              ))}
            </ol>
            <div className="border-t border-line p-4">
              <ActionForm action={sendAction} resetOnOk className="flex flex-col gap-2 space-y-0 sm:flex-row">
                <input type="hidden" name="id" value={sel.id} />
                <input type="hidden" name="clientId" value={randomToken(12)} />
                <textarea name="body" required maxLength={4096} rows={2} className="input flex-1" placeholder="Escribe una respuesta…" aria-label="Mensaje" />
                <Submit pendingText="Enviando…">Enviar</Submit>
              </ActionForm>
            </div>
          </Card>
        ) : <Card><Empty title="Elige una conversación" /></Card>}
      </div>

      {isAdmin && (
        <Card className="mt-6" title="Números autorizados" sub="Solo se aceptan webhooks y envíos de números registrados. Webhooks: /api/webhooks/whatsapp/meta y /api/webhooks/whatsapp/ycloud">
          <ul className="mb-4 divide-y divide-line text-sm">
            {numbers.map((n, i) => (
              <li key={n.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="flex flex-wrap items-center gap-2">{n.label} · {n.phone} · {n.provider} · {n.branch.name} <StatusBadge map={NUMBER_STATUS} value={statuses[i]} /></span>
                <InlineAction action={numberStatusAction} fields={{ id: n.id, active: n.status === "DESACTIVADO" ? "1" : "0" }} label={n.status === "DESACTIVADO" ? "Reactivar" : "Desactivar"} />
              </li>
            ))}
          </ul>
          <ActionForm action={addNumberAction} resetOnOk className="grid gap-3 space-y-0 sm:grid-cols-5">
            <Field label="Teléfono"><input name="phone" required placeholder="+56912345678" className="input" /></Field>
            <Field label="Etiqueta"><input name="label" required className="input" /></Field>
            <Field label="Proveedor"><select name="provider" className="input"><option value="META">Meta Cloud API</option><option value="YCLOUD">YCloud</option></select></Field>
            <Field label="Sucursal"><select name="branchId" className="input">{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
            <div className="flex items-end"><Submit>Autorizar número</Submit></div>
          </ActionForm>
        </Card>
      )}
    </>
  );
}
