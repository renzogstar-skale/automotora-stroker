import Link from "next/link";
import { ExternalLink, Eye, Monitor, Smartphone } from "lucide-react";
import { guard } from "@/lib/auth";
import { db } from "@/lib/db";
import { sp } from "@/lib/period";
import { VEHICLE_STATUS } from "@/lib/labels";
import { dateTime } from "@/lib/format";
import { getSetting } from "@/server/settings";
import { DNS_TARGET, fullConfig, getSite, webMetrics } from "@/server/web";
import { Badge, Card, Field, Kpi, Notice, PageHeader, StatusBadge, Table, Tabs } from "@/components/ui";
import { ActionForm, InlineAction, Submit } from "@/components/client/forms";
import { Lines } from "@/components/client/charts";
import { discardDraftAction, domainAction, publishWebAction, saveDraftAction } from "./actions";

export const metadata = { title: "Mi Web" };

const TABS = { editar: "Editar", vista: "Vista previa", metricas: "Métricas (30 días)", dominio: "Dominio" } as const;
const DOMAIN: Record<string, [string, "green" | "amber" | "red"]> = { ACTIVO: ["Activo", "green"], PENDIENTE_DNS: ["Pendiente de DNS", "amber"], DNS_INCORRECTO: ["DNS incorrecto", "red"] };
const KIND: Record<string, string> = { CONSULTA: "Consultas", TEST_DRIVE: "Test drive", CONSIGNACION: "Consignaciones" };

export default async function MiWeb({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await guard("web.admin");
  const s = await searchParams;
  const tab = (sp(s, "tab") ?? "editar") as keyof typeof TABS;
  const w = await getSetting("web");
  const hasDraft = !!w.draft;
  const tabHref = (k: string) => `/panel/sistema/mi-web?tab=${k}`;
  return (
    <>
      <PageHeader title="Mi Web" desc={<>Vitrina pública · {hasDraft ? <b className="text-amber-700 dark:text-amber-400">Hay cambios en borrador sin publicar</b> : "Sin cambios pendientes"}{w.publishedAt && ` · última publicación ${dateTime(w.publishedAt)}`}</>}
        actions={<>
          <Link className="btn" href={tabHref("editar")}>Editar</Link>
          <Link className="btn" href={tabHref("vista")}><Eye className="size-4" />Vista previa</Link>
          {hasDraft && <InlineAction action={publishWebAction} label="Publicar cambios" className="btn btn-primary" />}
          <a className="btn" href="/" target="_blank" rel="noreferrer"><ExternalLink className="size-4" />Ver la web</a>
        </>} />
      <Tabs items={Object.entries(TABS).map(([k, l]) => ({ href: tabHref(k), label: l, active: tab === k }))} />
      {tab === "editar" && <Editor />}
      {tab === "vista" && <Preview vp={sp(s, "vp") === "movil" ? "movil" : "escritorio"} page={sp(s, "pagina") ?? "/"} hasDraft={hasDraft} />}
      {tab === "metricas" && <Metrics />}
      {tab === "dominio" && <Domain domain={w.domain} status={w.domainStatus} />}
    </>
  );
}

async function Editor() {
  const w = await getSetting("web");
  const cfg = fullConfig(w.draft ?? w.published);
  const { branches } = await getSite(true);
  const vehicles = await db.vehicle.findMany({ where: { published: true, status: { in: ["DISPONIBLE", "RESERVADO"] } }, select: { id: true, brand: true, model: true, year: true, plate: true, status: true }, orderBy: [{ brand: "asc" }, { model: "asc" }] });
  return (
    <ActionForm action={saveDraftAction} className="space-y-4">
      {w.draft && <div className="flex flex-wrap items-center gap-2"><Notice tone="amber">Estás editando el borrador. La web pública no cambia hasta que presiones «Publicar cambios».</Notice><InlineAction action={discardDraftAction} label="Descartar borrador" className="btn btn-sm btn-danger" confirm /></div>}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Marca">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombre en el logo"><input name="logoText" defaultValue={cfg.logoText} required className="input" /></Field>
            <Field label="Logo (imagen)" hint={cfg.logoImage ? "Hay un logo cargado" : "Opcional: PNG, JPG o WEBP"}><input type="file" name="logoFile" accept="image/png,image/jpeg,image/webp" className="text-sm" /></Field>
            {cfg.logoImage && (
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={cfg.logoImage} alt="Logo" className="h-8 w-auto rounded" />
                <input type="checkbox" name="removeLogo" />Quitar el logo y usar la inicial
              </label>
            )}
            <Field label="Color principal"><input type="color" name="accent" defaultValue={cfg.accent} className="input h-10 p-1" /></Field>
            <Field label="Color secundario (portada y pie)"><input type="color" name="secondary" defaultValue={cfg.secondary} className="input h-10 p-1" /></Field>
          </div>
        </Card>
        <Card title="Portada">
          <div className="grid gap-3">
            <Field label="Título / Lema principal"><input name="heroTitle" defaultValue={cfg.heroTitle} required className="input" /></Field>
            <Field label="Traducción del lema"><input name="taglineTranslation" defaultValue={cfg.taglineTranslation ?? "Autos especiales para gente especial"} className="input" /></Field>
            <Field label="Bajada / Descripción"><textarea name="heroSubtitle" defaultValue={cfg.heroSubtitle} rows={3} className="input h-auto py-2" /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Imagen de portada (URL)"><input name="heroImage" defaultValue={cfg.heroImage} className="input" /></Field>
              <Field label="…o subir imagen"><input type="file" name="heroFile" accept="image/png,image/jpeg,image/webp" className="text-sm" /></Field>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {cfg.heroImage && <img src={cfg.heroImage} alt="Portada actual" className="h-24 w-full rounded-lg object-cover" />}
          </div>
        </Card>
        <Card title="Textos y contacto">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Quiénes somos (Sobre nosotros)" className="sm:col-span-3"><textarea name="aboutText" defaultValue={cfg.aboutText} rows={3} className="input h-auto py-2" /></Field>
            <Field label="Dirección principal" className="sm:col-span-3"><input name="address" defaultValue={cfg.address ?? "Av. Jaime Guzmán 4050, Club Pádel Llacolén, Antofagasta, Chile"} className="input" /></Field>
            <Field label="Enlace de ubicación (Google)" className="sm:col-span-3"><input name="locationUrl" defaultValue={cfg.locationUrl ?? "https://www.google.com/search?kgmid=%2Fg%2F11zd3t8786"} className="input" /></Field>
            <Field label="Teléfono"><input name="phone" defaultValue={cfg.phone} className="input" /></Field>
            <Field label="Correo"><input name="email" type="email" defaultValue={cfg.email} className="input" /></Field>
            <Field label="WhatsApp general"><input name="whatsapp" defaultValue={cfg.whatsapp} required className="input" /></Field>
          </div>
        </Card>
        <Card title="Destacados en portada" sub="Sin selección se muestran los marcados como destacados y los más recientes.">
          <div className="max-h-64 space-y-1 overflow-y-auto text-sm">
            {vehicles.map((v) => <label key={v.id} className="flex items-center gap-2"><input type="checkbox" name="featuredIds" value={v.id} defaultChecked={cfg.featuredIds.includes(v.id)} />{v.brand} {v.model} {v.year} <span className="text-xs text-muted">{v.plate}</span>{v.status === "RESERVADO" && <StatusBadge map={VEHICLE_STATUS} value={v.status} />}</label>)}
            {!vehicles.length && <p className="text-muted">No hay unidades publicadas.</p>}
          </div>
        </Card>
      </div>
      <Card title="Sucursales" action={<label className="flex items-center gap-2 text-sm"><input type="checkbox" name="showBranches" defaultChecked={cfg.showBranches} />Mostrar sección de sucursales</label>}>
        <div className="space-y-3">
          {branches.map((b) => (
            <div key={b.id} className="grid gap-2 rounded-lg border border-line p-3 sm:grid-cols-6">
              <input type="hidden" name="branchIds" value={b.id} />
              <label className="flex items-center gap-2 text-sm font-medium sm:col-span-6"><input type="checkbox" name={`b_${b.id}_visible`} defaultChecked={b.visible} />{b.name} visible en la web</label>
              <Field label="Dirección" className="sm:col-span-2"><input name={`b_${b.id}_address`} defaultValue={b.address} className="input" /></Field>
              <Field label="Teléfono"><input name={`b_${b.id}_phone`} defaultValue={b.phone} className="input" /></Field>
              <Field label="WhatsApp"><input name={`b_${b.id}_whatsapp`} defaultValue={b.whatsapp} className="input" /></Field>
              <Field label="Horario" className="sm:col-span-2"><input name={`b_${b.id}_hours`} defaultValue={b.hours} className="input" /></Field>
            </div>
          ))}
        </div>
      </Card>
      <div className="flex justify-end"><Submit>Guardar borrador</Submit></div>
    </ActionForm>
  );
}

function Preview({ vp, page, hasDraft }: { vp: "escritorio" | "movil"; page: string; hasDraft: boolean }) {
  const safe = ["/", "/autos", "/consignar"].includes(page) ? page : "/";
  const h = (o: { vp?: string; pagina?: string }) => `/panel/sistema/mi-web?tab=vista&vp=${o.vp ?? vp}&pagina=${encodeURIComponent(o.pagina ?? safe)}`;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={h({ vp: "escritorio" })} className={`btn ${vp === "escritorio" ? "btn-dark" : ""}`}><Monitor className="size-4" />Escritorio</Link>
        <Link href={h({ vp: "movil" })} className={`btn ${vp === "movil" ? "btn-dark" : ""}`}><Smartphone className="size-4" />Móvil</Link>
        <span className="mx-2 h-6 w-px bg-line" />
        {[["/", "Inicio"], ["/autos", "Catálogo"], ["/consignar", "Consignar"]].map(([p, l]) => <Link key={p} href={h({ pagina: p })} className={`btn btn-sm ${safe === p ? "btn-dark" : ""}`}>{l}</Link>)}
        <span className="text-xs text-muted">{hasDraft ? "Mostrando el borrador." : "Sin borrador: se muestra la versión publicada."}</span>
      </div>
      <div className="flex justify-center rounded-xl border border-line bg-surface-2 p-4">
        <iframe title="Vista previa de la web" src={`${safe}?preview=1`} className={`rounded-lg border border-line bg-white shadow ${vp === "movil" ? "h-[760px] w-[390px]" : "h-[760px] w-full"}`} />
      </div>
    </div>
  );
}

async function Metrics() {
  const m = await webMetrics(30);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Kpi label="Vistas" value={m.views.toLocaleString("es-CL")} sub={`${m.visitors.toLocaleString("es-CL")} visitantes únicos`} />
        <Kpi label="Contactos recibidos" value={m.contacts} sub={Object.entries(m.contactsByKind).map(([k, n]) => `${KIND[k] ?? k}: ${n}`).join(" · ") || "Formularios procesados"} />
        <Kpi label="Clics a WhatsApp" value={m.whatsapp} sub="Se cuentan como clics, no como contactos" />
        <Kpi label="Tasa de contacto" value={m.views ? `${((m.contacts / m.views) * 100).toLocaleString("es-CL", { maximumFractionDigits: 1 })}%` : "Sin datos"} sub="Contactos ÷ vistas" />
      </div>
      <Card title="Vistas y clics por día">{m.daily.length ? <Lines data={m.daily} series={[{ key: "Vistas", label: "Vistas" }, { key: "WhatsApp", label: "Clics WhatsApp" }]} money={false} yLabel="Eventos" /> : <p className="text-sm text-muted">Sin visitas en el período.</p>}</Card>
      <Card title="Vehículos más vistos" bodyClass="p-0">
        <Table><thead><tr><th>Vehículo</th><th>Estado</th><th className="num">Vistas</th><th className="num">Clics WhatsApp</th></tr></thead><tbody>
          {m.top.map((t) => <tr key={t.vehicle.id}><td><Link className="link" href={`/panel/inventario/${t.vehicle.id}`}>{t.vehicle.brand} {t.vehicle.model} {t.vehicle.year}</Link> <span className="text-xs text-muted">{t.vehicle.plate}</span></td><td><StatusBadge map={VEHICLE_STATUS} value={t.vehicle.status} />{!t.vehicle.published && <Badge className="ml-1">No publicado</Badge>}</td><td className="num">{t.views}</td><td className="num">{t.clicks}</td></tr>)}
          {!m.top.length && <tr><td colSpan={4} className="text-muted">Sin datos.</td></tr>}
        </tbody></Table>
      </Card>
    </div>
  );
}

function Domain({ domain, status }: { domain: string; status: string }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Estado del dominio" action={<StatusBadge map={DOMAIN} value={status} />}>
        <ActionForm action={domainAction} className="space-y-3">
          <Field label="Dominio público"><input name="domain" defaultValue={domain} required className="input" placeholder="autos.tuempresa.cl" /></Field>
          <Submit>Guardar y verificar DNS</Submit>
        </ActionForm>
      </Card>
      <Card title="Cómo conectarlo">
        <ol className="list-decimal space-y-1.5 pl-5 text-sm">
          <li>En tu proveedor de dominio crea un registro <b>CNAME</b> para <code>{domain.split(".")[0]}</code> apuntando a <code>{DNS_TARGET}</code>.</li>
          <li>Agrega el dominio en el proyecto de hosting.</li>
          <li>Espera la propagación (minutos a 48 h) y presiona «Guardar y verificar DNS».</li>
        </ol>
      </Card>
    </div>
  );
}
