"use client";

import { useState, useEffect, useMemo } from "react";
import { useStored } from "@/lib/use-stored";
import Link from "next/link";
import {
  ArrowRight,
  MapPin,
  Calendar,
  FilterX,
  Car,
  Heart,
  MessageCircle,
  Gauge,
  SlidersHorizontal,
  Fuel,
  CheckCircle2,
  Clock,
  ExternalLink,
  RotateCcw,
  Sliders,
  ChevronDown,
  X,
} from "lucide-react";
import { clp, km } from "@/lib/format";
import type { DemoVehicle, DemoBranch, HeroFilterState } from "@/types/hero-demo";

interface DemoCatalogShowcaseProps {
  vehicles: DemoVehicle[];
  allVehicles: DemoVehicle[];
  branches: DemoBranch[];
  filters: HeroFilterState;
  onFilterChange: (newFilters: HeroFilterState) => void;
  onResetFilters: () => void;
  onOpenAppointmentModal: (vehicleId: string, branchId: string) => void;
}

// Skeleton loading con efecto shimmer para transiciones suaves de catálogo
function CatalogSkeleton() {
  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7 animate-in fade-in duration-200"
      aria-busy="true"
      aria-label="Cargando inventario de vehículos..."
    >
      {Array.from({ length: 6 }).map((_, idx) => (
        <div
          key={idx}
          className="rounded-2xl border border-line bg-surface overflow-hidden flex flex-col justify-between h-[470px] shadow-sm animate-pulse"
        >
          <div className="relative aspect-[16/10] bg-surface-2 skeleton-shimmer" />
          <div className="p-5 flex-1 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="h-5 w-3/4 rounded-lg bg-surface-2 skeleton-shimmer" />
              <div className="h-3.5 w-1/2 rounded-md bg-surface-2 skeleton-shimmer" />
            </div>
            <div className="h-7 w-2/5 rounded-lg bg-surface-2 skeleton-shimmer my-3" />
            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-line">
              <div className="h-9 rounded-lg bg-surface-2 skeleton-shimmer" />
              <div className="h-9 rounded-lg bg-surface-2 skeleton-shimmer" />
              <div className="h-9 rounded-lg bg-surface-2 skeleton-shimmer" />
            </div>
            <div className="h-4 w-2/3 rounded bg-surface-2 skeleton-shimmer pt-2" />
          </div>
          <div className="border-t border-line px-5 py-3.5 bg-surface-2/40 flex items-center justify-between gap-2 mt-auto">
            <div className="h-9 w-24 rounded-xl bg-surface-2 skeleton-shimmer" />
            <div className="h-9 w-28 rounded-xl bg-surface-2 skeleton-shimmer" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DemoCatalogShowcase({
  vehicles,
  allVehicles,
  branches,
  filters,
  onFilterChange,
  onResetFilters,
  onOpenAppointmentModal,
}: DemoCatalogShowcaseProps) {
  // Manejo de Favoritos persistido en localStorage
  const [favoritesRaw, setFavoritesRaw] = useStored("stroker_favorites_ids", "[]");
  const favorites = useMemo<string[]>(() => { try { return JSON.parse(favoritesRaw); } catch { return []; } }, [favoritesRaw]);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [filtersOpenMobile, setFiltersOpenMobile] = useState(false);

  // Skeleton breve al cambiar filtros: se muestra mientras la clave visible no alcanza a la actual.
  const filterKey = JSON.stringify([filters, onlyFavorites]);
  const [shownKey, setShownKey] = useState(filterKey);
  const isFiltering = shownKey !== filterKey;
  useEffect(() => {
    const timer = setTimeout(() => setShownKey(filterKey), 120);
    return () => clearTimeout(timer);
  }, [filterKey]);

  const toggleFavorite = (vehicleId: string) => {
    const next = favorites.includes(vehicleId) ? favorites.filter((id) => id !== vehicleId) : [...favorites, vehicleId];
    setFavoritesRaw(JSON.stringify(next));
  };

  // Listas únicas para los selectores a partir de los datos existentes
  const availableBrands = useMemo(
    () => Array.from(new Set(allVehicles.map((v) => v.brand))).sort(),
    [allVehicles]
  );

  const availableYears = useMemo(
    () => Array.from(new Set(allVehicles.map((v) => v.year))).sort((a, b) => b - a),
    [allVehicles]
  );

  const availableTransmissions = useMemo(
    () => Array.from(new Set(allVehicles.map((v) => v.transmission))).sort(),
    [allVehicles]
  );

  // Opciones de precio máximo
  const priceOptions = [
    { label: "Cualquier precio", value: "" },
    { label: "Hasta $8.000.000", value: "8000000" },
    { label: "Hasta $10.000.000", value: "10000000" },
    { label: "Hasta $12.000.000", value: "12000000" },
    { label: "Hasta $15.000.000", value: "15000000" },
    { label: "Hasta $18.000.000", value: "18000000" },
    { label: "Hasta $20.000.000", value: "20000000" },
    { label: "Hasta $26.000.000", value: "26000000" },
  ];

  // Opciones de kilometraje máximo
  const kmOptions = [
    { label: "Cualquier kilometraje", value: "" },
    { label: "Hasta 30.000 km", value: "30000" },
    { label: "Hasta 50.000 km", value: "50000" },
    { label: "Hasta 70.000 km", value: "70000" },
    { label: "Hasta 100.000 km", value: "100000" },
  ];

  // Vehículos finales aplicando filtro de favoritos si está activo
  const displayedVehicles = useMemo(() => {
    if (!onlyFavorites) return vehicles;
    return vehicles.filter((v) => favorites.includes(v.id));
  }, [vehicles, onlyFavorites, favorites]);

  const hasActiveFilters = Boolean(
    filters.marca ||
      filters.precioMin ||
      filters.precioMax ||
      filters.anio ||
      filters.kmMax ||
      filters.transmision ||
      filters.sucursal ||
      (filters.orden && filters.orden !== "destacados") ||
      onlyFavorites
  );

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.marca) count++;
    if (filters.precioMin || filters.precioMax) count++;
    if (filters.anio) count++;
    if (filters.kmMax) count++;
    if (filters.transmision) count++;
    if (filters.sucursal) count++;
    if (filters.orden && filters.orden !== "destacados") count++;
    if (onlyFavorites) count++;
    return count;
  }, [filters, onlyFavorites]);

  const handleFieldChange = (field: keyof HeroFilterState, value: string) => {
    onFilterChange({
      ...filters,
      [field]: value,
    });
  };

  const handleReset = () => {
    setOnlyFavorites(false);
    onResetFilters();
  };

  return (
    <section id="vitrina" className="py-16 sm:py-24 mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
      {/* Encabezado comercial de la Vitrina */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8 border-b border-line pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-accent">
              Vitrina Comercial Stroker
            </span>
            <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-[10px] font-bold text-accent uppercase tracking-wide">
              {allVehicles.length} Unidades en Stock
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink mt-1.5">
            Vehículos Destacados en Stock
          </h2>
          <p className="text-sm text-muted mt-1 max-w-2xl">
            Unidades inspeccionadas con entrega inmediata en Santiago y Viña del Mar. Garantía legal, historial al día y financiamiento a tu medida.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/panel/inventario"
            className="btn btn-ghost text-xs sm:text-sm hover:text-accent font-semibold flex items-center gap-1.5"
          >
            <span>Ver inventario completo en panel</span>
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>

      {/* Barra de Filtros y Ordenamiento Premium */}
      <div className="mb-8 rounded-2xl border border-line bg-surface p-4 sm:p-5 shadow-sm">
        {/* Fila superior: Título de filtros y botón toggle para móvil */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-line">
          <div className="flex items-center gap-2">
            <Sliders className="size-4 text-accent" />
            <span className="text-xs font-bold uppercase tracking-wider text-ink">
              Filtros y Ordenamiento
            </span>
            <span className="text-xs text-muted font-medium ml-1">
              ({displayedVehicles.length} de {allVehicles.length} vehículos)
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Toggle de Favoritos */}
            <button
              type="button"
              onClick={() => setOnlyFavorites(!onlyFavorites)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all duration-200 cursor-pointer ${
                onlyFavorites
                  ? "border-red-500 bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300"
                  : "border-line bg-surface hover:bg-surface-2 text-muted hover:text-ink"
              }`}
            >
              <Heart
                className={`size-3.5 ${
                  onlyFavorites ? "fill-red-600 text-red-600 dark:fill-red-400 dark:text-red-400" : ""
                }`}
              />
              <span>Mis Favoritos ({favorites.length})</span>
            </button>

            {/* Botón abrir filtros en Bottom Sheet móvil (área táctil ≥44px) */}
            <button
              type="button"
              onClick={() => setFiltersOpenMobile(true)}
              className="sm:hidden inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface-2 hover:bg-surface px-3.5 min-h-[44px] text-xs font-semibold text-ink transition-colors cursor-pointer"
              aria-label="Abrir panel de filtros"
            >
              <SlidersHorizontal className="size-4 text-accent" />
              <span>Filtros</span>
              {activeFiltersCount > 0 && (
                <span className="grid size-5 place-items-center rounded-full bg-accent text-[10px] font-bold text-white">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Formulario de controles de Filtros y Ordenamiento (Escritorio y Tablet) */}
        <div className="hidden sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3 pt-1">
          {/* 1. Marca */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1">
              Marca
            </label>
            <div className="relative">
              <select
                value={filters.marca}
                onChange={(e) => handleFieldChange("marca", e.target.value)}
                className="w-full appearance-none rounded-xl border border-line bg-surface px-3 py-2 text-xs font-medium text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors cursor-pointer"
                aria-label="Filtrar por marca"
              >
                <option value="">Todas las marcas</option>
                {availableBrands.map((brand) => (
                  <option key={brand} value={brand}>
                    {brand}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-2.5 top-2.5 text-muted text-[10px]">
                ▼
              </div>
            </div>
          </div>

          {/* 2. Precio Máximo */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1">
              Precio Máximo
            </label>
            <div className="relative">
              <select
                value={filters.precioMax}
                onChange={(e) => handleFieldChange("precioMax", e.target.value)}
                className="w-full appearance-none rounded-xl border border-line bg-surface px-3 py-2 text-xs font-medium text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors cursor-pointer"
                aria-label="Filtrar por precio máximo"
              >
                {priceOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-2.5 top-2.5 text-muted text-[10px]">
                ▼
              </div>
            </div>
          </div>

          {/* 3. Año */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1">
              Año
            </label>
            <div className="relative">
              <select
                value={filters.anio}
                onChange={(e) => handleFieldChange("anio", e.target.value)}
                className="w-full appearance-none rounded-xl border border-line bg-surface px-3 py-2 text-xs font-medium text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors cursor-pointer"
                aria-label="Filtrar por año"
              >
                <option value="">Todos los años</option>
                {availableYears.map((year) => (
                  <option key={year} value={year.toString()}>
                    Año {year}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-2.5 top-2.5 text-muted text-[10px]">
                ▼
              </div>
            </div>
          </div>

          {/* 4. Kilometraje */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1">
              Kilometraje
            </label>
            <div className="relative">
              <select
                value={filters.kmMax || ""}
                onChange={(e) => handleFieldChange("kmMax", e.target.value)}
                className="w-full appearance-none rounded-xl border border-line bg-surface px-3 py-2 text-xs font-medium text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors cursor-pointer"
                aria-label="Filtrar por kilometraje"
              >
                {kmOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-2.5 top-2.5 text-muted text-[10px]">
                ▼
              </div>
            </div>
          </div>

          {/* 5. Transmisión */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1">
              Transmisión
            </label>
            <div className="relative">
              <select
                value={filters.transmision || ""}
                onChange={(e) => handleFieldChange("transmision", e.target.value)}
                className="w-full appearance-none rounded-xl border border-line bg-surface px-3 py-2 text-xs font-medium text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors cursor-pointer"
                aria-label="Filtrar por transmisión"
              >
                <option value="">Todas las cajas</option>
                {availableTransmissions.map((trans) => (
                  <option key={trans} value={trans}>
                    {trans}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-2.5 top-2.5 text-muted text-[10px]">
                ▼
              </div>
            </div>
          </div>

          {/* 6. Sucursal */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1">
              Sucursal
            </label>
            <div className="relative">
              <select
                value={filters.sucursal}
                onChange={(e) => handleFieldChange("sucursal", e.target.value)}
                className="w-full appearance-none rounded-xl border border-line bg-surface px-3 py-2 text-xs font-medium text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors cursor-pointer"
                aria-label="Filtrar por sucursal"
              >
                <option value="">Todas las sucursales</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-2.5 top-2.5 text-muted text-[10px]">
                ▼
              </div>
            </div>
          </div>

          {/* 7. Ordenamiento */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1">
              Ordenar por
            </label>
            <div className="relative">
              <select
                value={filters.orden || "destacados"}
                onChange={(e) => handleFieldChange("orden", e.target.value)}
                className="w-full appearance-none rounded-xl border border-line bg-surface px-3 py-2 text-xs font-medium text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors cursor-pointer"
                aria-label="Ordenar vehículos"
              >
                <option value="destacados">Destacados</option>
                <option value="precio-asc">Menor precio</option>
                <option value="precio-desc">Mayor precio</option>
                <option value="anio-desc">Año: más nuevo</option>
                <option value="anio-asc">Año: más antiguo</option>
                <option value="km-asc">Menor kilometraje</option>
              </select>
              <div className="pointer-events-none absolute right-2.5 top-2.5 text-muted text-[10px]">
                ▼
              </div>
            </div>
          </div>
        </div>

        {/* Barra de filtros activos con botón de limpieza */}
        {hasActiveFilters && (
          <div className="mt-4 pt-3.5 border-t border-line flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-bold text-ink mr-1">Filtros activos:</span>
              {filters.marca && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-surface-2 border border-line px-2.5 py-1 text-ink font-medium">
                  Marca: <strong>{filters.marca}</strong>
                  <button
                    type="button"
                    onClick={() => handleFieldChange("marca", "")}
                    className="text-muted hover:text-accent ml-1 font-bold"
                  >
                    ×
                  </button>
                </span>
              )}
              {filters.precioMax && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-surface-2 border border-line px-2.5 py-1 text-ink font-medium">
                  Hasta: <strong>{clp(parseInt(filters.precioMax, 10))}</strong>
                  <button
                    type="button"
                    onClick={() => handleFieldChange("precioMax", "")}
                    className="text-muted hover:text-accent ml-1 font-bold"
                  >
                    ×
                  </button>
                </span>
              )}
              {filters.anio && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-surface-2 border border-line px-2.5 py-1 text-ink font-medium">
                  Año: <strong>{filters.anio}</strong>
                  <button
                    type="button"
                    onClick={() => handleFieldChange("anio", "")}
                    className="text-muted hover:text-accent ml-1 font-bold"
                  >
                    ×
                  </button>
                </span>
              )}
              {filters.kmMax && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-surface-2 border border-line px-2.5 py-1 text-ink font-medium">
                  Km: <strong>{km(parseInt(filters.kmMax, 10))}</strong>
                  <button
                    type="button"
                    onClick={() => handleFieldChange("kmMax", "")}
                    className="text-muted hover:text-accent ml-1 font-bold"
                  >
                    ×
                  </button>
                </span>
              )}
              {filters.transmision && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-surface-2 border border-line px-2.5 py-1 text-ink font-medium">
                  Caja: <strong>{filters.transmision}</strong>
                  <button
                    type="button"
                    onClick={() => handleFieldChange("transmision", "")}
                    className="text-muted hover:text-accent ml-1 font-bold"
                  >
                    ×
                  </button>
                </span>
              )}
              {filters.sucursal && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-surface-2 border border-line px-2.5 py-1 text-ink font-medium">
                  Sucursal seleccionada
                  <button
                    type="button"
                    onClick={() => handleFieldChange("sucursal", "")}
                    className="text-muted hover:text-accent ml-1 font-bold"
                  >
                    ×
                  </button>
                </span>
              )}
              {onlyFavorites && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-red-500/10 border border-red-500/20 px-2.5 py-1 text-red-600 dark:text-red-400 font-medium">
                  Solo favoritos
                  <button
                    type="button"
                    onClick={() => setOnlyFavorites(false)}
                    className="ml-1 font-bold"
                  >
                    ×
                  </button>
                </span>
              )}
              {filters.orden && filters.orden !== "destacados" && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-surface-2 border border-line px-2.5 py-1 text-ink font-medium">
                  Orden: <strong>{filters.orden}</strong>
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface hover:bg-surface-2 px-3 py-1.5 text-xs font-semibold text-accent transition-colors cursor-pointer"
            >
              <RotateCcw className="size-3.5" />
              <span>Limpiar filtros</span>
            </button>
          </div>
        )}
      </div>

      {/* CUADRÍCULA DE VEHÍCULOS: 3 columnas en escritorio, 2 en tablet cuando exista espacio, 1 en móvil */}
      {isFiltering ? (
        <CatalogSkeleton />
      ) : displayedVehicles.length > 0 ? (
        <div id="vitrina-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7 animate-in fade-in duration-200">
          {displayedVehicles.map((v) => {
            const photo = v.photos?.[0]?.url || "/demo/placeholder.svg";
            const isFav = favorites.includes(v.id);
            const isReservado = v.status === "RESERVADO";
            const isVendido = v.status === "VENDIDO";
            const isDisponible = v.status === "DISPONIBLE" || (!isReservado && !isVendido);

            // Mensaje para consulta por WhatsApp con datos reales
            const waQuery = `/api/web/wa?v=${v.id}`;
            const detailUrl = `/autos/${v.slug}`;

            return (
              <div
                key={v.id}
                className="group relative rounded-2xl border border-line bg-surface shadow-sm hover:shadow-xl hover:shadow-black/10 dark:hover:shadow-black/50 hover:border-accent/40 transition-all duration-300 ease-out hover:-translate-y-1.5 flex flex-col justify-between h-full overflow-hidden motion-reduce:transform-none motion-reduce:transition-none"
              >
                <div>
                  {/* Contenedor de Imagen amplia con proporción uniforme 16:10 */}
                  <div className="relative aspect-[16/10] bg-surface-2 overflow-hidden">
                    <img
                      src={photo}
                      alt={`${v.brand} ${v.model} ${v.year}`}
                      loading="lazy"
                      className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-105 motion-reduce:transform-none"
                    />

                    {/* Degradado sutil inferior en la foto para realzar detalles */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />

                    {/* Badge de Estado: Disponible, Reservado o Vendido según datos reales */}
                    <div className="absolute top-3 left-3 flex items-center gap-2">
                      {isDisponible && (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600/90 text-white backdrop-blur-md px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase shadow-md">
                          <span className="size-1.5 rounded-full bg-white animate-pulse motion-reduce:animate-none" />
                          <span>Disponible</span>
                        </span>
                      )}
                      {isReservado && (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/95 text-white backdrop-blur-md px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase shadow-md">
                          <Clock className="size-3" />
                          <span>Reservado</span>
                        </span>
                      )}
                      {isVendido && (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800/95 text-zinc-100 backdrop-blur-md px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase shadow-md">
                          <CheckCircle2 className="size-3 text-zinc-400" />
                          <span>Vendido</span>
                        </span>
                      )}
                    </div>

                    {/* Icono de Favoritos interactivo con hover y persistencia (Área táctil ≥44px) */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleFavorite(v.id);
                      }}
                      aria-label={isFav ? "Quitar de favoritos" : "Guardar en favoritos"}
                      className={`absolute top-3 right-3 grid size-11 min-h-[44px] min-w-[44px] place-items-center rounded-full backdrop-blur-md transition-all duration-200 border cursor-pointer z-10 ${
                        isFav
                          ? "bg-red-600 border-red-500 text-white scale-105 shadow-lg shadow-red-950/40"
                          : "bg-black/45 border-white/20 text-white/80 hover:bg-black/75 hover:text-white hover:scale-105"
                      }`}
                    >
                      <Heart
                        className={`size-4 transition-transform ${
                          isFav ? "fill-white text-white" : ""
                        }`}
                      />
                    </button>

                    {/* Comuna de la Sucursal en la foto */}
                    <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 rounded-lg bg-black/70 backdrop-blur-md px-2.5 py-1 text-[11px] font-semibold text-white">
                      <MapPin className="size-3 text-red-500" />
                      <span>{v.branch?.comuna}</span>
                    </div>

                    {/* Año en etiqueta fotográfica */}
                    <div className="absolute bottom-2.5 left-2.5 rounded-md bg-white/95 dark:bg-zinc-950/90 backdrop-blur-md px-2 py-0.5 text-[11px] font-black text-ink shadow-sm">
                      {v.year}
                    </div>
                  </div>
                </div>

                {/* Cuerpo de la tarjeta con información estructurada y altura fija en encabezado para alineación uniforme */}
                <div className="p-5 flex-1 flex flex-col justify-between">
                  {/* Marca, modelo, versión y año con min-height fijo para evitar desalineación entre tarjetas */}
                  <div className="min-w-0 min-h-[48px]">
                    <h3 className="font-extrabold text-lg text-ink group-hover:text-accent transition-colors leading-snug truncate">
                      {v.brand} {v.model}
                    </h3>
                    <p className="text-xs text-muted font-medium mt-0.5 truncate">
                      {v.version} · {v.year}
                    </p>
                  </div>

                  {/* Precio destacado en pesos chilenos */}
                  <div className="mt-3.5 flex items-baseline justify-between gap-2 border-b border-line pb-3.5">
                    <div>
                      <span className="text-2xl font-black text-accent tabular-nums tracking-tight">
                        {clp(v.price)}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                      CLP Exacto
                    </span>
                  </div>

                  {/* Fila técnica de 3 columnas: Kilometraje, Transmisión, Combustible */}
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
                      <span className="font-bold text-ink mt-0.5 truncate">{v.transmission}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-1">
                        <Fuel className="size-3 text-accent" /> Motor
                      </span>
                      <span className="font-bold text-ink mt-0.5 truncate">{v.fuel}</span>
                    </div>
                  </div>

                  {/* Sucursal asignada */}
                  <div className="mt-3.5 flex items-center gap-1.5 text-xs text-muted pt-2.5 border-t border-line">
                    <MapPin className="size-3.5 text-accent shrink-0" />
                    <span className="font-medium text-ink truncate">
                      {v.branch?.name} ({v.branch?.comuna})
                    </span>
                  </div>
                </div>

                {/* Footer de Acciones anclado al fondo: Botón "Ver detalles", "WhatsApp" y "Agendar" (Áreas táctiles ≥44px) */}
                <div className="mt-auto border-t border-line px-5 py-3.5 bg-surface-2/40 flex items-center justify-between gap-2">
                  {/* Botón WhatsApp */}
                  <a
                    href={waQuery}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 min-h-[44px] text-xs font-bold shadow-sm transition-all duration-200 active:scale-[0.98] cursor-pointer"
                    title={`Consultar por WhatsApp sobre ${v.brand} ${v.model}`}
                  >
                    <MessageCircle className="size-4" />
                    <span>WhatsApp</span>
                  </a>

                  {/* Botones secundarios: Agendar visita y Ver detalles */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenAppointmentModal(v.id, v.branchId)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-line bg-surface hover:bg-surface-2 px-3 min-h-[44px] text-xs font-semibold text-ink transition-colors cursor-pointer"
                      title="Agendar visita demo"
                    >
                      <Calendar className="size-3.5 text-accent" />
                      <span className="hidden sm:inline">Cita</span>
                    </button>

                    <Link
                      href={detailUrl}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-graphite hover:bg-black text-white px-3.5 min-h-[44px] text-xs font-bold transition-all duration-200 active:scale-[0.98]"
                    >
                      <span>Ver detalles</span>
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Estado vacío refinado cuando no existen resultados con los filtros */
        <div className="rounded-2xl border border-line bg-surface p-8 sm:p-12 text-center max-w-xl mx-auto shadow-sm animate-in fade-in duration-300">
          <div className="mx-auto mb-4 grid size-16 place-items-center rounded-2xl bg-surface-2 text-muted border border-line">
            <Car className="size-8 text-accent" />
          </div>
          <h3 className="text-xl font-extrabold text-ink">
            No se encontraron vehículos
          </h3>
          <p className="mt-2 text-sm text-muted leading-relaxed">
            No hay unidades en el inventario DEMO que coincidan con la combinación de filtros seleccionada. Prueba ampliando el rango de precio, cambiando la transmisión o eligiendo otra sucursal.
          </p>

          {/* Sugerencias de búsqueda rápida con marcas existentes */}
          {availableBrands.length > 0 && (
            <div className="mt-5 pt-4 border-t border-line">
              <span className="text-xs font-semibold text-muted block mb-2.5">
                Marcas sugeridas con unidades en stock:
              </span>
              <div className="flex flex-wrap justify-center gap-2">
                {availableBrands.slice(0, 4).map((brand) => (
                  <button
                    key={brand}
                    type="button"
                    onClick={() => {
                      onFilterChange({ ...filters, marca: brand });
                    }}
                    className="rounded-lg border border-line bg-surface-2 hover:bg-surface hover:border-accent/40 px-3 py-1 text-xs font-semibold text-ink transition-colors cursor-pointer"
                  >
                    {brand}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="btn btn-primary text-xs sm:text-sm font-bold shadow-sm inline-flex items-center gap-2 cursor-pointer"
            >
              <RotateCcw className="size-4" />
              <span>Restablecer todos los filtros</span>
            </button>
            {onlyFavorites && (
              <button
                type="button"
                onClick={() => setOnlyFavorites(false)}
                className="btn btn-ghost text-xs sm:text-sm font-semibold"
              >
                Ver todos los vehículos
              </button>
            )}
          </div>
        </div>
      )}

      {/* 4. Panel Deslizable tipo Bottom Sheet para Móvil con Backdrop, Drag Handle y Áreas Táctiles ≥44px */}
      {filtersOpenMobile && (
        <div className="sm:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop semitransparente con desenfoque */}
          <div
            className="fixed inset-0 bg-black/65 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setFiltersOpenMobile(false)}
            aria-label="Cerrar panel de filtros"
          />

          {/* Drawer contenedor deslizable desde el borde inferior */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Filtros de búsqueda"
            className="relative z-10 flex flex-col max-h-[85vh] w-full rounded-t-3xl border-t border-line bg-surface shadow-2xl animate-in slide-in-from-bottom duration-300 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]"
          >
            {/* Drag Handle superior */}
            <div className="py-2.5 flex justify-center shrink-0">
              <div className="h-1.5 w-12 rounded-full bg-zinc-300 dark:bg-zinc-700" />
            </div>

            {/* Cabecera del Bottom Sheet */}
            <div className="flex items-center justify-between px-5 pb-3 border-b border-line shrink-0">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="size-4 text-accent" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-ink">
                  Filtros de Búsqueda
                </h3>
                {activeFiltersCount > 0 && (
                  <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent">
                    {activeFiltersCount} activos
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setFiltersOpenMobile(false)}
                className="grid size-11 min-h-[44px] min-w-[44px] place-items-center rounded-xl bg-surface-2 text-muted hover:text-ink transition-colors cursor-pointer"
                aria-label="Cerrar filtros"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Controles del Bottom Sheet optimizados para pantalla táctil */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* 1. Marca */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">
                  Marca
                </label>
                <div className="relative">
                  <select
                    value={filters.marca}
                    onChange={(e) => handleFieldChange("marca", e.target.value)}
                    className="w-full h-11 min-h-[44px] appearance-none rounded-xl border border-line bg-surface-2 px-3.5 text-xs font-semibold text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors cursor-pointer"
                    aria-label="Filtrar por marca móvil"
                  >
                    <option value="">Todas las marcas</option>
                    {availableBrands.map((brand) => (
                      <option key={brand} value={brand}>
                        {brand}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-3.5 top-3.5 text-muted text-xs">
                    ▼
                  </div>
                </div>
              </div>

              {/* 2. Precio Máximo */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">
                  Precio Máximo
                </label>
                <div className="relative">
                  <select
                    value={filters.precioMax}
                    onChange={(e) => handleFieldChange("precioMax", e.target.value)}
                    className="w-full h-11 min-h-[44px] appearance-none rounded-xl border border-line bg-surface-2 px-3.5 text-xs font-semibold text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors cursor-pointer"
                    aria-label="Filtrar por precio máximo móvil"
                  >
                    {priceOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-3.5 top-3.5 text-muted text-xs">
                    ▼
                  </div>
                </div>
              </div>

              {/* 3. Año */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">
                  Año
                </label>
                <div className="relative">
                  <select
                    value={filters.anio}
                    onChange={(e) => handleFieldChange("anio", e.target.value)}
                    className="w-full h-11 min-h-[44px] appearance-none rounded-xl border border-line bg-surface-2 px-3.5 text-xs font-semibold text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors cursor-pointer"
                    aria-label="Filtrar por año móvil"
                  >
                    <option value="">Todos los años</option>
                    {availableYears.map((year) => (
                      <option key={year} value={year.toString()}>
                        Año {year}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-3.5 top-3.5 text-muted text-xs">
                    ▼
                  </div>
                </div>
              </div>

              {/* 4. Kilometraje */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">
                  Kilometraje Máximo
                </label>
                <div className="relative">
                  <select
                    value={filters.kmMax || ""}
                    onChange={(e) => handleFieldChange("kmMax", e.target.value)}
                    className="w-full h-11 min-h-[44px] appearance-none rounded-xl border border-line bg-surface-2 px-3.5 text-xs font-semibold text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors cursor-pointer"
                    aria-label="Filtrar por kilometraje móvil"
                  >
                    {kmOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-3.5 top-3.5 text-muted text-xs">
                    ▼
                  </div>
                </div>
              </div>

              {/* 5. Transmisión */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">
                  Transmisión
                </label>
                <div className="relative">
                  <select
                    value={filters.transmision || ""}
                    onChange={(e) => handleFieldChange("transmision", e.target.value)}
                    className="w-full h-11 min-h-[44px] appearance-none rounded-xl border border-line bg-surface-2 px-3.5 text-xs font-semibold text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors cursor-pointer"
                    aria-label="Filtrar por transmisión móvil"
                  >
                    <option value="">Todas las transmisiones</option>
                    {availableTransmissions.map((trans) => (
                      <option key={trans} value={trans}>
                        {trans}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-3.5 top-3.5 text-muted text-xs">
                    ▼
                  </div>
                </div>
              </div>

              {/* 6. Sucursal */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">
                  Sucursal
                </label>
                <div className="relative">
                  <select
                    value={filters.sucursal}
                    onChange={(e) => handleFieldChange("sucursal", e.target.value)}
                    className="w-full h-11 min-h-[44px] appearance-none rounded-xl border border-line bg-surface-2 px-3.5 text-xs font-semibold text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors cursor-pointer"
                    aria-label="Filtrar por sucursal móvil"
                  >
                    <option value="">Todas las sucursales</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-3.5 top-3.5 text-muted text-xs">
                    ▼
                  </div>
                </div>
              </div>

              {/* 7. Ordenamiento */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">
                  Ordenar vehículos
                </label>
                <div className="relative">
                  <select
                    value={filters.orden || "destacados"}
                    onChange={(e) => handleFieldChange("orden", e.target.value)}
                    className="w-full h-11 min-h-[44px] appearance-none rounded-xl border border-line bg-surface-2 px-3.5 text-xs font-semibold text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors cursor-pointer"
                    aria-label="Ordenar vehículos móvil"
                  >
                    <option value="destacados">Destacados</option>
                    <option value="precio-asc">Menor precio</option>
                    <option value="precio-desc">Mayor precio</option>
                    <option value="anio-desc">Año: más nuevo</option>
                    <option value="anio-asc">Año: más antiguo</option>
                    <option value="km-asc">Menor kilometraje</option>
                  </select>
                  <div className="pointer-events-none absolute right-3.5 top-3.5 text-muted text-xs">
                    ▼
                  </div>
                </div>
              </div>

              {/* Toggle de Favoritos */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setOnlyFavorites(!onlyFavorites)}
                  className={`w-full h-11 min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border px-3 text-xs font-semibold transition-all duration-200 cursor-pointer ${
                    onlyFavorites
                      ? "border-red-500 bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300"
                      : "border-line bg-surface-2 text-muted hover:text-ink"
                  }`}
                >
                  <Heart
                    className={`size-4 ${
                      onlyFavorites ? "fill-red-600 text-red-600 dark:fill-red-400 dark:text-red-400" : ""
                    }`}
                  />
                  <span>
                    {onlyFavorites
                      ? "Mostrando solo mis favoritos"
                      : `Ver mis favoritos (${favorites.length})`}
                  </span>
                </button>
              </div>
            </div>

            {/* Barra fija inferior del Bottom Sheet */}
            <div className="border-t border-line px-5 pt-3.5 flex gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  handleReset();
                }}
                className="flex-1 h-11 min-h-[44px] rounded-xl border border-line bg-surface-2 hover:bg-surface text-xs font-bold text-muted hover:text-ink transition-colors cursor-pointer"
              >
                Limpiar filtros
              </button>
              <button
                type="button"
                onClick={() => {
                  setFiltersOpenMobile(false);
                  const el = document.getElementById("vitrina-grid");
                  if (el) el.scrollIntoView({ behavior: "smooth" });
                }}
                className="flex-1 h-11 min-h-[44px] rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-xs font-bold text-white shadow-md transition-colors cursor-pointer"
              >
                Ver {displayedVehicles.length} {displayedVehicles.length === 1 ? "vehículo" : "vehículos"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
