import Link from "next/link";
import { ArrowRight, MapPin, Gauge, SlidersHorizontal, Fuel, MessageCircle } from "lucide-react";
import { clp, km } from "@/lib/format";
import type { PublicVehicle } from "@/server/web";

interface SimilarVehiclesProps {
  vehicles: PublicVehicle[];
  href: (p: string) => string;
}

export function SimilarVehicles({ vehicles, href }: SimilarVehiclesProps) {
  if (!vehicles || vehicles.length === 0) return null;

  return (
    <section className="mt-16 sm:mt-20 border-t border-line pt-12">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-accent">
            Inventario Real Relacionado
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink mt-1">
            Vehículos Similares en Stock
          </h2>
          <p className="text-sm text-muted mt-1">
            Otras unidades seleccionadas en nuestras sucursales de Santiago y Viña del Mar.
          </p>
        </div>

        <Link
          href={href("/autos")}
          className="btn btn-ghost text-xs sm:text-sm font-semibold hover:text-accent flex items-center gap-1.5"
        >
          <span>Ver todo el catálogo</span>
          <ArrowRight className="size-4" />
        </Link>
      </div>

      {/* Grid responsivo: 3 en escritorio, 2 en tablet, 1 en móvil */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {vehicles.map((v) => {
          const photo = v.photos?.[0]?.url || "/demo/placeholder.svg";
          const isReservado = v.status === "RESERVADO";

          return (
            <div
              key={v.id}
              className="card card-hover overflow-hidden rounded-2xl flex flex-col justify-between group transition-all duration-300"
            >
              <div>
                {/* Imagen */}
                <div className="relative aspect-[16/10] bg-surface-2 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo}
                    alt={`${v.brand} ${v.model} ${v.year}`}
                    loading="lazy"
                    className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                  />
                  <div className="absolute top-3 left-3 flex gap-2">
                    <span
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold tracking-wide uppercase shadow-sm ${
                        isReservado
                          ? "bg-amber-500 text-white"
                          : "bg-emerald-600 text-white"
                      }`}
                    >
                      {isReservado ? "Reservado" : "Disponible"}
                    </span>
                  </div>
                  <div className="absolute bottom-2.5 right-2.5 rounded-lg bg-black/75 backdrop-blur-md px-2 py-0.5 text-[11px] font-semibold text-white">
                    {v.branch?.comuna}
                  </div>
                  <div className="absolute bottom-2.5 left-2.5 rounded-md bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md px-2 py-0.5 text-[11px] font-black text-ink shadow-sm">
                    {v.year}
                  </div>
                </div>

                {/* Contenido */}
                <div className="p-5">
                  <h3 className="font-extrabold text-base sm:text-lg text-ink group-hover:text-accent transition-colors truncate">
                    {v.brand} {v.model}
                  </h3>
                  <p className="text-xs text-muted font-medium mt-0.5 truncate">
                    {v.version} · {v.year}
                  </p>

                  <div className="mt-3 flex items-baseline justify-between border-b border-line pb-3">
                    <span className="text-xl font-black text-accent tabular-nums">
                      {clp(v.price)}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                      CLP
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-1">
                        <Gauge className="size-3 text-accent" /> Km
                      </span>
                      <span className="font-bold text-ink truncate block mt-0.5">{km(v.km)}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-1">
                        <SlidersHorizontal className="size-3 text-accent" /> Caja
                      </span>
                      <span className="font-bold text-ink truncate block mt-0.5">{v.transmission}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-1">
                        <Fuel className="size-3 text-accent" /> Motor
                      </span>
                      <span className="font-bold text-ink truncate block mt-0.5">{v.fuel}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Acciones */}
              <div className="border-t border-line px-5 py-3 bg-surface-2/40 flex items-center justify-between gap-2 text-xs">
                <span className="text-muted font-medium flex items-center gap-1.5 truncate">
                  <MapPin className="size-3.5 text-accent shrink-0" /> {v.branch?.name}
                </span>

                <Link
                  href={href(`/autos/${v.slug}`)}
                  className="font-bold text-accent hover:underline inline-flex items-center gap-1 shrink-0"
                >
                  <span>Ver ficha</span>
                  <ArrowRight className="size-3" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
