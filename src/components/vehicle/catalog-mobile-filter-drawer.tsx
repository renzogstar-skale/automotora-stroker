"use client";

import { useEffect } from "react";
import { X, RotateCcw, Check, SlidersHorizontal } from "lucide-react";
import type { HeroFilterState, DemoBranch } from "@/types/hero-demo";

interface CatalogMobileFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  filters: HeroFilterState;
  onFilterChange: (newFilters: HeroFilterState) => void;
  onResetFilters: () => void;
  availableBrands: string[];
  availableModels: string[];
  availableYears: number[];
  availableTransmissions: string[];
  availableFuels: string[];
  branches?: DemoBranch[];
  matchingCount: number;
}

export function CatalogMobileFilterDrawer({
  isOpen,
  onClose,
  filters,
  onFilterChange,
  onResetFilters,
  availableBrands,
  availableModels,
  availableYears,
  availableTransmissions,
  availableFuels,
  branches = [],
  matchingCount,
}: CatalogMobileFilterDrawerProps) {
  // Bloquear scroll de fondo mientras el panel esté abierto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Cerrar con Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleFieldChange = (field: keyof HeroFilterState, value: string) => {
    onFilterChange({
      ...filters,
      [field]: value,
    });
  };

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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Filtros de búsqueda"
      className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-end"
    >
      {/* Fondo oscurecido con desenfoque */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Contenedor del panel modal deslizable desde abajo / derecha */}
      <div className="relative w-full max-h-[85vh] sm:max-w-md sm:ml-auto bg-surface text-ink shadow-2xl rounded-t-3xl sm:rounded-t-none sm:rounded-l-3xl flex flex-col z-10 animate-in slide-in-from-bottom duration-250 ease-out border-t sm:border-t-0 sm:border-l border-line pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
        {/* Drag handle visual para móvil */}
        <div className="py-2.5 flex justify-center shrink-0 sm:hidden">
          <div className="h-1.5 w-12 rounded-full bg-zinc-300 dark:bg-zinc-700" />
        </div>

        {/* Cabecera del panel */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-line bg-surface-2/40">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-accent" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-ink">
              Filtros de Búsqueda
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar filtros"
            className="grid size-11 min-h-[44px] min-w-[44px] place-items-center rounded-xl bg-surface-2 text-muted hover:text-ink transition-colors cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Formulario de filtros scrolleable */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Marca */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">
              Marca
            </label>
            <select
              value={filters.marca}
              onChange={(e) => handleFieldChange("marca", e.target.value)}
              className="w-full h-11 min-h-[44px] rounded-xl border border-line bg-surface px-3 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors"
            >
              <option value="">Todas las marcas</option>
              {availableBrands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          {/* Modelo */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">
              Modelo
            </label>
            <select
              value={filters.modelo || ""}
              onChange={(e) => handleFieldChange("modelo", e.target.value)}
              className="w-full h-11 min-h-[44px] rounded-xl border border-line bg-surface px-3 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors"
            >
              <option value="">Todos los modelos</option>
              {availableModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Sucursal móvil */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">
              Sucursal
            </label>
            <select
              value={filters.sucursal || ""}
              onChange={(e) => handleFieldChange("sucursal", e.target.value)}
              aria-label="Filtrar por sucursal móvil"
              className="w-full h-11 min-h-[44px] rounded-xl border border-line bg-surface px-3 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors"
            >
              <option value="">Todas las sucursales</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Precio Máximo */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">
              Presupuesto Máximo
            </label>
            <select
              value={filters.precioMax}
              onChange={(e) => handleFieldChange("precioMax", e.target.value)}
              className="w-full h-11 min-h-[44px] rounded-xl border border-line bg-surface px-3 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors"
            >
              {priceMaxOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Año */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">
              Año del Vehículo
            </label>
            <select
              value={filters.anio}
              onChange={(e) => handleFieldChange("anio", e.target.value)}
              className="w-full h-11 min-h-[44px] rounded-xl border border-line bg-surface px-3 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors"
            >
              <option value="">Cualquier año</option>
              {availableYears.map((y) => (
                <option key={y} value={y.toString()}>
                  Año {y}
                </option>
              ))}
            </select>
          </div>

          {/* Kilometraje Máximo */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">
              Kilometraje
            </label>
            <select
              value={filters.kmMax || ""}
              onChange={(e) => handleFieldChange("kmMax", e.target.value)}
              className="w-full h-11 min-h-[44px] rounded-xl border border-line bg-surface px-3 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors"
            >
              {kmOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Transmisión */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">
              Transmisión
            </label>
            <select
              value={filters.transmision || ""}
              onChange={(e) => handleFieldChange("transmision", e.target.value)}
              className="w-full h-11 min-h-[44px] rounded-xl border border-line bg-surface px-3 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors"
            >
              <option value="">Todas las cajas</option>
              {availableTransmissions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Combustible */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">
              Combustible
            </label>
            <select
              value={filters.combustible || ""}
              onChange={(e) => handleFieldChange("combustible", e.target.value)}
              className="w-full h-11 min-h-[44px] rounded-xl border border-line bg-surface px-3 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors"
            >
              <option value="">Cualquier combustible</option>
              {availableFuels.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          {/* Ordenar por */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">
              Ordenar Resultados
            </label>
            <select
              value={filters.orden || "destacados"}
              onChange={(e) => handleFieldChange("orden", e.target.value)}
              className="w-full h-11 min-h-[44px] rounded-xl border border-line bg-surface px-3 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors"
            >
              <option value="destacados">Destacados</option>
              <option value="recientes">Más recientes</option>
              <option value="precio-asc">Menor precio</option>
              <option value="precio-desc">Mayor precio</option>
              <option value="km-asc">Menor kilometraje</option>
              <option value="anio-desc">Año: más nuevo</option>
              <option value="anio-asc">Año: más antiguo</option>
            </select>
          </div>
        </div>

        {/* Pie fijo de acciones del panel */}
        <div className="p-4 border-t border-line bg-surface-2/60 flex items-center gap-3">
          <button
            type="button"
            onClick={onResetFilters}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-line bg-surface hover:bg-surface-2 px-4 h-12 text-sm font-semibold text-muted hover:text-ink transition-colors cursor-pointer"
          >
            <RotateCcw className="size-4" />
            <span>Limpiar</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-accent hover:bg-red-700 text-white font-bold h-12 text-sm shadow-md shadow-accent/25 transition-all cursor-pointer"
          >
            <Check className="size-4" />
            <span>Ver {matchingCount} resultado{matchingCount === 1 ? "" : "s"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
