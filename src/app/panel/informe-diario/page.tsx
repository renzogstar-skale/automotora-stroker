import Link from "next/link";
import { notFound } from "next/navigation";
import { guard } from "@/lib/auth";
import { db } from "@/lib/db";
import { assertBranch, can } from "@/lib/rbac";
import { sp } from "@/lib/period";
import { addDays, dateTime, parseYmd, time, ymd } from "@/lib/format";
import { getReport, superviseDay } from "@/server/dailyreport";
import { Badge, Card, Empty, Field, Kpi, PageHeader, Table } from "@/components/ui";
import { ActionForm, Submit } from "@/components/client/forms";
import { reportAction } from "./actions";

export const metadata = { title: "Informe diario" };
type SP = Promise<Record<string, string | string[] | undefined>>;
const STATE: Record<string, [string, "green" | "amber" | "gray"]> = { ENVIADO: ["Enviado", "green"], BORRADOR: ["Borrador", "amber"], PENDIENTE: ["Pendiente", "gray"] };

export default async function InformeDiario({ searchParams }: { searchParams: SP }) {
  const a = await guard("dailyreport");
  const s = await searchParams;
  const sup = can(a, "dailyreport.supervise");
  const today = ymd(new Date());
  const day = /^\d{4}-\d{2}-\d{2}$/.test(sp(s, "d") ?? "") ? sp(s, "d")! : today;
  const sellerId = sup && sp(s, "seller") ? sp(s, "seller")! : a.sellerId;
  const seller = sellerId ? await db.seller.findUnique({ where: { id: sellerId }, include: { branch: true } }) : null;
  if (sellerId && !seller) notFound();
  if (seller && seller.id !== a.sellerId) assertBranch(a, seller.branchId);
  const [data, team] = await Promise.all([seller ? getReport(seller.id, day) : null, sup ? superviseDay(a, day) : null]);
  const r = data?.report;
  const editable = !!seller && seller.id === a.sellerId && r?.status !== "ENVIADO" && day <= today;
  const nav = (d: string) => `/panel/informe-diario?${new URLSearchParams({ d, ...(sp(s, "seller") ? { seller: sp(s, "seller")! } : {}) })}`;
  const byBranch = team ? Object.values(team.reduce<Record<string, typeof team>>((g, x) => ((g[x.branch.id] ??= []).push(x), g), {})) : [];
  return (
    <>
      <PageHeader title="Informe diario" desc="Llamadas precargadas desde el CRM, consignaciones contactadas, créditos, publicaciones y observaciones."
        actions={<div className="flex items-center gap-1">
          <Link className="btn btn-sm" href={nav(ymd(addDays(parseYmd(day), -1)))} aria-label="Día anterior">←</Link>
          <form className="flex gap-1">{sp(s, "seller") && <input type="hidden" name="seller" value={sp(s, "seller")} />}<input type="date" name="d" defaultValue={day} max={today} className="input h-8 w-40" aria-label="Día" /><button className="btn btn-sm">Ver</button></form>
          {day < today && <Link className="btn btn-sm" href={nav(ymd(addDays(parseYmd(day), 1)))} aria-label="Día siguiente">→</Link>}
        </div>} />

      {team && (
        <>
          <div className="mb-4 grid grid-cols-3 gap-2">
            <Kpi label="Entregados" value={team.filter((x) => x.state === "ENVIADO").length} />
            <Kpi label="En borrador" value={team.filter((x) => x.state === "BORRADOR").length} />
            <Kpi label="Pendientes" value={team.filter((x) => x.state === "PENDIENTE" && x.hasAccount).length} />
          </div>
          <div className="mb-4 grid gap-4 lg:grid-cols-2">
            {byBranch.map((rows) => (
              <Card key={rows[0].branch.id} title={rows[0].branch.name} sub={`${rows.filter((x) => x.state === "ENVIADO").length} de ${rows.filter((x) => x.hasAccount).length} entregados`} bodyClass="p-0">
                <Table>
                  <thead><tr><th>Vendedor</th><th>Estado</th><th className="text-right">Llamadas</th><th className="text-right">Consig.</th><th className="text-right">Créditos</th><th className="text-right">Public.</th><th>Enviado</th></tr></thead>
                  <tbody>{rows.map((x) => (
                    <tr key={x.seller.id} className={x.seller.id === seller?.id ? "bg-surface-2" : ""}>
                      <td><Link className="link" href={`/panel/informe-diario?d=${day}&seller=${x.seller.id}`}>{x.seller.name}</Link></td>
                      <td>{x.hasAccount ? <Badge tone={STATE[x.state][1]}>{STATE[x.state][0]}</Badge> : <span className="text-xs text-muted">Sin cuenta</span>}</td>
                      <td className="text-right tabular-nums">{x.calls ?? "—"}</td>
                      <td className="text-right tabular-nums">{x.consignment ?? "—"}</td>
                      <td className="text-right tabular-nums">{x.report?.status === "ENVIADO" ? x.report.creditsEntered : "—"}</td>
                      <td className="text-right tabular-nums">{x.report?.status === "ENVIADO" ? x.report.publications : "—"}</td>
                      <td className="text-xs text-muted">{x.report?.submittedAt ? time(x.report.submittedAt) : "—"}</td>
                    </tr>
                  ))}</tbody>
                </Table>
              </Card>
            ))}
          </div>
        </>
      )}

      {!seller ? (!team && <Card><Empty title="Sin cartera asignada" text="El informe diario lo registran los vendedores." /></Card>) : data && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2" title={`${seller.name} · ${day}`} sub={seller.branch.name}
            action={<Badge tone={STATE[r?.status ?? "PENDIENTE"][1]}>{STATE[r?.status ?? "PENDIENTE"][0]}{r?.submittedAt ? ` · ${dateTime(r.submittedAt)}` : ""}</Badge>} bodyClass="p-0">
            <h3 className="border-b border-line px-4 py-2 text-xs font-semibold text-muted">Llamadas registradas en el CRM ({data.calls.length})</h3>
            {data.calls.length === 0 ? <Empty compact title="Sin llamadas registradas ese día" text="Registra las llamadas en la ficha del lead para que se precarguen aquí." /> : (
              <ul>{data.calls.map((c, i) => <li key={i} className="flex gap-3 border-b border-line px-4 py-2 text-sm last:border-0"><span className="w-12 shrink-0 tabular-nums text-muted">{time(c.at)}</span><span className="min-w-0">{c.oppId ? <Link className="link" href={`/panel/crm/${c.oppId}`}>{c.contact}</Link> : c.contact}{c.outcome && <Badge className="ml-1">{c.outcome}</Badge>}<div className="truncate text-xs text-muted">{c.body}</div></span></li>)}</ul>
            )}
            <h3 className="border-y border-line px-4 py-2 text-xs font-semibold text-muted">Consignaciones contactadas ({data.consignment.length})</h3>
            {data.consignment.length === 0 ? <Empty compact title="Ninguna" /> : <ul>{data.consignment.map((c, i) => <li key={i} className="border-b border-line px-4 py-2 text-sm last:border-0">{c.oppId ? <Link className="link" href={`/panel/crm/${c.oppId}`}>{c.contact}</Link> : c.contact} <span className="text-xs text-muted">· {c.source === "CRM" ? `CRM ${time(c.at)}` : "Ingreso manual"}</span></li>)}</ul>}
            {!editable && r && (
              <div className="grid grid-cols-2 gap-3 border-t border-line p-4 text-sm">
                <p>Créditos ingresados: <b className="tabular-nums">{r.creditsEntered}</b></p>
                <p>Publicaciones: <b className="tabular-nums">{r.publications}</b></p>
                <p className="col-span-2 whitespace-pre-line text-muted">{r.notes || "Sin observaciones."}</p>
              </div>
            )}
          </Card>
          {editable ? (
            <Card title="Completar informe" sub="Guarda borrador y envíalo cuando cierres el día. Una vez enviado queda bloqueado.">
              <ActionForm action={reportAction}>
                <input type="hidden" name="day" value={day} />
                <Field label="Otras consignaciones contactadas" hint="Una por línea: propietario · vehículo · resultado. Las llamadas a leads de consignación del CRM se suman solas.">
                  <textarea name="consignments" rows={4} defaultValue={((r?.consignmentCalls ?? []) as { source: string; contact: string }[]).filter((c) => c.source === "MANUAL").map((c) => c.contact).join("\n")} className="input min-h-24 py-2" />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Créditos ingresados"><input type="number" name="creditsEntered" min={0} defaultValue={r?.creditsEntered ?? 0} className="input" /></Field>
                  <Field label="Publicaciones"><input type="number" name="publications" min={0} defaultValue={r?.publications ?? 0} className="input" /></Field>
                </div>
                <Field label="Observaciones"><textarea name="notes" rows={3} defaultValue={r?.notes ?? ""} className="input min-h-20 py-2" /></Field>
                <div className="flex justify-end gap-2">
                  <Submit name="intent" value="draft" className="btn">Guardar borrador</Submit>
                  <Submit name="intent" value="send" pendingText="Enviando…">Enviar informe</Submit>
                </div>
              </ActionForm>
            </Card>
          ) : !r && <Card><Empty compact title="Sin informe" text={seller.id === a.sellerId ? "No se puede informar un día futuro." : "El vendedor aún no registra su informe."} /></Card>}
        </div>
      )}
    </>
  );
}
