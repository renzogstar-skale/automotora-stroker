import Link from "next/link";
import { MapPin, Phone, MessageCircle, Navigation } from "lucide-react";
import { db } from "@/lib/db";
import { BUSINESS, DEMO_INVENTORY, waUrl } from "@/lib/business";
import { DemoNavbar } from "@/components/hero/demo-navbar";
import { HeroAndCatalog } from "@/components/hero/hero-and-catalog";
import type { DemoVehicle, DemoBranch } from "@/types/hero-demo";
import { seedOfficialStrokerInventory } from "@/server/seed-stroker";
import { loadSite, trackView } from "./(web)/site";

export const dynamic = "force-dynamic";

/** Portada: usa la configuración publicada de Mi Web (o el borrador con ?preview=1 y permiso) y cuenta la visita. */
export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { site, preview, actor } = await loadSite(await searchParams);
  const { cfg } = site;
  if (!preview) await trackView("VIEW", "/");

  let vehicles: DemoVehicle[] = [];
  let branches: DemoBranch[] = [];

  try {
    const officialCount = await db.vehicle.count({ where: { source: "INSTAGRAM_OFFICIAL" } });
    if (officialCount < 15) {
      try {
        await seedOfficialStrokerInventory();
      } catch (e) {
        console.error("Auto-sync error:", e);
      }
    }

    // Consulta priorizando el inventario oficial de Automotora Stroker verificado desde Instagram
    const [vehiclesData, branchesData] = await Promise.all([
      db.vehicle.findMany({
        where: {
          published: true,
          status: { in: ["DISPONIBLE", "RESERVADO", "VENDIDO", "EN_CONSIGNACION"] },
          verificationStatus: { not: "POR_CONFIRMAR" },
          // Si existe inventario oficial de Instagram, mostrar preferentemente unidades oficiales
          source: "INSTAGRAM_OFFICIAL",
        },
        orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
        include: {
          branch: {
            select: {
              id: true,
              name: true,
              comuna: true,
              code: true,
              address: true,
              phone: true,
              whatsapp: true,
              region: true,
            },
          },
          photos: { select: { url: true }, orderBy: { order: "asc" } },
        },
      }),
      db.branch.findMany({ orderBy: { code: "asc" } }),
    ]);

    // Si la búsqueda oficial no arrojara resultados, respaldo general
    if (vehiclesData.length === 0) {
      const fallback = await db.vehicle.findMany({
        where: { published: true, status: { in: ["DISPONIBLE", "RESERVADO", "VENDIDO"] } },
        orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
        include: {
          branch: { select: { id: true, name: true, comuna: true, code: true, address: true, phone: true, whatsapp: true, region: true } },
          photos: { select: { url: true }, orderBy: { order: "asc" } },
        },
        take: 30,
      });
      vehicles = fallback as unknown as DemoVehicle[];
    } else {
      vehicles = vehiclesData as unknown as DemoVehicle[];
    }
    branches = branchesData as unknown as DemoBranch[];
  } catch (err) {
    console.error("Error al cargar vitrina:", err);
  }

  return (
    <div className="min-h-dvh flex flex-col bg-bg text-ink selection:bg-accent selection:text-white" style={{ "--accent": cfg.accent, "--graphite": cfg.secondary } as React.CSSProperties}>
      {preview && <div className="bg-amber-400 px-4 py-1.5 text-center text-xs font-medium text-black">Vista previa {site.isDraft ? "del borrador" : "(sin cambios en borrador)"} · no se cuentan visitas</div>}
      {/* 5. NAVBAR PREMIUM con glassmorphism, responsive y acceso demo */}
      <DemoNavbar actor={actor ? { name: actor.name, email: actor.email } : null} />

      <main className="flex-1">
        {/* HERO SECTION PREMIUM + BUSCADOR + VITRINA + SUCURSALES + MODAL */}
        <HeroAndCatalog initialVehicles={vehicles} branches={branches} heroTitle={cfg.heroTitle} heroSubtitle={cfg.heroSubtitle} />

      </main>

      {/* Footer */}
      <footer className="border-t border-line bg-surface py-12 text-xs text-muted">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            {/* Columna Marca */}
            <div className="md:col-span-5 space-y-3">
              <div className="flex items-center gap-3">
                <span className="grid size-8 place-items-center rounded-xl bg-accent text-xs font-bold text-white shadow-sm">
                  S
                </span>
                <div>
                  <span className="font-extrabold text-sm text-ink block">Automotora Stroker SpA</span>
                  <span className="text-muted/70 text-[11px]">Special Cars for Special People</span>
                </div>
              </div>
              <p className="text-xs text-muted/90 max-w-sm leading-relaxed">
                Compra, venta y consignación de autos, camionetas y motocicletas en Antofagasta. Coordinamos despachos a cualquier región de Chile.
              </p>
            </div>

            {/* Columna Contacto Oficial y Enlaces */}
            <div className="md:col-span-4 space-y-2.5">
              <span className="font-bold text-xs uppercase tracking-wider text-ink block">Contacto y Showroom</span>
              <p className="flex items-start gap-2 text-ink">
                <MapPin className="size-4 text-accent shrink-0 mt-0.5" />
                <span>{cfg.address || BUSINESS.address}</span>
              </p>
              <p className="flex items-center gap-2 text-ink">
                <Phone className="size-4 text-accent shrink-0" />
                <a href={BUSINESS.tel} className="font-bold hover:text-accent transition-colors">
                  {cfg.phone || BUSINESS.phone}
                </a>
              </p>
              <p className="text-muted">{BUSINESS.hours}</p>
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <a
                  href={BUSINESS.tel}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3.5 font-bold text-ink hover:text-accent transition-colors"
                >
                  <Phone className="size-3.5" />
                  <span>Llamar</span>
                </a>
                <a
                  href={waUrl("Hola, quiero más información.")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-emerald-600/15 border border-emerald-500/30 px-3.5 font-bold text-emerald-700 hover:text-emerald-600 transition-colors"
                >
                  <MessageCircle className="size-3.5" />
                  <span>WhatsApp</span>
                </a>
                <a
                  href={BUSINESS.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3.5 font-semibold text-ink hover:text-accent transition-colors"
                >
                  <Navigation className="size-3.5 text-accent" />
                  <span>Ver ubicación</span>
                </a>
              </div>
            </div>

            {/* Columna Navegación */}
            <div className="md:col-span-3 space-y-2">
              <span className="font-bold text-xs uppercase tracking-wider text-ink block">Navegación</span>
              <ul className="space-y-1.5 font-medium">
                <li>
                  <a href="#vitrina" className="hover:text-accent transition-colors">
                    Catálogo de Vehículos
                  </a>
                </li>
                <li>
                  <a href="#nosotros" className="hover:text-accent transition-colors">
                    Sobre nosotros
                  </a>
                </li>
                <li>
                  <a href="#servicios" className="hover:text-accent transition-colors">
                    Servicios
                  </a>
                </li>
                <li>
                  <a href="#contacto" className="hover:text-accent transition-colors">
                    Contacto y Ubicación
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {DEMO_INVENTORY && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-800 dark:text-amber-300">
              Inventario de demostración: las unidades, precios y fotos publicados son referenciales y no constituyen oferta. Confirma disponibilidad por WhatsApp o teléfono.
            </p>
          )}
          <div className="border-t border-line pt-6 flex flex-wrap items-center justify-between gap-4 text-[11px] text-muted">
            <p>© {new Date().getFullYear()} Automotora Stroker · Antofagasta, Chile · Despachos a todo Chile.</p>
            <Link href="/login" className="hover:text-ink">Acceso equipo</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
