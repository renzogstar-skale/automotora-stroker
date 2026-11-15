import Link from "next/link";
import { headers } from "next/headers";
import { MapPin, MessageCircle, Phone } from "lucide-react";
import { getActor } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { clp, km } from "@/lib/format";
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
            {cfg.logoImage
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={cfg.logoImage} alt={cfg.logoText} className="h-9 w-auto" />
              : <span className="grid size-9 place-items-center rounded-lg bg-accent font-bold text-white">{cfg.logoText.charAt(0)}</span>}
            <span className="text-lg font-bold tracking-tight">{cfg.logoText}</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm font-medium sm:gap-4">
            <Link href={href("/autos")} className="rounded-lg px-2 py-1.5 hover:bg-surface-2">Autos</Link>
            <Link href={href("/consignar")} className="rounded-lg px-2 py-1.5 hover:bg-surface-2">Consignar</Link>
            {cfg.showBranches && <Link href={href("/#sucursales")} className="hidden rounded-lg px-2 py-1.5 hover:bg-surface-2 sm:inline">Sucursales</Link>}
            <a href={waLink()} className="btn btn-primary hidden sm:inline-flex"><MessageCircle className="size-4" />WhatsApp</a>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="bg-graphite text-white/80">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 text-sm sm:grid-cols-3 sm:px-6">
          <div>
            <p className="text-base font-semibold text-white">{cfg.logoText}</p>
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
              <a href={`tel:${(cfg.phone || "+56971325262").replace(/\s/g, "")}`} className="rounded bg-white/10 px-2 py-1 font-semibold hover:bg-white/20">
                Llamar
              </a>
              <a href={`https://wa.me/${(cfg.whatsapp || "56971325262").replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="rounded bg-emerald-600/30 px-2 py-1 font-semibold text-emerald-300 hover:bg-emerald-600/40">
                WhatsApp
              </a>
              <a href={cfg.locationUrl || "https://www.google.com/search?kgmid=%2Fg%2F11zd3t8786"} target="_blank" rel="noopener noreferrer" className="rounded bg-white/10 px-2 py-1 font-semibold hover:bg-white/20">
                Ver ubicación
              </a>
            </div>
          </div>
          {cfg.showBranches && (
            <div className="space-y-1.5">
              <p className="font-semibold text-white">Showroom & Despachos</p>
              {site.branches.filter((b) => b.visible).map((b) => (
                <div key={b.id} className="text-xs space-y-0.5">
                  <p className="flex items-start gap-2 font-medium text-white/90">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-accent" />
                    <span>{b.name} · {b.address}, {b.comuna}</span>
                  </p>
                  <p className="pl-6 text-white/60">Fono: {b.phone}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="border-t border-white/10 px-4 py-3 text-center text-xs text-white/50">© {new Date().getFullYear()} {cfg.logoText} · Antofagasta, Chile · <Link href="/login" className="hover:text-white">Acceso equipo</Link></div>
      </footer>
    </div>
  );
}

export const cover = (v: Pick<PublicVehicle, "photos">) => (v.photos.find((p) => p.isCover) ?? v.photos[0])?.url ?? "/demo/placeholder.svg";

export function Availability({ status }: { status: string }) {
  return status === "RESERVADO"
    ? <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">Reservado</span>
    : <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-900">Disponible</span>;
}

export function VehicleCard({ v, href }: { v: PublicVehicle; href: (p: string) => string }) {
  return (
    <Link href={href(`/autos/${v.slug}`)} className="card group overflow-hidden transition-shadow hover:shadow-md">
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cover(v)} alt={`${v.brand} ${v.model} ${v.year}`} className="aspect-[4/3] w-full object-cover" loading="lazy" />
        <div className="absolute left-2 top-2"><Availability status={v.status} /></div>
      </div>
      <div className="space-y-1 p-3.5">
        <p className="font-semibold group-hover:text-accent">{v.brand} {v.model} <span className="font-normal text-muted">{v.year}</span></p>
        <p className="text-xs text-muted">{v.version} · {km(v.km)} · {v.transmission} · {v.fuel}</p>
        <div className="flex items-center justify-between pt-1"><span className="text-lg font-bold tabular-nums">{clp(v.price)}</span><span className="text-xs text-muted">{v.branch.name.replace("Stroker ", "")}</span></div>
      </div>
    </Link>
  );
}
