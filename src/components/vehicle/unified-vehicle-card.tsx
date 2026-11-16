"use client";

import Link from "next/link";
import {
  MapPin,
  Heart,
  MessageCircle,
  Gauge,
  SlidersHorizontal,
  Fuel,
  Clock,
  ArrowRight,
  Calendar,
} from "lucide-react";
import { clp, km } from "@/lib/format";
import { BUSINESS } from "@/lib/business";
import type { DemoVehicle } from "@/types/hero-demo";
import { VehicleCardGallery } from "./vehicle-card-gallery";

interface UnifiedVehicleCardProps {
  vehicle: DemoVehicle;
  isFavorite: boolean;
  onToggleFavorite: (vehicleId: string) => void;
  onOpenAppointmentModal: (vehicleId: string, branchId: string) => void;
}

export function UnifiedVehicleCard({
  vehicle: v,
  isFavorite,
  onToggleFavorite,
  onOpenAppointmentModal,
}: UnifiedVehicleCardProps) {
  const isVendido = v.status === "VENDIDO";
  const isReservado = v.status === "RESERVADO";
  const isConsignacion = v.status === "EN_CONSIGNACION";
  const isPorConfirmar = v.status === "POR_CONFIRMAR";
  const isDisponible =
    v.status === "DISPONIBLE" ||
    (!isVendido && !isReservado && !isConsignacion && !isPorConfirmar);

  const detailUrl = `/autos/${v.slug}`;
  const waQuery = isVendido
    ? `https://wa.me/${BUSINESS.whatsapp}?text=${encodeURIComponent(
        `Hola Automotora Stroker, vi que vendieron el ${v.brand} ${v.model} ${v.year} (Código: ${v.stockCode || v.id}). ¿Tienen unidades similares disponibles o por ingresar?`
      )}`
    : `/api/web/wa?v=${v.id}`;

  const versionText = v.version ? `${v.version} · ${v.year}` : `Unidad Stroker · ${v.year}`;

  return (
    <article
      data-testid="vehicle-card"
      className={`group relative rounded-2xl border bg-surface shadow-sm hover:shadow-xl transition-all duration-200 ease-out hover:-translate-y-1 flex flex-col justify-between h-full overflow-hidden ${
        isVendido
          ? "border-line/70 opacity-90 hover:border-rose-500/40"
          : "border-line hover:border-accent/40"
      }`}
    >
      <div>
        {/* Cabecera visual: Galería deslizable */}
        <div className="relative">
          <VehicleCardGallery
            photos={v.photos}
            alt={`${v.brand} ${v.model} ${v.year}`}
            isVendido={isVendido}
          />

          {/* Overlay si la unidad fue vendida */}
          {isVendido && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex flex-col items-center justify-center p-3 text-center pointer-events-none z-20">
              <span className="rounded-xl bg-rose-600 px-4 py-1.5 text-xs sm:text-sm font-black uppercase tracking-wider text-white shadow-xl shadow-rose-950/80 border border-rose-400/40">
                🔴 VENDIDO
              </span>
              <span className="text-[11px] font-semibold text-zinc-300 mt-1.5">
                Unidad entregada a su nuevo dueño
              </span>
            </div>
          )}

          {/* Distintivos de Estado en la esquina superior izquierda */}
          <div className="absolute top-2.5 left-2.5 flex flex-wrap items-center gap-1.5 z-20 pointer-events-none">
            {isDisponible && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600/95 text-white backdrop-blur-md px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase shadow-md">
                <span className="size-1.5 rounded-full bg-white animate-pulse" />
                <span>🟢 Disponible</span>
              </span>
            )}
            {isReservado && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/95 text-white backdrop-blur-md px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase shadow-md">
                <Clock className="size-3" />
                <span>🟠 Reservado</span>
              </span>
            )}
            {isConsignacion && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600/95 text-white backdrop-blur-md px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase shadow-md">
                <span>🟣 Consignación</span>
              </span>
            )}
            {isPorConfirmar && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-600/95 text-white backdrop-blur-md px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase shadow-md">
                <span>⚪ Por confirmar</span>
              </span>
            )}
            {v.stockCode && (
              <span className="rounded-lg bg-black/70 text-zinc-300 backdrop-blur-md px-2 py-0.5 text-[10px] font-mono font-bold">
                {v.stockCode}
              </span>
            )}
          </div>

          {/* Botón de Favorito interactivo */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleFavorite(v.id);
            }}
            aria-label={isFavorite ? "Quitar de favoritos" : "Guardar en favoritos"}
            className={`absolute top-2.5 right-2.5 grid size-11 min-h-[44px] min-w-[44px] place-items-center rounded-full backdrop-blur-md transition-all duration-200 border cursor-pointer z-30 ${
              isFavorite
                ? "bg-red-600 border-red-500 text-white scale-105 shadow-lg shadow-red-950/40"
                : "bg-black/50 border-white/20 text-white/80 hover:bg-black/80 hover:text-white"
            }`}
          >
            <Heart className={`size-4 ${isFavorite ? "fill-white text-white" : ""}`} />
          </button>

          {/* Distintivo de Ubicación (esquina inferior derecha) */}
          <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-lg bg-black/75 backdrop-blur-md px-2 py-0.5 text-[11px] font-semibold text-white z-20 pointer-events-none">
            <MapPin className="size-3 text-red-500" />
            <span>{v.branch?.comuna || BUSINESS.city}</span>
          </div>

          {/* Distintivo de Año (esquina inferior izquierda) */}
          <div className="absolute bottom-2 left-2 rounded-md bg-zinc-950/90 text-white border border-white/10 backdrop-blur-md px-2 py-0.5 text-[11px] font-black shadow-sm z-20 pointer-events-none">
            {v.year}
          </div>
        </div>

        {/* Cuerpo de información del vehículo */}
        <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
          <div className="min-w-0 min-h-[46px]">
            <h3 className="font-extrabold text-lg text-ink group-hover:text-accent transition-colors leading-snug block truncate">
              <Link href={detailUrl} title={`${v.brand} ${v.model}`}>
                {v.brand} {v.model}
              </Link>
            </h3>
            <p className="text-xs text-muted font-medium mt-0.5 truncate">
              {versionText}
            </p>
          </div>

          {/* Precio y Pie */}
          <div className="mt-3.5 flex items-baseline justify-between gap-2 border-b border-line pb-3">
            <div>
              <span className="text-2xl font-black text-accent tabular-nums tracking-tight">
                {clp(v.price)}
              </span>
            </div>
            {v.minDownPayment ? (
              <span className="text-[11px] font-semibold text-muted">
                Pie desde {clp(v.minDownPayment)}
              </span>
            ) : (
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                Precio Lista
              </span>
            )}
          </div>

          {/* Ficha técnica resumida: Km, Transmisión, Combustible */}
          <div className="mt-3.5 grid grid-cols-3 gap-2 text-xs">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-1">
                <Gauge className="size-3 text-accent" /> Km
              </span>
              <span className="font-bold text-ink mt-0.5 truncate">{km(v.km)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-1">
                <SlidersHorizontal className="size-3 text-accent" /> Caja
              </span>
              <span className="font-bold text-ink mt-0.5 truncate">
                {v.transmission && v.transmission !== "No especificado"
                  ? v.transmission
                  : v.bodyType === "Moto" || v.bodyType === "Cuatrimoto"
                  ? "Manual"
                  : "Automática"}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-1">
                <Fuel className="size-3 text-accent" /> Motor
              </span>
              <span className="font-bold text-ink mt-0.5 truncate">
                {v.fuel && v.fuel !== "No especificado" ? v.fuel : "Bencina"}
              </span>
            </div>
          </div>

          {/* Ubicación y showroom */}
          <div className="mt-3.5 flex items-center justify-between text-xs text-muted pt-2.5 border-t border-line">
            <div className="flex items-center gap-1.5 truncate">
              <MapPin className="size-3.5 text-accent shrink-0" />
              <span className="font-medium text-ink truncate">
                {v.branch?.name || "Automotora Stroker Antofagasta"}
              </span>
            </div>
            {v.instagramUrl && (
              <span
                className="text-[10px] text-muted flex items-center gap-0.5 shrink-0"
                title="Publicación oficial en Instagram"
              >
                <span>Instagram oficial</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Pie de acciones del vehículo */}
      <div className="mt-auto border-t border-line px-4 sm:px-5 py-3.5 bg-surface-2/40 flex items-center justify-between gap-2">
        {/* Botón WhatsApp */}
        <a
          href={waQuery}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 min-h-[44px] text-xs font-bold shadow-sm transition-all duration-200 active:scale-[0.98] cursor-pointer ${
            isVendido
              ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-100"
              : "bg-emerald-600 hover:bg-emerald-500 text-white"
          }`}
          title={
            isVendido
              ? `Consultar vehículos similares a ${v.brand} ${v.model}`
              : `Consultar por WhatsApp sobre ${v.brand} ${v.model}`
          }
        >
          <MessageCircle className="size-4 shrink-0" />
          <span>{isVendido ? "Consultar similar" : "WhatsApp"}</span>
        </a>

        {/* Acciones secundarias: Agendar visita o Ver detalles */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {!isVendido && (
            <button
              type="button"
              onClick={() => onOpenAppointmentModal(v.id, v.branchId)}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-line bg-surface hover:bg-surface-2 px-3 min-h-[44px] text-xs font-semibold text-ink transition-colors cursor-pointer"
              title="Agendar visita"
              aria-label={`Agendar visita para ${v.brand} ${v.model}`}
            >
              <Calendar className="size-3.5 text-accent shrink-0" />
              <span className="hidden sm:inline">Agendar</span>
            </button>
          )}

          <Link
            href={detailUrl}
            className="inline-flex items-center justify-center gap-1 rounded-xl bg-graphite hover:bg-black text-white px-3.5 min-h-[44px] text-xs font-bold transition-all duration-200 active:scale-[0.98]"
          >
            <span>Ver detalles</span>
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </article>
  );
}
