import Link from "next/link";
import { headers } from "next/headers";
import { MapPin, MessageCircle, Phone } from "lucide-react";
import { getActor } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { clp, km } from "@/lib/format";
import { BUSINESS, DEMO_INVENTORY } from "@/lib/business";
import { getSite, track, type PublicVehicle, type Site } from "@/server/web";

type SP = Record<string, string | string[] | undefined>;
export const one = (s: SP, k: string) => { const v = s[k]; return (Array.isArray(v) ? v[0] : v) || undefined; };

/** Carga la configuración publicada; con `?preview=1` y permiso de Mi Web muestra el borrador (sin contar visitas). */
export async function loadSite(s: SP) {
  const actor = await getActor();
  const preview = one(s, "preview") === "1" && !!actor && can(actor, "web.admin");
  const site = await getSite(preview);
  const href = (path: string) => (preview ? `${path}${path.includes("?") ? "&" : "?"}preview=1` : path);
  return { site, preview, href, actor };
}

export async function trackView(type: "VIEW" | "VEHICLE_VIEW", path: string, vehicleId?: string) {
  const h = await headers();
  if (/bot|crawl|spider/i.test(h.get("user-agent") ?? "")) return;
  const visitor = `${h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "local"}|${h.get("user-agent") ?? ""}`;
  await track(type, path, visitor, vehicleId);
}

export const waLink = (vehicleId?: string, branchId?: string) => `/api/web/wa?${new URLSearchParams({ ...(vehicleId ? { v: vehicleId } : {}), ...(branchId ? { b: branchId } : {}) })}`;

export function Shell({ site, preview, href, children }: { site: Site; preview: boolean; href: (p: string) => string; children: React.ReactNode }) {
  const { cfg } = site;
  return (
    <div className="flex min-h-dvh flex-col bg-bg text-ink" style={{ "--accent": cfg.accent, "--graphite": cfg.secondary } as React.CSSProperties}>
      {preview && <div className="bg-amber-400 px-4 py-1.5 text-center text-xs font-medium text-black">Vista previa {site.isDraft ? "del borrador" : "(sin cambios en borrador)"} · no se cuentan visitas</div>}
      <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href={href("/")} className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cfg.logoImage || "/brand/stroker-emblem.jpg"}
              alt={cfg.logoText}
              className="h-10 w-auto object-contain rounded-lg"
            />
            <span className="text-lg font-bold tracking-tight">{cfg.logoText}</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm font-medium sm:gap-4">
            <Link href={href("/autos")} className="rounded-lg px-2 py-1.5 hover:bg-surface-2">Autos</Link>
            <Link href={href("/consignar")} className="rounded-lg px-2 py-1.5 hover:bg-surface-2">Consignar</Link>
            <Link href={href("/#contacto")} className="hidden rounded-lg px-2 py-1.5 hover:bg-surface-2 sm:inline">Contacto</Link>
            <a href={waLink()} className="btn btn-primary hidden sm:inline-flex"><MessageCircle className="size-4" />WhatsApp</a>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="bg-graphite text-white/80">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 text-sm sm:grid-cols-3 sm:px-6">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cfg.logoImage || "/brand/stroker-emblem.jpg"}
                alt={cfg.logoText}
                className="h-8 w-auto object-contain rounded-lg bg-black/40 p-0.5 border border-white/10"
              />
              <p className="text-base font-semibold text-white">{cfg.logoText}</p>
            </div>
            <p className="mt-2 text-white/70">{cfg.aboutText}</p>
            <p className="mt-2 text-xs text-white/50">{cfg.address || "Av. Jaime Guzmán 4050, Club Pádel Llacolén, Antofagasta, Chile"}</p>
          </div>
          <div className="space-y-1.5">
            <p className="font-semibold text-white">Contacto</p>
            <p className="flex items-center gap-2">
              <Phone className="size-4" />
              <a href={`tel:${(cfg.phone || "+56971325262").replace(/\s/g, "")}`} className="hover:text-white">
                {cfg.phone || "+56 9 7132 5262"}
              </a>
            </p>
            {cfg.email && <p><a href={`mailto:${cfg.email}`} className="hover:text-white">{cfg.email}</a></p>}
            <p className="flex items-center gap-2">
              <MessageCircle className="size-4" />
              <a href={`https://wa.me/${(cfg.whatsapp || "56971325262").replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="hover:text-white">
                {cfg.whatsapp || "+56 9 7132 5262"}
              </a>
            </p>
            <div className="pt-2 flex flex-wrap gap-2 text-xs">
              <a href={`tel:${(cfg.phone || "+56971325262").replace(/\s/g, "")}`} className="inline-flex min-h-11 items-center rounded-lg bg-white/10 px-3.5 font-semibold hover:bg-white/20">
                Llamar
              </a>
              <a href={`https://wa.me/${(cfg.whatsapp || "56971325262").replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-lg bg-emerald-600/30 px-3.5 font-semibold text-emerald-300 hover:bg-emerald-600/40">
                WhatsApp
              </a>
              <a href={cfg.locationUrl || BUSINESS.mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-lg bg-white/10 px-3.5 font-semibold hover:bg-white/20">
                Ver ubicación
              </a>
            </div>
          </div>
          {/* Única sede confirmada; las sucursales de la base de datos son de gestión interna */}
          <div className="space-y-1.5 text-xs">
            <p className="text-sm font-semibold text-white">Showroom & Despachos</p>
            <p className="flex items-start gap-2 font-medium text-white/90">
              <MapPin className="mt-0.5 size-4 shrink-0 text-accent" />
              <span>{BUSINESS.showroom} · {BUSINESS.address}</span>
            </p>
            <p className="pl-6 text-white/60">{BUSINESS.hours}</p>
            <p className="pl-6 text-white/60">Despachos coordinados a todo Chile</p>
          </div>
        </div>
        {DEMO_INVENTORY && <p className="mx-auto max-w-7xl px-4 pb-3 text-center text-[11px] text-amber-300/80 sm:px-6">Inventario de demostración: unidades, precios y fotos referenciales; no constituyen oferta.</p>}
        <div className="border-t border-white/10 px-4 py-3 text-center text-xs text-white/50">© {new Date().getFullYear()} {cfg.logoText} · Antofagasta, Chile · <Link href="/login" className="hover:text-white">Acceso equipo</Link></div>
      </footer>
    </div>
  );
}

export const cover = (v: Pick<PublicVehicle, "photos">) => (v.photos.find((p) => p.isCover) ?? v.photos[0])?.url ?? "/demo/placeholder.svg";

export function Availability({ status }: { status: string }) {
  if (status === "VENDIDO") {
    return <span className="rounded-md bg-red-600/95 text-white px-2.5 py-0.5 text-xs font-bold inline-flex items-center gap-1 shadow-sm">🔴 Vendido</span>;
  }
  if (status === "RESERVADO") {
    return <span className="rounded-md bg-amber-500/95 text-white px-2.5 py-0.5 text-xs font-bold inline-flex items-center gap-1 shadow-sm">🟠 Reservado</span>;
  }
  if (status === "EN_CONSIGNACION") {
    return <span className="rounded-md bg-purple-600/95 text-white px-2.5 py-0.5 text-xs font-bold inline-flex items-center gap-1 shadow-sm">🟣 En consignación</span>;
  }
  if (status === "POR_CONFIRMAR") {
    return <span className="rounded-md bg-zinc-600/95 text-white px-2.5 py-0.5 text-xs font-bold inline-flex items-center gap-1 shadow-sm">⚪ Por confirmar</span>;
  }
  return <span className="rounded-md bg-emerald-600/95 text-white px-2.5 py-0.5 text-xs font-bold inline-flex items-center gap-1 shadow-sm">🟢 Disponible</span>;
}

export function VehicleCard({ v, href }: { v: PublicVehicle; href: (p: string) => string }) {
  const isVendido = v.status === "VENDIDO";
  const photo1 = v.photos[0]?.url || "/demo/placeholder.svg";
  const photo2 = v.photos[1]?.url;
  return (
    <Link href={href(`/autos/${v.slug}`)} className={`card group overflow-hidden transition-all duration-200 hover:shadow-lg ${isVendido ? "opacity-90 grayscale-[25%]" : ""}`}>
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo1}
          alt={`${v.brand} ${v.model} ${v.year}`}
          className={`absolute inset-0 size-full object-cover transition-all duration-300 ${photo2 ? "group-hover:opacity-0" : "group-hover:scale-105"}`}
          loading="lazy"
        />
        {photo2 && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo2}
            alt={`${v.brand} ${v.model} ${v.year} - foto 2`}
            className="absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-hover:scale-105"
            loading="lazy"
          />
        )}
        <div className="absolute left-2.5 top-2.5 z-10"><Availability status={v.status} /></div>
        {photo2 && (
          <div className="absolute right-2.5 bottom-2.5 z-10 pointer-events-none">
            <span className="rounded-md bg-black/60 backdrop-blur-sm text-white/90 px-2 py-0.5 text-[11px] font-medium tracking-tight shadow">
              2 fotos
            </span>
          </div>
        )}
        {isVendido && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
            <span className="bg-red-600/90 text-white text-xs font-black px-3 py-1 rounded-md tracking-wider uppercase shadow-md">
              🔴 Unidad Vendida
            </span>
          </div>
        )}
      </div>
      <div className="space-y-1 p-3.5">
        <p className="font-bold group-hover:text-accent truncate">{v.brand} {v.model} <span className="font-normal text-muted">{v.year}</span></p>
        <p className="text-xs text-muted truncate">{v.version} · {km(v.km)} · {v.transmission} · {v.fuel}</p>
        <div className="flex items-center justify-between pt-1">
          <span className="text-lg font-bold tabular-nums text-accent">{clp(v.price)}</span>
          <span className="text-xs text-muted">{BUSINESS.city}</span>
        </div>
      </div>
    </Link>
  );
}
