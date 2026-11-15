import Link from "next/link";
import {
  MapPin,
  Phone,
  Shield,
  ArrowRight,
  Building2,
  Calendar,
  MessageCircle,
  Navigation,
} from "lucide-react";
import { db } from "@/lib/db";
import { DemoNavbar } from "@/components/hero/demo-navbar";
import { HeroAndCatalog } from "@/components/hero/hero-and-catalog";
import type { DemoVehicle, DemoBranch } from "@/types/hero-demo";
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
    const [vehiclesData, branchesData] = await Promise.all([
      db.vehicle.findMany({
        where: { published: true, status: { in: ["DISPONIBLE", "RESERVADO"] } },
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
          photos: { select: { url: true }, take: 1, orderBy: { order: "asc" } },
        },
      }),
      db.branch.findMany({ orderBy: { code: "asc" } }),
    ]);

    vehicles = vehiclesData as unknown as DemoVehicle[];
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

        {/* Sección de Acceso Demo para evaluadores */}
        <section id="demo" className="py-16 border-t border-line bg-graphite text-white">
          <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-10 backdrop-blur-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-lg bg-accent/20 px-3 py-1 text-xs font-bold text-red-300 mb-2">
                    <Shield className="size-3.5" /> Entorno Demo Stroker 2026
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                    Acceso al Panel Privado de Demostración
                  </h3>
                  <p className="mt-2 max-w-2xl text-sm text-white/80 leading-relaxed">
                    Dos sucursales activas, roles diferenciados (Dueño, Gerencia, Ventas, Finanzas, Fotógrafo) y navegación completa adaptada para escritorio, tablet y móvil.
                  </p>
                </div>

                <Link
                  href="/login"
                  className="btn btn-primary h-11 px-6 text-sm font-bold shadow-md"
                >
                  Ingresar al Panel Stroker <ArrowRight className="size-4" />
                </Link>
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 border-t border-white/10 pt-8 text-xs">
                <div className="rounded-xl bg-black/40 p-4 border border-white/5">
                  <span className="font-bold text-white block">Dueña / Administradora</span>
                  <span className="text-white/60">Camila Rojas</span>
                  <p className="mt-1 font-mono text-[11px] text-accent font-semibold">
                    dueno@stroker.demo
                  </p>
                </div>
                <div className="rounded-xl bg-black/40 p-4 border border-white/5">
                  <span className="font-bold text-white block">Gerencia Santiago</span>
                  <span className="text-white/60">Andrés Fuentes</span>
                  <p className="mt-1 font-mono text-[11px] text-accent font-semibold">
                    gerencia@stroker.demo
                  </p>
                </div>
                <div className="rounded-xl bg-black/40 p-4 border border-white/5">
                  <span className="font-bold text-white block">Ventas Santiago</span>
                  <span className="text-white/60">Valentina Soto</span>
                  <p className="mt-1 font-mono text-[11px] text-accent font-semibold">
                    valentina@stroker.demo
                  </p>
                </div>
                <div className="rounded-xl bg-black/40 p-4 border border-white/5">
                  <span className="font-bold text-white block">Finanzas y Cobranza</span>
                  <span className="text-white/60">Rodrigo Díaz</span>
                  <p className="mt-1 font-mono text-[11px] text-accent font-semibold">
                    finanzas@stroker.demo
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-2 text-xs text-white/70">
                <p>
                  Contraseña única para todas las cuentas:{" "}
                  <code className="font-mono font-bold text-white bg-black/60 px-2 py-0.5 rounded">
                    Stroker2026!
                  </code>
                </p>
                <p className="text-[11px] text-white/50">
                  Zona Horaria: America/Santiago · Moneda: CLP sin decimales
                </p>
              </div>
            </div>
          </div>
        </section>
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
              <p className="text-[11px] text-muted/60">
                RUT: 77.123.456-7 · Antofagasta, Chile
              </p>
            </div>

            {/* Columna Contacto Oficial y Enlaces */}
            <div className="md:col-span-4 space-y-2.5">
              <span className="font-bold text-xs uppercase tracking-wider text-ink block">Contacto y Showroom</span>
              <p className="flex items-start gap-2 text-ink">
                <MapPin className="size-4 text-accent shrink-0 mt-0.5" />
                <span>{cfg.address || "Av. Jaime Guzmán 4050, Club Pádel Llacolén, Antofagasta, Chile."}</span>
              </p>
              <p className="flex items-center gap-2 text-ink">
                <Phone className="size-4 text-accent shrink-0" />
                <a href="tel:+56971325262" className="font-bold hover:text-accent transition-colors">
                  {cfg.phone || "+56 9 7132 5262"}
                </a>
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <a
                  href="tel:+56971325262"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 py-1.5 font-bold text-ink hover:text-accent transition-colors"
                >
                  <Phone className="size-3.5" />
                  <span>Llamar</span>
                </a>
                <a
                  href="https://wa.me/56971325262"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600/15 border border-emerald-500/30 px-3 py-1.5 font-bold text-emerald-600 hover:text-emerald-500 transition-colors"
                >
                  <MessageCircle className="size-3.5" />
                  <span>WhatsApp</span>
                </a>
                <a
                  href="https://www.google.com/search?kgmid=%2Fg%2F11zd3t8786"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 py-1.5 font-semibold text-ink hover:text-accent transition-colors"
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
                <li className="pt-1">
                  <Link href="/login" className="text-accent hover:underline font-bold inline-flex items-center gap-1">
                    <span>Panel Privado</span>
                    <ArrowRight className="size-3" />
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-line pt-6 flex flex-wrap items-center justify-between gap-4 text-[11px] text-muted">
            <p>© 2026 Automotora Stroker. Antofagasta, Chile · Despachos a todo Chile. Todos los derechos reservados.</p>
            <p>Horario: Lun–Vie 09:30–19:00 · Sáb 10:00–14:00 · Moneda: CLP</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
