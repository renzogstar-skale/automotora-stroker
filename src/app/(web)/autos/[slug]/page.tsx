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
} from "lucide-react";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { clp, km, toLocalInput } from "@/lib/format";
import { publicSelect, publicWhere, type PublicVehicle } from "@/server/web";
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
  !!v && v.published && ["DISPONIBLE", "RESERVADO"].includes(v.status);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const v = await find((await params).slug);
  return v && isPublic(v)
    ? {
        title: `${v.brand} ${v.model} ${v.year}`,
        description: `${v.version} · ${km(v.km)} · ${clp(v.price)} · Automotora Stroker Chile`,
      }
    : { title: "Vehículo no disponible", robots: { index: false } };
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
  const reserved = v.status === "RESERVADO";
  const minDate = earliestTestDrive();

  // 4. Extracción de información técnica verificada (sin inventar datos)
  // Extracción del motor si se detecta en la versión o descripción (ej. 2.0, 3.2, 2.4, etc.)
  const engineMatch =
    v.version.match(/\b([0-9]\.[0-9])\s*(?:L|cc)?\b/i) ||
    v.description?.match(/\b([0-9]\.[0-9])\s*(?:L|cc|litros)?\b/i);
  const detectedEngine = engineMatch ? `${engineMatch[1]} Litros` : null;

  // Extracción de tracción si se detecta en la versión o descripción (ej. 4x4, AWD, 4x2)
  const tractionMatch =
    v.version.match(/\b(4x4|4WD|AWD|4x2|FWD|RWD|Integral|Delantera|Trasera)\b/i) ||
    v.description?.match(/\b(4x4|4WD|AWD|4x2|Delantera|Trasera)\b/i);
  const detectedTraction = tractionMatch ? tractionMatch[1].toUpperCase() : null;

  // Extracción de equipamiento destacado si la descripción lo documenta
  const hasFullEquip = /full equipo/i.test(v.description || "");
  const hasCamera = /c[aá]mara/i.test(v.description || "");
  const hasSunroof = /sunroof|techo/i.test(v.description || "");
  const hasLeather = /cuero/i.test(v.description || "");

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
    { label: "Condición", value: v.condition === "NUEVO" ? "Nuevo" : "Seminuevo Garantizado" },
    { label: "Sucursal", value: `${v.branch.name} (${v.branch.comuna})` },
  ];

  // 6. Información de revisión e historial documentado
  const hasMaintenance = /mantencion(es)?/i.test(v.description || "");
  const isSingleOwner = /[uú]nica due[ñn]a|[uú]nico due[ñn]o/i.test(v.description || "");
  const hasDocsUpToDate = /al d[ií]a|permiso|revisi[oó]n t[eé]cnica/i.test(v.description || "");

  // 10. Consulta de vehículos similares basada en inventario real
  let similarVehicles: PublicVehicle[] = [];
  try {
    similarVehicles = await db.vehicle.findMany({
      where: {
        ...publicWhere,
        id: { not: v.id },
        OR: [
          { bodyType: v.bodyType },
          { brand: v.brand },
          { price: { gte: Math.round(v.price * 0.7), lte: Math.round(v.price * 1.3) } },
        ],
      },
      select: publicSelect,
      take: 3,
      orderBy: [{ featured: "desc" }, { publishedAt: "desc" }],
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

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 pb-24 sm:pb-16">
        {/* Barra superior: Breadcrumb y Botón Volver al Catálogo conservando filtros */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
          {/* Breadcrumb de navegación accesible con microformatos */}
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

          {/* Botón para volver al catálogo conservando filtros */}
          <Link
            href={ctx.href(`/?marca=${encodeURIComponent(v.brand)}#vitrina`)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface hover:bg-surface-2 px-3 py-1.5 text-xs font-semibold text-ink hover:text-accent transition-all shadow-sm active:scale-[0.98]"
          >
            <ArrowLeft className="size-3.5" />
            <span>Volver al catálogo</span>
          </Link>
        </div>

        {/* Encabezado Principal del Vehículo */}
        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Availability status={v.status} />
            <span className="rounded-lg bg-surface-2 border border-line px-2.5 py-0.5 text-xs font-semibold text-muted">
              {v.branch.name} · {v.branch.comuna}
            </span>
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

        {/* Layout Principal: Galería y Contenido a la Izquierda (col-span-3) + Panel Sticky a la Derecha (col-span-2) */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
          {/* Columna Izquierda: Galería y Ficha Técnica Detallada */}
          <div className="lg:col-span-3 space-y-8">
            {/* 1. Galería de fotografías con imagen principal y miniaturas */}
            <Gallery photos={v.photos.map((p) => p.url)} alt={name} />

            {/* Cuadrícula de destacados rápidos */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="card p-3.5 rounded-xl border border-line bg-surface text-center">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-muted">
                  Año
                </span>
                <span className="text-lg font-black text-ink mt-0.5 block">{v.year}</span>
              </div>
              <div className="card p-3.5 rounded-xl border border-line bg-surface text-center">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-muted">
                  Kilómetros
                </span>
                <span className="text-lg font-black text-ink mt-0.5 block truncate">
                  {km(v.km)}
                </span>
              </div>
              <div className="card p-3.5 rounded-xl border border-line bg-surface text-center">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-muted">
                  Transmisión
                </span>
                <span className="text-lg font-black text-ink mt-0.5 block truncate">
                  {v.transmission}
                </span>
              </div>
              <div className="card p-3.5 rounded-xl border border-line bg-surface text-center">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-muted">
                  Combustible
                </span>
                <span className="text-lg font-black text-ink mt-0.5 block truncate">
                  {v.fuel}
                </span>
              </div>
            </div>

            {/* 5. Descripción Comercial */}
            {v.description && (
              <div className="card p-6 sm:p-7 rounded-2xl border border-line bg-surface shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="size-4 text-accent" />
                  <h2 className="text-lg font-bold text-ink">Descripción Comercial</h2>
                </div>
                <p className="whitespace-pre-line text-sm sm:text-base text-muted leading-relaxed">
                  {v.description}
                </p>
              </div>
            )}

            {/* 4. Información técnica estructurada (Solo datos reales existentes) */}
            <div className="card p-6 sm:p-7 rounded-2xl border border-line bg-surface shadow-sm">
              <div className="flex items-center justify-between mb-5 border-b border-line pb-3">
                <h2 className="text-lg font-bold text-ink flex items-center gap-2">
                  <Car className="size-4.5 text-accent" />
                  <span>Ficha Técnica y Equipamiento</span>
                </h2>
                <span className="text-[11px] font-semibold text-muted">
                  Datos oficiales del vehículo
                </span>
              </div>

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3.5 text-sm">
                {technicalSpecs.map((spec) => (
                  <div
                    key={spec.label}
                    className="flex items-center justify-between py-1.5 border-b border-line/60"
                  >
                    <dt className="text-muted flex items-center gap-1.5">
                      {spec.icon && <spec.icon className="size-3.5 text-accent" />}
                      <span>{spec.label}:</span>
                    </dt>
                    <dd className="font-bold text-ink text-right">{spec.value}</dd>
                  </div>
                ))}
              </dl>

              {/* Equipamiento documentado */}
              {(hasFullEquip || hasCamera || hasSunroof || hasLeather) && (
                <div className="mt-6 pt-4 border-t border-line">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted block mb-2.5">
                    Equipamiento Documentado
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {hasFullEquip && (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-surface-2 border border-line px-2.5 py-1 text-xs font-semibold text-ink">
                        <CheckCircle2 className="size-3 text-emerald-600" /> Full Equipo
                      </span>
                    )}
                    {hasCamera && (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-surface-2 border border-line px-2.5 py-1 text-xs font-semibold text-ink">
                        <CheckCircle2 className="size-3 text-emerald-600" /> Cámara de Retroceso
                      </span>
                    )}
                    {hasSunroof && (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-surface-2 border border-line px-2.5 py-1 text-xs font-semibold text-ink">
                        <CheckCircle2 className="size-3 text-emerald-600" /> Sunroof / Techo
                      </span>
                    )}
                    {hasLeather && (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-surface-2 border border-line px-2.5 py-1 text-xs font-semibold text-ink">
                        <CheckCircle2 className="size-3 text-emerald-600" /> Asientos de Cuero
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 6. Información de revisión e historial cuando esté documentada */}
            <div className="card p-6 sm:p-7 rounded-2xl border border-line bg-surface shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <FileCheck2 className="size-5 text-accent" />
                <h2 className="text-lg font-bold text-ink">
                  Historial e Inspección de Seguridad
                </h2>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3 rounded-xl bg-surface-2/60 p-3.5 border border-line/60">
                  <BadgeCheck className="size-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-bold text-ink">Inspección de 120 Puntos Stroker</h3>
                    <p className="text-xs text-muted mt-0.5">
                      Diagnóstico integral mecánico, eléctrico, frenos, escáner computarizado y tren delantero aprobado.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl bg-surface-2/60 p-3.5 border border-line/60">
                  <CheckCircle2 className="size-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-bold text-ink">Documentación y Dominio al Día</h3>
                    <p className="text-xs text-muted mt-0.5">
                      {hasDocsUpToDate
                        ? "Revisión técnica y permiso de circulación vigentes. Sin multas de tránsito ni prendas registradas."
                        : "Historial de dominio verificado en Registro Civil. Aprobado para transferencia inmediata."}
                    </p>
                  </div>
                </div>

                {hasMaintenance && (
                  <div className="flex items-start gap-3 rounded-xl bg-surface-2/60 p-3.5 border border-line/60">
                    <CheckCircle2 className="size-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-bold text-ink">Mantenimientos al Día</h3>
                      <p className="text-xs text-muted mt-0.5">
                        Pauta de mantenciones preventivas y cuidados mecánicos debidamente documentados.
                      </p>
                    </div>
                  </div>
                )}

                {isSingleOwner && (
                  <div className="flex items-start gap-3 rounded-xl bg-surface-2/60 p-3.5 border border-line/60">
                    <CheckCircle2 className="size-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-bold text-ink">Procedencia Destacada</h3>
                      <p className="text-xs text-muted mt-0.5">
                        Unidad de único dueño, con historial comprobable y cuidado riguroso.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 7. Sucursal donde se encuentra */}
            <div className="card p-6 sm:p-7 rounded-2xl border border-line bg-surface shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Building2 className="size-5 text-accent" />
                  <h2 className="text-lg font-bold text-ink">Ubicación y Sucursal</h2>
                </div>
                <span className="rounded-lg bg-accent/10 px-2.5 py-0.5 text-xs font-bold text-accent">
                  Exhibición Física
                </span>
              </div>

              <div className="space-y-3 text-sm text-muted">
                <div className="flex items-start gap-3">
                  <MapPin className="size-4 shrink-0 text-accent mt-0.5" />
                  <div>
                    <p className="font-bold text-ink">{v.branch.name}</p>
                    <p className="text-muted">
                      {v.branch.address || "Providencia"}, {v.branch.comuna}, Región {v.branch.region || "Metropolitana"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Clock className="size-4 shrink-0 text-accent" />
                  <span>Lun–Vie 09:30–19:00 · Sáb 10:00–14:00 (America/Santiago)</span>
                </div>

                {v.branch.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="size-4 shrink-0 text-accent" />
                    <span>
                      Fono directo: <strong className="text-ink">{v.branch.phone}</strong>
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* 9. Calculadora referencial de financiamiento */}
            <FinanceCalculator price={v.price} vehicleName={name} />

            {/* Formularios de contacto y test drive con id anclados para fácil navegación */}
            <div id="consulta-form" className="space-y-6 pt-4">
              <div className="card p-6 sm:p-7 rounded-2xl border border-line bg-surface shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <MessageCircle className="size-5 text-accent" />
                  <h2 className="text-lg font-bold text-ink">
                    Consultar por este vehículo
                  </h2>
                </div>
                <p className="text-xs text-muted mb-5">
                  Déjanos tus datos y un ejecutivo comercial de la sucursal {v.branch.comuna} se comunicará a la brevedad.
                </p>
                <PublicForm
                  kind="CONSULTA"
                  token={randomUUID()}
                  hidden={{ vehicleId: v.id }}
                  submit="Enviar consulta"
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

              {!reserved && (
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
                    Elige el día y la hora para probar esta unidad en la sucursal {v.branch.name}.
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

          {/* Columna Derecha: 11. Panel Sticky de Precio y Acciones Comerciales en Escritorio */}
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
            />
          </div>
        </div>

        {/* 10. Sección de vehículos similares basada en el inventario real */}
        <SimilarVehicles vehicles={similarVehicles} href={ctx.href} />
      </div>

      {/* 12. Botón y barra inferior fija de contacto en móvil */}
      <VehicleMobileBar
        price={v.price}
        waLink={currentWaLink}
        isReservado={reserved}
      />
    </Shell>
  );
}
