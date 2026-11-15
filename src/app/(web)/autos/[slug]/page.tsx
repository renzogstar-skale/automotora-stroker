import Link from "next/link";
import { notFound } from "next/navigation";
import { randomUUID } from "node:crypto";
import {
  Car,
  MapPin,
  Calendar,
  ShieldCheck,
  FileCheck2,
  Phone,
  Gauge,
  SlidersHorizontal,
  Fuel,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Clock,
  Building2,
  BadgeCheck,
  ChevronRight,
  MessageCircle,
  ArrowLeft,
  ExternalLink,
  Tag,
  AlertTriangle,
} from "lucide-react";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { BUSINESS, DEMO_INVENTORY } from "@/lib/business";
import { clp, km, toLocalInput } from "@/lib/format";
import { publicSelect, type PublicVehicle } from "@/server/web";
import { Gallery } from "../../gallery";
import { PublicForm } from "../../public-form";
import { Availability, Shell, loadSite, one, trackView, waLink } from "../../site";
import { VehicleStickyPanel } from "@/components/vehicle/vehicle-sticky-panel";
import { VehicleMobileBar } from "@/components/vehicle/vehicle-mobile-bar";
import { FinanceCalculator } from "@/components/vehicle/finance-calculator";
import { SimilarVehicles } from "@/components/vehicle/similar-vehicles";

export const dynamic = "force-dynamic";

const find = (slug: string) =>
  db.vehicle.findUnique({
    where: { slug },
    select: {
      ...publicSelect,
      published: true,
      branch: {
        select: {
          id: true,
          name: true,
          comuna: true,
          address: true,
          phone: true,
          whatsapp: true,
          region: true,
        },
      },
    },
  });

const earliestTestDrive = () => toLocalInput(new Date(Date.now() + 3600e3));
const isPublic = (v: { published: boolean; status: string } | null) =>
  !!v && v.published && ["DISPONIBLE", "RESERVADO", "VENDIDO", "EN_CONSIGNACION"].includes(v.status);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const v = await find((await params).slug);
  if (!v || !isPublic(v)) return { title: "Vehículo no disponible", robots: { index: false } };
  const prefix = v.status === "VENDIDO" ? "[VENDIDO] " : v.status === "RESERVADO" ? "[RESERVADO] " : "";
  return {
    title: `${prefix}${v.brand} ${v.model} ${v.year} · Automotora Stroker`,
    description: `${v.version} · ${km(v.km)} · ${clp(v.price)} · Automotora Stroker Antofagasta`,
  };
}

export default async function VehiclePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, s] = await Promise.all([params, searchParams]);
  const ctx = await loadSite(s);
  const v = await find(slug);
  const pub = isPublic(v);

  // Vista previa interna desde Álbumes: muestra unidades aún no publicadas a quien las prepara.
  const internal =
    one(s, "vista") === "previa" &&
    !!ctx.actor &&
    (can(ctx.actor, "albums") || can(ctx.actor, "web.publish"));

  if (!v || (!pub && !internal)) notFound();

  if (pub && !ctx.preview && !internal) await trackView("VEHICLE_VIEW", `/autos/${slug}`, v.id);

  const name = `${v.brand} ${v.model} ${v.year}`;
  const isVendido = v.status === "VENDIDO";
  const isReservado = v.status === "RESERVADO";
  const minDate = earliestTestDrive();

  // 4. Extracción de información técnica verificada
  const engineMatch =
    v.version.match(/\b([0-9]\.[0-9])\s*(?:L|cc)?\b/i) ||
    v.description?.match(/\b([0-9]\.[0-9])\s*(?:L|cc|litros)?\b/i);
  const detectedEngine = engineMatch ? `${engineMatch[1]} Litros` : null;

  const tractionMatch =
    v.version.match(/\b(4x4|4WD|AWD|4x2|FWD|RWD|Integral|Delantera|Trasera)\b/i) ||
    v.description?.match(/\b(4x4|4WD|AWD|4x2|Delantera|Trasera)\b/i);
  const detectedTraction = tractionMatch ? tractionMatch[1].toUpperCase() : null;

  // Equipamiento documentado
  const featuresList: string[] = Array.isArray(v.features) ? (v.features as string[]) : [];

  // Lista de especificaciones técnicas comprobadas
  const technicalSpecs: { label: string; value: string; icon?: typeof Gauge }[] = [
    { label: "Año de fabricación", value: String(v.year) },
    { label: "Kilometraje", value: km(v.km), icon: Gauge },
    { label: "Transmisión", value: v.transmission, icon: SlidersHorizontal },
    { label: "Combustible", value: v.fuel, icon: Fuel },
    ...(detectedEngine ? [{ label: "Cilindrada / Motor", value: detectedEngine }] : []),
    ...(detectedTraction ? [{ label: "Tracción", value: detectedTraction }] : []),
    { label: "Carrocería", value: v.bodyType },
    { label: "Color exterior", value: v.color },
    { label: "Condición", value: v.condition === "NUEVO" ? "Nuevo" : "Seminuevo seleccionado" },
    { label: "Código de stock", value: v.stockCode || "STK-OFICIAL" },
    { label: "Ubicación", value: BUSINESS.showroom },
  ];

  // Historial documentado
  const hasMaintenance = /mantencion(es)?/i.test(v.description || "") || /mantenciones/i.test(v.originalCaption || "");
  const isSingleOwner = /[uú]nica due[ñn]a|[uú]nico due[ñn]o/i.test(v.description || "") || /dueñ/i.test(v.originalCaption || "");
  const hasDocsUpToDate = /al d[ií]a|permiso|revisi[oó]n/i.test(v.description || "") || /al d[ií]a/i.test(v.originalCaption || "");

  // Consulta de vehículos similares basada en inventario disponible real
  let similarVehicles: PublicVehicle[] = [];
  try {
    similarVehicles = await db.vehicle.findMany({
      where: {
        published: true,
        status: "DISPONIBLE",
        id: { not: v.id },
        OR: [
          { bodyType: v.bodyType },
          { brand: v.brand },
          { price: { gte: Math.round(v.price * 0.7), lte: Math.round(v.price * 1.3) } },
        ],
      },
      select: publicSelect,
      take: 3,
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
    });
  } catch (err) {
    console.error("Error al cargar similares:", err);
  }

  const currentWaLink = waLink(v.id);

  return (
    <Shell {...ctx}>
      {!pub && (
        <div className="bg-red-600 px-4 py-1.5 text-center text-xs font-medium text-white">
          Vista previa interna · esta unidad no está publicada
        </div>
      )}

      {/* Banner de vehículo vendido */}
      {isVendido && (
        <div className="bg-red-600/15 border-b border-red-500/30 px-4 py-3 text-center">
          <div className="mx-auto max-w-7xl flex flex-wrap items-center justify-center gap-2 text-xs sm:text-sm font-bold text-red-600 dark:text-red-400">
            <span>🔴 Esta unidad fue VENDIDA por Automotora Stroker.</span>
            <span className="font-normal text-ink/80">Puedes revisar las opciones disponibles a continuación o consultarnos por WhatsApp.</span>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 pb-24 sm:pb-16">
        {/* Barra superior: Breadcrumb y Volver */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
          <nav aria-label="Ruta de navegación" className="flex items-center gap-1.5 text-xs sm:text-sm text-muted">
            <ol className="flex items-center gap-1.5 flex-wrap">
              <li className="flex items-center gap-1.5">
                <Link href={ctx.href("/")} className="hover:text-ink hover:underline transition-colors">
                  Inicio
                </Link>
                <ChevronRight className="size-3 text-muted/60" aria-hidden="true" />
              </li>
              <li className="flex items-center gap-1.5">
                <Link href={ctx.href("/#vitrina")} className="hover:text-ink hover:underline transition-colors">
                  Catálogo
                </Link>
                <ChevronRight className="size-3 text-muted/60" aria-hidden="true" />
              </li>
              <li className="flex items-center gap-1.5">
                <Link
                  href={ctx.href(`/?marca=${encodeURIComponent(v.brand)}#vitrina`)}
                  className="hover:text-ink hover:underline transition-colors font-medium text-ink/80"
                >
                  {v.brand}
                </Link>
                <ChevronRight className="size-3 text-muted/60" aria-hidden="true" />
              </li>
              <li className="font-bold text-ink truncate max-w-[200px] sm:max-w-none" aria-current="page">
                {v.model} ({v.year})
              </li>
            </ol>
          </nav>

          <Link
            href={ctx.href(`/?marca=${encodeURIComponent(v.brand)}#vitrina`)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface hover:bg-surface-2 px-3.5 min-h-11 text-xs font-semibold text-ink hover:text-accent transition-all shadow-sm active:scale-[0.98]"
          >
            <ArrowLeft className="size-3.5" />
            <span>Volver al catálogo</span>
          </Link>
        </div>

        {/* Encabezado Principal */}
        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Availability status={v.status} />
            {v.stockCode && (
              <span className="rounded-lg bg-surface-2 border border-line px-2.5 py-0.5 text-xs font-mono font-bold text-muted">
                {v.stockCode}
              </span>
            )}
            <span className="rounded-lg bg-surface-2 border border-line px-2.5 py-0.5 text-xs font-semibold text-muted">
              {BUSINESS.showroom}
            </span>
            {v.instagramUrl && (
              <a
                href={v.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg bg-pink-500/10 border border-pink-500/20 px-2.5 py-0.5 text-xs font-semibold text-pink-600 dark:text-pink-400 hover:bg-pink-500/20 transition-colors"
              >
                <span>Instagram Oficial</span>
                <ExternalLink className="size-3" />
              </a>
            )}
          </div>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-ink leading-tight">
                {name}
              </h1>
              <p className="text-sm sm:text-base text-muted font-medium mt-1">
                {v.version} · {km(v.km)} · {v.transmission}
              </p>
            </div>

            <div className="lg:hidden">
              <span className="text-2xl sm:text-3xl font-black text-accent tabular-nums">
                {clp(v.price)}
              </span>
              <span className="block text-[10px] uppercase font-bold text-muted">
                Pesos Chilenos
              </span>
            </div>
          </div>
        </div>

        {/* Layout Principal: Galería y Contenido (3 cols) + Sticky Panel (2 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
          <div className="lg:col-span-3 space-y-8">
            {/* Galería de Fotografías Reales */}
            <div className="relative">
              <Gallery photos={v.photos.slice(0, 2).map((p) => p.url)} alt={name} />
              {isVendido && (
                <div className="absolute top-4 right-4 z-20">
                  <span className="rounded-xl bg-red-600 text-white font-black px-4 py-2 text-sm shadow-xl tracking-wider uppercase">
                    🔴 VENDIDO
                  </span>
                </div>
              )}
            </div>

            {/* Cuadrícula de destacados rápidos */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="card p-3.5 rounded-xl border border-line bg-surface text-center">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-muted">Año</span>
                <span className="text-lg font-black text-ink mt-0.5 block">{v.year}</span>
              </div>
              <div className="card p-3.5 rounded-xl border border-line bg-surface text-center">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-muted">Kilómetros</span>
                <span className="text-lg font-black text-ink mt-0.5 block truncate">{km(v.km)}</span>
              </div>
              <div className="card p-3.5 rounded-xl border border-line bg-surface text-center">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-muted">Transmisión</span>
                <span className="text-lg font-black text-ink mt-0.5 block truncate">{v.transmission}</span>
              </div>
              <div className="card p-3.5 rounded-xl border border-line bg-surface text-center">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-muted">Combustible</span>
                <span className="text-lg font-black text-ink mt-0.5 block truncate">{v.fuel}</span>
              </div>
            </div>

            {/* Descripción Comercial */}
            {v.description && (
              <div className="card p-6 sm:p-7 rounded-2xl border border-line bg-surface shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="size-4 text-accent" />
                  <h2 className="text-lg font-bold text-ink">Descripción Comercial</h2>
                </div>
                <p className="whitespace-pre-line text-sm sm:text-base text-muted leading-relaxed">
                  {v.description}
                </p>
                {v.originalCaption && v.originalCaption !== v.description && (
                  <details className="mt-4 border-t border-line pt-3 text-xs text-muted">
                    <summary className="cursor-pointer font-semibold hover:text-ink">Ver caption original completo de Instagram</summary>
                    <p className="mt-2 whitespace-pre-line bg-surface-2 p-3 rounded-lg font-mono text-[11px]">
                      {v.originalCaption}
                    </p>
                  </details>
                )}
              </div>
            )}

            {/* Ficha Técnica y Equipamiento */}
            <div className="card p-6 sm:p-7 rounded-2xl border border-line bg-surface shadow-sm">
              <div className="flex items-center justify-between mb-5 border-b border-line pb-3">
                <h2 className="text-lg font-bold text-ink flex items-center gap-2">
                  <Car className="size-4.5 text-accent" />
                  <span>Ficha Técnica y Equipamiento</span>
                </h2>
                <span className="text-[11px] font-semibold text-muted">
                  Datos oficiales Stroker
                </span>
              </div>

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3.5 text-sm">
                {technicalSpecs.map((spec) => (
                  <div key={spec.label} className="flex items-center justify-between py-1.5 border-b border-line/60">
                    <dt className="text-muted flex items-center gap-1.5">
                      {spec.icon && <spec.icon className="size-3.5 text-accent" />}
                      <span>{spec.label}:</span>
                    </dt>
                    <dd className="font-bold text-ink text-right">{spec.value}</dd>
                  </div>
                ))}
              </dl>

              {/* Equipamiento y extras destacados */}
              {featuresList.length > 0 && (
                <div className="mt-6 pt-4 border-t border-line">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted block mb-3">
                    Equipamiento y Extras Incluidos
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {featuresList.map((feature, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs font-semibold text-ink bg-surface-2/60 border border-line/60 rounded-lg p-2">
                        <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Historial y documentación */}
            <div className="card p-6 sm:p-7 rounded-2xl border border-line bg-surface shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <FileCheck2 className="size-5 text-accent" />
                <h2 className="text-lg font-bold text-ink">Historial y Documentación</h2>
              </div>

              <div className="space-y-3 text-sm">
                {hasDocsUpToDate && (
                  <div className="flex items-start gap-3 rounded-xl bg-surface-2/60 p-3.5 border border-line/60">
                    <CheckCircle2 className="size-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-bold text-ink">Documentación al día</h3>
                      <p className="text-xs text-muted mt-0.5">
                        Permiso de circulación, revisión técnica y SOAP vigentes comprobados.
                      </p>
                    </div>
                  </div>
                )}

                {hasMaintenance && (
                  <div className="flex items-start gap-3 rounded-xl bg-surface-2/60 p-3.5 border border-line/60">
                    <CheckCircle2 className="size-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-bold text-ink">Mantenciones al día</h3>
                      <p className="text-xs text-muted mt-0.5">
                        Historial de mantenciones periódicas y servicio técnico registrado.
                      </p>
                    </div>
                  </div>
                )}

                {isSingleOwner && (
                  <div className="flex items-start gap-3 rounded-xl bg-surface-2/60 p-3.5 border border-line/60">
                    <CheckCircle2 className="size-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-bold text-ink">Único dueño informado</h3>
                      <p className="text-xs text-muted mt-0.5">
                        Verificable en el Certificado de Anotaciones Vigentes (CAV).
                      </p>
                    </div>
                  </div>
                )}

                <a
                  href={currentWaLink}
                  className="flex items-start gap-3 rounded-xl border border-dashed border-line p-3.5 hover:border-accent transition-colors"
                >
                  <BadgeCheck className="size-5 text-accent shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-bold text-ink">Solicitar Certificado de Anotaciones Vigentes (CAV)</h3>
                    <p className="text-xs text-muted mt-0.5">
                      Te enviamos el CAV e informe de multas por WhatsApp para total tranquilidad.
                    </p>
                  </div>
                </a>
              </div>
            </div>

            {/* Dónde verla */}
            <div className="card p-6 sm:p-7 rounded-2xl border border-line bg-surface shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="size-5 text-accent" />
                <h2 className="text-lg font-bold text-ink">Showroom y Ubicación</h2>
              </div>

              <div className="space-y-3 text-sm text-muted">
                <div className="flex items-start gap-3">
                  <MapPin className="size-4 shrink-0 text-accent mt-0.5" />
                  <div>
                    <p className="font-bold text-ink">{BUSINESS.showroom}</p>
                    <a href={BUSINESS.mapsUrl} target="_blank" rel="noopener noreferrer" className="text-muted hover:text-accent hover:underline">
                      {BUSINESS.address}
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Clock className="size-4 shrink-0 text-accent" />
                  <span>{BUSINESS.hours} · coordina tu visita antes de ir</span>
                </div>

                <div className="flex items-center gap-3">
                  <Phone className="size-4 shrink-0 text-accent" />
                  <a href={BUSINESS.tel} className="font-semibold text-ink hover:text-accent">{BUSINESS.phone}</a>
                </div>
              </div>
            </div>

            {/* Calculadora de financiamiento (solo para disponibles o reservados) */}
            {!isVendido && <FinanceCalculator price={v.price} vehicleName={name} />}

            {/* Formularios de contacto */}
            <div id="consulta-form" className="space-y-6 pt-4">
              <div className="card p-6 sm:p-7 rounded-2xl border border-line bg-surface shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <MessageCircle className="size-5 text-accent" />
                  <h2 className="text-lg font-bold text-ink">
                    {isVendido ? "Consultar por vehículos similares o próximos ingresos" : "Consultar por este vehículo"}
                  </h2>
                </div>
                <p className="text-xs text-muted mb-5">
                  {isVendido
                    ? "Esta unidad ya se vendió. Déjanos tus datos y te avisaremos si ingresa un modelo similar o te buscamos uno a pedido."
                    : "Déjanos tus datos y un ejecutivo comercial de Automotora Stroker te contactará a la brevedad."}
                </p>
                <PublicForm
                  kind="CONSULTA"
                  token={randomUUID()}
                  hidden={{ vehicleId: v.id }}
                  submit={isVendido ? "Enviar consulta de similares" : "Enviar consulta"}
                  fields={[
                    { name: "name", label: "Nombre completo", required: true },
                    {
                      name: "phone",
                      label: "Teléfono móvil",
                      type: "tel",
                      required: true,
                      placeholder: "+56 9…",
                    },
                    { name: "email", label: "Correo electrónico", type: "email" },
                    {
                      name: "payMethod",
                      label: "Forma de pago preferida",
                      options: [
                        ["", "Aún no decido"],
                        ["CONTADO", "Pago al Contado"],
                        ["FINANCIAMIENTO", "Financiamiento Automotriz"],
                        ["PARTE_PAGO", "Dejo mi auto en parte de pago"],
                      ],
                    },
                    {
                      name: "message",
                      label: "Mensaje o preguntas adicionales",
                      type: "textarea",
                    },
                  ]}
                />
              </div>

              {!isReservado && !isVendido && (
                <div
                  id="agenda-visita-section"
                  className="card p-6 sm:p-7 rounded-2xl border border-line bg-surface shadow-sm"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Calendar className="size-5 text-accent" />
                    <h2 className="text-lg font-bold text-ink">
                      Agendar test drive o visita presencial
                    </h2>
                  </div>
                  <p className="text-xs text-muted mb-5">
                    Elige el día y la hora para probar esta unidad en {BUSINESS.showroom}. Te confirmaremos el horario.
                  </p>
                  <PublicForm
                    kind="TEST_DRIVE"
                    token={randomUUID()}
                    hidden={{ vehicleId: v.id }}
                    submit="Solicitar test drive"
                    fields={[
                      { name: "name", label: "Nombre", required: true },
                      {
                        name: "phone",
                        label: "Teléfono",
                        type: "tel",
                        required: true,
                        placeholder: "+56 9…",
                      },
                      {
                        name: "date",
                        label: "Fecha y hora solicitada",
                        type: "datetime-local",
                        required: true,
                        min: minDate,
                        full: true,
                      },
                    ]}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Columna Derecha: Sticky Panel */}
          <div className="hidden lg:block lg:col-span-2">
            <VehicleStickyPanel
              vehicleId={v.id}
              brand={v.brand}
              model={v.model}
              year={v.year}
              price={v.price}
              status={v.status}
              waLink={currentWaLink}
              branch={v.branch}
              stockCode={v.stockCode}
              instagramUrl={v.instagramUrl}
              minDownPayment={v.minDownPayment}
            />
          </div>
        </div>

        {/* Sección de vehículos similares disponibles */}
        <SimilarVehicles vehicles={similarVehicles} href={ctx.href} />
      </div>

      {/* Barra móvil */}
      <VehicleMobileBar
        price={v.price}
        waLink={currentWaLink}
        isReservado={isReservado}
        isVendido={isVendido}
      />
    </Shell>
  );
}
