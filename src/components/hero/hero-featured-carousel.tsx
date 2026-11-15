"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { clp } from "@/lib/format";
import { BUSINESS } from "@/lib/business";
import type { DemoVehicle } from "@/types/hero-demo";

interface HeroFeaturedCarouselProps {
  vehicles: DemoVehicle[];
  featuredVehicle?: DemoVehicle;
  onOpenAppointmentModal: (vehicleId?: string, branchId?: string) => void;
}

/**
 * Filtra y ordena los vehículos para el carrusel de la portada:
 * - Excluye vehículos vendidos y no verificados.
 * - Prioriza vehículos disponibles y destacados con fotografía.
 * - Asegura diversidad alternando marcas consecutivas.
 */
function selectCarouselVehicles(vehicles: DemoVehicle[], initialFeatured?: DemoVehicle): DemoVehicle[] {
  if (!vehicles || vehicles.length === 0) return [];

  // Filtrar unidades disponibles y verificadas que posean fotografía
  const availableWithPhotos = vehicles.filter(
    (v) => v.status === "DISPONIBLE" && v.verificationStatus !== "POR_CONFIRMAR" && v.photos && v.photos.length > 0
  );

  const fallbackAvailable = vehicles.filter(
    (v) => v.status === "DISPONIBLE" && v.verificationStatus !== "POR_CONFIRMAR"
  );

  const pool = availableWithPhotos.length > 0
    ? availableWithPhotos
    : fallbackAvailable.length > 0
      ? fallbackAvailable
      : vehicles.filter((v) => v.status !== "VENDIDO");

  if (pool.length <= 1) return pool;

  // Determinar vehículo inicial (priorizando el protagonista pasado o el primer destacado)
  const initial =
    (initialFeatured && pool.find((v) => v.id === initialFeatured.id)) ||
    pool.find((v) => v.featured) ||
    pool[0];

  const remaining = pool.filter((v) => v.id !== initial.id);

  // Ordenar los restantes colocando primero los destacados
  remaining.sort((a, b) => {
    if (a.featured && !b.featured) return -1;
    if (!a.featured && b.featured) return 1;
    return 0;
  });

  const selected: DemoVehicle[] = [initial];
  const usedIds = new Set<string>([initial.id]);

  // Selección alternando marcas para garantizar variedad visual
  while (remaining.length > 0 && selected.length < 8) {
    const lastBrand = selected[selected.length - 1].brand;
    const diffBrandIdx = remaining.findIndex((v) => v.brand !== lastBrand && !usedIds.has(v.id));

    if (diffBrandIdx !== -1) {
      const item = remaining.splice(diffBrandIdx, 1)[0];
      selected.push(item);
      usedIds.add(item.id);
    } else {
      const anyIdx = remaining.findIndex((v) => !usedIds.has(v.id));
      if (anyIdx !== -1) {
        const item = remaining.splice(anyIdx, 1)[0];
        selected.push(item);
        usedIds.add(item.id);
      } else {
        break;
      }
    }
  }

  return selected;
}

export function HeroFeaturedCarousel({
  vehicles,
  featuredVehicle,
  onOpenAppointmentModal,
}: HeroFeaturedCarouselProps) {
  // Lista memoizada de vehículos para el carrusel
  const carouselVehicles = useMemo(
    () => selectCarouselVehicles(vehicles, featuredVehicle),
    [vehicles, featuredVehicle]
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [prevIndex, setPrevIndex] = useState<number | null>(null);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [isPaused, setIsPaused] = useState(false);
  const [timerKey, setTimerKey] = useState(0);

  // Navegación manual hacia adelante
  const handleNext = useCallback(() => {
    if (carouselVehicles.length <= 1) return;
    setPrevIndex(currentIndex);
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % carouselVehicles.length);
    setTimerKey((k) => k + 1);
  }, [carouselVehicles.length, currentIndex]);

  // Navegación manual hacia atrás
  const handlePrev = useCallback(() => {
    if (carouselVehicles.length <= 1) return;
    setPrevIndex(currentIndex);
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + carouselVehicles.length) % carouselVehicles.length);
    setTimerKey((k) => k + 1);
  }, [carouselVehicles.length, currentIndex]);

  // Selección por indicador directo
  const handleSelect = useCallback(
    (idx: number) => {
      if (idx === currentIndex || idx < 0 || idx >= carouselVehicles.length) return;
      setPrevIndex(currentIndex);
      setDirection(idx > currentIndex ? 1 : -1);
      setCurrentIndex(idx);
      setTimerKey((k) => k + 1);
    },
    [carouselVehicles.length, currentIndex]
  );

  // Rotación automática cada 5 segundos (5000 ms)
  useEffect(() => {
    if (isPaused || carouselVehicles.length <= 1) return;

    const interval = setInterval(() => {
      setPrevIndex(currentIndex);
      setDirection(1);
      setCurrentIndex((prev) => (prev + 1) % carouselVehicles.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [isPaused, carouselVehicles.length, timerKey, currentIndex]);

  // Precargar la imagen del siguiente y anterior vehículo para evitar parpadeos
  useEffect(() => {
    if (carouselVehicles.length <= 1 || typeof window === "undefined") return;

    const nextIdx = (currentIndex + 1) % carouselVehicles.length;
    const prevIdx = (currentIndex - 1 + carouselVehicles.length) % carouselVehicles.length;

    [nextIdx, prevIdx].forEach((idx) => {
      const url = carouselVehicles[idx]?.photos?.[0]?.url;
      if (url) {
        const img = new window.Image();
        img.src = url;
      }
    });
  }, [currentIndex, carouselVehicles]);

  // Manejo de gestos táctiles (swipe) en dispositivos móviles
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    setIsPaused(true);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current !== null && touchStartY.current !== null) {
      const deltaX = e.changedTouches[0].clientX - touchStartX.current;
      const deltaY = e.changedTouches[0].clientY - touchStartY.current;

      // Se comprueba que sea un gesto prioritariamente horizontal (para no bloquear scroll vertical)
      if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
        if (deltaX < 0) {
          handleNext();
        } else {
          handlePrev();
        }
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
    setIsPaused(false);
  };

  // Vehículo actual y vehículo previo para cross-fade suave
  const currentVehicle = carouselVehicles[currentIndex] || carouselVehicles[0];
  const previousVehicle = prevIndex !== null ? carouselVehicles[prevIndex] : null;

  if (!currentVehicle) return null;

  const currentPhoto = currentVehicle.photos?.[0]?.url || "/demo/ford-ranger-1.jpg";
  const prevPhoto = previousVehicle?.photos?.[0]?.url;

  return (
    <div
      data-testid="featured-vehicle-card"
      className="group relative rounded-2xl border border-white/15 bg-zinc-900/60 backdrop-blur-xl p-4.5 shadow-2xl transition-all duration-300 hover:border-red-500/40 hover:bg-zinc-900/80 w-full max-w-md mx-auto lg:max-w-none select-none"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Contenedor de Fotografía con proporción 16:10 */}
      <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-zinc-800">
        {/* Capa de fondo con la imagen previa para garantizar cross-fade limpio sin destellos */}
        {prevPhoto && previousVehicle && previousVehicle.id !== currentVehicle.id && (
          <div className="absolute inset-0 z-0 pointer-events-none" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={prevPhoto}
              alt=""
              className="size-full object-cover"
            />
          </div>
        )}

        {/* Enlace y fotografía activa con efecto de animación fade + desplazamiento sutil */}
        <Link
          key={`img-${currentVehicle.id}`}
          href={`/autos/${currentVehicle.slug}`}
          className={`block relative z-10 size-full focus:outline-none ${
            direction > 0 ? "carousel-fade-slide-right" : "carousel-fade-slide-left"
          }`}
          aria-label={`Ver ficha técnica de ${currentVehicle.brand} ${currentVehicle.model}`}
          data-testid="carousel-image-link"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentPhoto}
            alt={`${currentVehicle.brand} ${currentVehicle.model}`}
            className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
            draggable={false}
          />
        </Link>

        {/* Badge "Destacado" exacto al diseño original */}
        <div className="pointer-events-none absolute top-2.5 left-2.5 flex items-center gap-1.5 rounded-lg bg-black/75 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm z-20">
          <span className="size-1.5 rounded-full bg-emerald-400" />
          <span>Destacado</span>
        </div>

        {/* Badge de Ubicación en la esquina inferior derecha de la foto */}
        <div className="pointer-events-none absolute bottom-2.5 right-2.5 rounded-lg bg-zinc-950/80 px-2.5 py-0.5 text-xs font-semibold text-zinc-300 backdrop-blur-sm z-20">
          {currentVehicle.branch?.comuna || BUSINESS.city}
        </div>

        {/* Flechas de Navegación Manual minimalistas */}
        {carouselVehicles.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handlePrev();
              }}
              aria-label="Vehículo anterior"
              data-testid="carousel-prev"
              className="absolute left-2.5 top-1/2 -translate-y-1/2 z-30 grid size-8 place-items-center rounded-full bg-black/60 hover:bg-red-600 text-white/90 hover:text-white backdrop-blur-md border border-white/10 hover:border-red-500/50 shadow-md transition-all duration-200 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 cursor-pointer"
            >
              <ChevronLeft className="size-4" />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleNext();
              }}
              aria-label="Vehículo siguiente"
              data-testid="carousel-next"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 z-30 grid size-8 place-items-center rounded-full bg-black/60 hover:bg-red-600 text-white/90 hover:text-white backdrop-blur-md border border-white/10 hover:border-red-500/50 shadow-md transition-all duration-200 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 cursor-pointer"
            >
              <ChevronRight className="size-4" />
            </button>
          </>
        )}
      </div>

      {/* Información Dinámica del Vehículo con altura estricta para evitar saltos */}
      <div
        key={`info-${currentVehicle.id}`}
        className={direction > 0 ? "carousel-fade-slide-right" : "carousel-fade-slide-left"}
      >
        <div className="mt-3.5 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <Link
              href={`/autos/${currentVehicle.slug}`}
              className="font-extrabold text-base text-white group-hover:text-red-400 hover:!text-red-400 transition-colors block truncate"
              title={`${currentVehicle.brand} ${currentVehicle.model}`}
              data-testid="carousel-title-link"
            >
              <span data-testid="carousel-brand-model">{currentVehicle.brand} {currentVehicle.model}</span>
            </Link>
            <p className="text-xs text-zinc-400 font-medium truncate mt-0.5" data-testid="carousel-version-year">
              {currentVehicle.version ? `${currentVehicle.version} · ` : ""}{currentVehicle.year}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-base font-black text-red-400 tabular-nums" data-testid="carousel-price">
              {clp(currentVehicle.price)}
            </p>
            <span className="text-[10px] text-zinc-400 font-semibold block">
              Precio publicado
            </span>
          </div>
        </div>

        {/* Pie de la tarjeta: Ubicación y Botón de Agendar visita */}
        <div className="mt-3.5 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
          <span className="text-zinc-400 font-medium flex items-center gap-1 truncate">
            <MapPin className="size-3.5 text-red-500 shrink-0" />
            <span className="truncate">{BUSINESS.showroom}</span>
          </span>
          <button
            type="button"
            onClick={() => onOpenAppointmentModal(currentVehicle.id, currentVehicle.branchId)}
            className="font-bold text-red-400 hover:text-red-300 inline-flex min-h-11 items-center gap-1 cursor-pointer shrink-0"
            data-testid="carousel-appointment-button"
          >
            <span>Agendar visita</span>
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Indicadores pequeños en la parte inferior de la tarjeta */}
      {carouselVehicles.length > 1 && (
        <div
          className="mt-3 pt-1 flex items-center justify-center gap-1.5"
          role="tablist"
          aria-label="Indicadores de vehículos destacados"
          data-testid="carousel-indicators"
        >
          {carouselVehicles.map((v, idx) => (
            <button
              key={v.id || idx}
              type="button"
              role="tab"
              aria-selected={idx === currentIndex}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSelect(idx);
              }}
              aria-label={`Ir al vehículo ${idx + 1} de ${carouselVehicles.length}: ${v.brand} ${v.model}`}
              data-testid={`carousel-dot-${idx}`}
              className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                idx === currentIndex
                  ? "w-6 bg-red-500 shadow-sm shadow-red-500/50"
                  : "w-1.5 bg-white/25 hover:bg-white/60"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
