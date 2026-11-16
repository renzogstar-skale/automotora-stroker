"use client";

import { useState, useEffect, useMemo } from "react";
import { useStored } from "@/lib/use-stored";
import Link from "next/link";
import {
  ArrowRight,
  Heart,
  RotateCcw,
  Sliders,
  SlidersHorizontal,
  Car,
} from "lucide-react";
import { clp } from "@/lib/format";
import { BUSINESS } from "@/lib/business";
import type { DemoVehicle, DemoBranch, HeroFilterState } from "@/types/hero-demo";
import { UnifiedVehicleCard } from "@/components/vehicle/unified-vehicle-card";
import { CatalogMobileFilterDrawer } from "@/components/vehicle/catalog-mobile-filter-drawer";

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
          <div className="relative aspect-[16/10] bg-surface-2" />
          <div className="p-5 flex-1 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="h-5 w-3/4 rounded-lg bg-surface-2" />
              <div className="h-3.5 w-1/2 rounded-md bg-surface-2" />
            </div>
            <div className="h-7 w-2/5 rounded-lg bg-surface-2 my-3" />
            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-line">
              <div className="h-9 rounded-lg bg-surface-2" />
              <div className="h-9 rounded-lg bg-surface-2" />
              <div className="h-9 rounded-lg bg-surface-2" />
            </div>
            <div className="h-4 w-2/3 rounded bg-surface-2 pt-2" />
          </div>
          <div className="border-t border-line px-5 py-3.5 bg-surface-2/40 flex items-center justify-between gap-2 mt-auto">
            <div className="h-9 w-24 rounded-xl bg-surface-2" />
            <div className="h-9 w-28 rounded-xl bg-surface-2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DemoCatalogShowcase({
  vehicles,
  allVehicles,
  branches = [],
  filters,
  onFilterChange,
  onResetFilters,
  onOpenAppointmentModal,
}: DemoCatalogShowcaseProps) {
  // Manejo de Favoritos persistido en localStorage
  const [favoritesRaw, setFavoritesRaw] = useStored("stroker_favorites_ids", "[]");
  const favorites = useMemo<string[]>(() => {
    try {
      return JSON.parse(favoritesRaw);
    } catch {
      return [];
    }
  }, [favoritesRaw]);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [filtersOpenMobile, setFiltersOpenMobile] = useState(false);

  // Skeleton breve al cambiar filtros para dar feedback visual instantáneo
  const filterKey = JSON.stringify([filters, onlyFavorites]);
  const [shownKey, setShownKey] = useState(filterKey);
  const isFiltering = shownKey !== filterKey;
  useEffect(() => {
    const timer = setTimeout(() => setShownKey(filterKey), 120);
    return () => clearTimeout(timer);
  }, [filterKey]);

  const toggleFavorite = (vehicleId: string) => {
    const next = favorites.includes(vehicleId)
      ? favorites.filter((id) => id !== vehicleId)
      : [...favorites, vehicleId];
    setFavoritesRaw(JSON.stringify(next));
  };

  // Contadores de stock comercial real
  const disponiblesCount = useMemo(
    () =>
      allVehicles.filter(
        (v) => v.status === "DISPONIBLE" && v.verificationStatus !== "POR_CONFIRMAR"
      ).length,
    [allVehicles]
  );
  const reservadosCount = useMemo(
    () => allVehicles.filter((v) => v.status === "RESERVADO").length,
    [allVehicles]
  );
  const vendidosCount = useMemo(
    () => allVehicles.filter((v) => v.status === "VENDIDO").length,
    [allVehicles]
  );

  // Listas únicas para los selectores a partir de los datos existentes
  const availableBrands = useMemo(
    () => Array.from(new Set(allVehicles.map((v) => v.brand))).sort(),
    [allVehicles]
  );

  const availableModels = useMemo(() => {
    const pool = filters.marca
      ? allVehicles.filter((v) => v.brand === filters.marca)
      : allVehicles;
    return Array.from(new Set(pool.map((v) => v.model))).sort();
  }, [allVehicles, filters.marca]);

  const availableYears = useMemo(
    () => Array.from(new Set(allVehicles.map((v) => v.year))).sort((a, b) => b - a),
    [allVehicles]
  );

  const availableTransmissions = useMemo(
    () => Array.from(new Set(allVehicles.map((v) => v.transmission))).sort(),
    [allVehicles]
  );

  const availableFuels = useMemo(
    () => Array.from(new Set(allVehicles.map((v) => v.fuel))).sort(),
    [allVehicles]
  );

  // Opciones de precio mínimo
  const priceMinOptions = [
    { label: "Sin mínimo", value: "" },
    { label: "Desde $4.000.000", value: "4000000" },
    { label: "Desde $6.000.000", value: "6000000" },
    { label: "Desde $10.000.000", value: "10000000" },
    { label: "Desde $15.000.000", value: "15000000" },
    { label: "Desde $20.000.000", value: "20000000" },
    { label: "Desde $30.000.000", value: "30000000" },
  ];

  // Opciones de precio máximo
  const priceMaxOptions = [
    { label: "Cualquier precio máx.", value: "" },
    { label: "Hasta $8.000.000", value: "8000000" },
    { label: "Hasta $12.000.000", value: "12000000" },
    { label: "Hasta $15.000.000", value: "15000000" },
    { label: "Hasta $25.000.000", value: "25000000" },
    { label: "Hasta $35.000.000", value: "35000000" },
    { label: "Hasta $50.000.000", value: "50000000" },
    { label: "Hasta $120.000.000", value: "120000000" },
  ];

  // Opciones de kilometraje máximo
  const kmOptions = [
    { label: "Cualquier kilometraje", value: "" },
    { label: "Hasta 20.000 km", value: "20000" },
    { label: "Hasta 40.000 km", value: "40000" },
    { label: "Hasta 50.000 km", value: "50000" },
    { label: "Hasta 60.000 km", value: "60000" },
    { label: "Hasta 80.000 km", value: "80000" },
    { label: "Hasta 100.000 km", value: "100000" },
    { label: "Hasta 150.000 km", value: "150000" },
  ];

  // Vehículos finales aplicando filtro de favoritos si está activo
  const displayedVehicles = useMemo(() => {
    let list = vehicles;
    if (onlyFavorites) {
      list = list.filter((v) => favorites.includes(v.id));
    }
    return list;
  }, [vehicles, onlyFavorites, favorites]);

  const hasActiveFilters = Boolean(
    filters.marca ||
      filters.modelo ||
      filters.precioMin ||
      filters.precioMax ||
      filters.anio ||
      filters.kmMax ||
      filters.transmision ||
      filters.combustible ||
      filters.estado ||
      filters.sucursal ||
      (filters.orden && filters.orden !== "destacados") ||
      onlyFavorites
  );

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.marca) count++;
    if (filters.modelo) count++;
    if (filters.precioMin || filters.precioMax) count++;
    if (filters.anio) count++;
    if (filters.kmMax) count++;
    if (filters.transmision) count++;
    if (filters.combustible) count++;
    if (filters.estado) count++;
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
              Catálogo Oficial Automotora Stroker
            </span>
            <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">
              {disponiblesCount} Disponibles
            </span>
            {vendidosCount > 0 && (
              <span className="rounded-full bg-rose-500/10 border border-rose-500/20 px-2.5 py-0.5 text-[10px] font-bold text-rose-700 dark:text-rose-300 uppercase tracking-wide">
                {vendidosCount} Vendidos
              </span>
            )}
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink mt-1.5">
            Vehículos en Stock y Entregados
          </h2>
          <p className="text-sm text-muted mt-1 max-w-2xl">
            Unidades publicadas en {BUSINESS.showroom}, Antofagasta. Coordinamos despachos a cualquier región de Chile y financiamiento a tu medida.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/panel/inventario"
            className="btn btn-ghost text-xs sm:text-sm hover:text-accent font-semibold flex items-center gap-1.5"
          >
            <span>Gestión de Inventario</span>
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>

      {/* Pestañas de Navegación Comercial por Estado */}
      <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-line pb-4">
        <button
          type="button"
          onClick={() => handleFieldChange("estado", "")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
            !filters.estado
              ? "bg-accent text-white shadow-md shadow-accent/25"
              : "bg-surface-2 hover:bg-surface text-muted hover:text-ink border border-line"
          }`}
        >
          <span>Todos los vehículos</span>
          <span className="rounded-full bg-black/20 dark:bg-white/20 px-1.5 py-0.2 text-[10px]">
            {allVehicles.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleFieldChange("estado", "DISPONIBLE")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
            filters.estado === "DISPONIBLE"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-950/40"
              : "bg-surface-2 hover:bg-surface text-muted hover:text-ink border border-line"
          }`}
        >
          <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>🟢 Disponibles</span>
          <span className="rounded-full bg-emerald-900/30 px-1.5 py-0.2 text-[10px]">
            {disponiblesCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleFieldChange("estado", "RESERVADO")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
            filters.estado === "RESERVADO"
              ? "bg-amber-600 text-white shadow-md shadow-amber-950/40"
              : "bg-surface-2 hover:bg-surface text-muted hover:text-ink border border-line"
          }`}
        >
          <span>🟠 Reservados</span>
          <span className="rounded-full bg-amber-900/30 px-1.5 py-0.2 text-[10px]">
            {reservadosCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleFieldChange("estado", "VENDIDO")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
            filters.estado === "VENDIDO"
              ? "bg-rose-600 text-white shadow-md shadow-rose-950/40"
              : "bg-surface-2 hover:bg-surface text-muted hover:text-ink border border-line"
          }`}
        >
          <span>🔴 Vendidos</span>
          <span className="rounded-full bg-rose-900/30 px-1.5 py-0.2 text-[10px]">
            {vendidosCount}
          </span>
        </button>
      </div>

      {/* Barra de Filtros Inteligentes Simultáneos */}
      <div className="mb-8 rounded-2xl border border-line bg-surface p-4 sm:p-5 shadow-sm">
        {/* Fila superior: Título de filtros y botón toggle para móvil */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-line">
          <div className="flex items-center gap-2">
            <Sliders className="size-4 text-accent" />
            <span className="text-xs font-bold uppercase tracking-wider text-ink">
              Filtros Inteligentes
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
              <span>Favoritos ({favorites.length})</span>
            </button>

            {/* Botón abrir filtros en Drawer móvil */}
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

        {/* Formulario de controles de Filtros simultáneos (Escritorio y Tablet) */}
        <div className="hidden sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-9 gap-2.5 pt-1">
          {/* 1. Marca */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1">
              Marca
            </label>
            <div className="relative">
              <select
                value={filters.marca}
                onChange={(e) => {
                  onFilterChange({ ...filters, marca: e.target.value, modelo: "" });
                }}
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
              <div className="pointer-events-none absolute right-2.5 top-2.5 text-muted text-[10px]">▼</div>
            </div>
          </div>

          {/* 2. Modelo */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1">
              Modelo
            </label>
            <div className="relative">
              <select
                value={filters.modelo || ""}
                onChange={(e) => handleFieldChange("modelo", e.target.value)}
                className="w-full appearance-none rounded-xl border border-line bg-surface px-3 py-2 text-xs font-medium text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors cursor-pointer"
                aria-label="Filtrar por modelo"
              >
                <option value="">Todos los modelos</option>
                {availableModels.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-2.5 top-2.5 text-muted text-[10px]">▼</div>
            </div>
          </div>

          {/* 3. Sucursal */}
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
              <div className="pointer-events-none absolute right-2.5 top-2.5 text-muted text-[10px]">▼</div>
            </div>
          </div>

          {/* 4. Precio Máximo */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1">
              Precio Máx.
            </label>
            <div className="relative">
              <select
                value={filters.precioMax}
                onChange={(e) => handleFieldChange("precioMax", e.target.value)}
                className="w-full appearance-none rounded-xl border border-line bg-surface px-3 py-2 text-xs font-medium text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors cursor-pointer"
                aria-label="Filtrar por precio máximo"
              >
                {priceMaxOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-2.5 top-2.5 text-muted text-[10px]">▼</div>
            </div>
          </div>

          {/* 5. Año */}
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
                    {year}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-2.5 top-2.5 text-muted text-[10px]">▼</div>
            </div>
          </div>

          {/* 6. Kilometraje */}
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
              <div className="pointer-events-none absolute right-2.5 top-2.5 text-muted text-[10px]">▼</div>
            </div>
          </div>

          {/* 7. Transmisión */}
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
              <div className="pointer-events-none absolute right-2.5 top-2.5 text-muted text-[10px]">▼</div>
            </div>
          </div>

          {/* 8. Combustible */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1">
              Combustible
            </label>
            <div className="relative">
              <select
                value={filters.combustible || ""}
                onChange={(e) => handleFieldChange("combustible", e.target.value)}
                className="w-full appearance-none rounded-xl border border-line bg-surface px-3 py-2 text-xs font-medium text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors cursor-pointer"
                aria-label="Filtrar por combustible"
              >
                <option value="">Cualquier motor</option>
                {availableFuels.map((fuel) => (
                  <option key={fuel} value={fuel}>
                    {fuel}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-2.5 top-2.5 text-muted text-[10px]">▼</div>
            </div>
          </div>

          {/* 9. Ordenamiento */}
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
                <option value="recientes">Más recientes</option>
                <option value="precio-asc">Menor precio</option>
                <option value="precio-desc">Mayor precio</option>
                <option value="km-asc">Menor kilometraje</option>
                <option value="anio-desc">Año: más nuevo</option>
                <option value="anio-asc">Año: más antiguo</option>
              </select>
              <div className="pointer-events-none absolute right-2.5 top-2.5 text-muted text-[10px]">▼</div>
            </div>
          </div>
        </div>

        {/* Barra de filtros activos con botón de limpieza */}
        {hasActiveFilters && (
          <div className="mt-4 pt-3.5 border-t border-line flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-bold text-ink mr-1">Filtros activos:</span>
              {filters.estado && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-surface-2 border border-line px-2.5 py-1 text-ink font-medium">
                  Estado: <strong>{filters.estado}</strong>
                  <button
                    type="button"
                    onClick={() => handleFieldChange("estado", "")}
                    className="text-muted hover:text-accent ml-1 font-bold"
                  >
                    ×
                  </button>
                </span>
              )}
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
              {filters.modelo && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-surface-2 border border-line px-2.5 py-1 text-ink font-medium">
                  Modelo: <strong>{filters.modelo}</strong>
                  <button
                    type="button"
                    onClick={() => handleFieldChange("modelo", "")}
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
              {onlyFavorites && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-red-50 border border-red-200 text-red-600 dark:bg-red-950/40 dark:border-red-900/50 dark:text-red-300 px-2.5 py-1 font-medium">
                  <span>Solo Favoritos</span>
                  <button
                    type="button"
                    onClick={() => setOnlyFavorites(false)}
                    className="ml-1 font-bold"
                  >
                    ×
                  </button>
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface hover:bg-surface-2 px-3 py-1.5 text-xs font-semibold text-accent transition-colors cursor-pointer"
            >
              <RotateCcw className="size-3.5" />
              <span>Restablecer filtros</span>
            </button>
          </div>
        )}
      </div>

      {/* CUADRÍCULA DE VEHÍCULOS CON TARJETAS UNIFICADAS Y GALERÍAS DESLIZABLES */}
      {isFiltering ? (
        <CatalogSkeleton />
      ) : displayedVehicles.length > 0 ? (
        <div
          id="vitrina-grid"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7 animate-in fade-in duration-200"
        >
          {displayedVehicles.map((v) => (
            <UnifiedVehicleCard
              key={v.id}
              vehicle={v}
              isFavorite={favorites.includes(v.id)}
              onToggleFavorite={toggleFavorite}
              onOpenAppointmentModal={onOpenAppointmentModal}
            />
          ))}
        </div>
      ) : (
        /* Estado vacío prémium */
        <div className="rounded-2xl border border-line bg-surface p-8 sm:p-12 text-center max-w-xl mx-auto shadow-sm animate-in fade-in duration-300">
          <div className="mx-auto mb-4 grid size-16 place-items-center rounded-2xl bg-surface-2 text-muted border border-line">
            <Car className="size-8 text-accent" />
          </div>
          <h3 className="text-xl font-extrabold text-ink">
            No se encontraron vehículos
          </h3>
          <p className="mt-2 text-sm text-muted leading-relaxed">
            Ninguna unidad coincide con los filtros aplicados. Puedes restablecer los filtros para ver todo el inventario disponible de Stroker.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="btn btn-primary text-xs sm:text-sm font-bold shadow-sm inline-flex items-center gap-2 cursor-pointer"
            >
              <RotateCcw className="size-4" />
              <span>Restablecer todos los filtros</span>
            </button>
          </div>
        </div>
      )}

      {/* Drawer deslizable para Móvil */}
      <CatalogMobileFilterDrawer
        isOpen={filtersOpenMobile}
        onClose={() => setFiltersOpenMobile(false)}
        filters={filters}
        onFilterChange={onFilterChange}
        onResetFilters={handleReset}
        availableBrands={availableBrands}
        availableModels={availableModels}
        availableYears={availableYears}
        availableTransmissions={availableTransmissions}
        availableFuels={availableFuels}
        branches={branches}
        matchingCount={displayedVehicles.length}
      />
    </section>
  );
}
