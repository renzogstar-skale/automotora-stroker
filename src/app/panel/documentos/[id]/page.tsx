import { notFound } from "next/navigation";
import { FileDown } from "lucide-react";
import { guard } from "@/lib/auth";
import { db } from "@/lib/db";
import { DOC_STATUS, DOC_TYPE } from "@/lib/labels";
import { dateTime } from "@/lib/format";
import { loadDocFor, render } from "@/server/documents";
import { Card, Field, PageHeader, StatusBadge } from "@/components/ui";
import { ActionForm, InlineAction, Submit } from "@/components/client/forms";
import { emitAction, saveDraftAction, voidDocAction } from "../actions";

export default async function Doc({ params }: { params: Promise<{ id: string }> }) {
  const a = await guard("documents");
  const { id } = await params;
  const d = await loadDocFor(a, id).catch(() => null);
  if (!d) notFound();
  const tpl = await db.documentTemplate.findUniqueOrThrow({ where: { id: d.templateId } });
  const data = d.data as Record<string, Record<string, string> | string>;
  const text = render(d.bodySnapshot ?? tpl.body, { ...data, folio: d.folio });
  const groups = Object.entries(data).filter(([k, v]) => typeof v === "object" && v && !k.startsWith("_") && k !== "empresa" && Object.keys(v).length) as [string, Record<string, string>][];
  return (
    <>
      <PageHeader title={`${DOC_TYPE[d.type]} · ${d.folio}`} desc={d.emittedAt ? `Plantilla «${d.templateName ?? tpl.name}» v${d.templateVersion} · emitido ${dateTime(d.emittedAt)}${d.pdfSha256 ? ` · PDF archivado (sha256 ${d.pdfSha256.slice(0, 12)}…)` : ""}` : `Borrador · usa la plantilla vigente «${tpl.name}» v${tpl.version}; se congela al emitir`}
        actions={<><StatusBadge map={DOC_STATUS} value={d.status} /><a className="btn" href={`/api/documents/${d.id}/pdf`} target="_blank"><FileDown className="size-4" />{d.status === "BORRADOR" ? "Previsualizar PDF" : "Descargar PDF"}</a>
          {d.status === "BORRADOR" && <InlineAction action={emitAction} fields={{ id: d.id }} label="Emitir documento" className="btn btn-primary" confirm />}
          {d.status === "EMITIDO" && <InlineAction action={voidDocAction} fields={{ id: d.id }} label="Anular" reasonLabel="Motivo" className="btn btn-sm btn-danger" />}</>} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Vista previa">
          <div className="whitespace-pre-wrap rounded-lg border border-line bg-surface-2 p-4 font-serif text-sm leading-relaxed">{text.replace(/^# /gm, "")}</div>
        </Card>
        <Card title="Datos usados" sub={d.status === "BORRADOR" ? "Autocompletados desde la ficha; puedes corregirlos antes de emitir." : "Congelados al emitir junto con la versión de la plantilla."}>
          <ActionForm action={saveDraftAction} className="grid gap-2 space-y-0 sm:grid-cols-2">
            <input type="hidden" name="id" value={d.id} />
            {groups.flatMap(([g, fields]) => Object.entries(fields).map(([f, v]) => (
              <Field key={`${g}.${f}`} label={`${g} · ${f.replace("_", " ")}`}><input name={`${g}.${f}`} defaultValue={v} disabled={d.status !== "BORRADOR"} className="input" /></Field>
            )))}
            {d.status === "BORRADOR" && <div className="flex justify-end sm:col-span-2"><Submit>Guardar borrador</Submit></div>}
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
