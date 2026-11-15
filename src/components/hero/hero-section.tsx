"use client";

import { useState } from "react";
import {
  Car,
  Search,
  Sparkles,
  FilterX,
  MessageCircle,
} from "lucide-react";
import { waUrl } from "@/lib/business";
import type { DemoVehicle, DemoBranch, HeroFilterState } from "@/types/hero-demo";
import { HeroFeaturedCarousel } from "./hero-featured-carousel";

interface HeroSectionProps {
  vehicles: DemoVehicle[];
  branches: DemoBranch[];
  filters: HeroFilterState;
  onFilterChange: (newFilters: HeroFilterState) => void;
  onSearchSubmit: () => void;
  onResetFilters: () => void;
  onOpenAppointmentModal: (vehicleId?: string, branchId?: string) => void;
  featuredVehicle?: DemoVehicle;
  /** Título y bajada configurados en Sistema › Mi Web. */
  title: string;
  subtitle: string;
  heroImage?: string;
}

export function HeroSection({
  title,
  subtitle,
  heroImage,
  vehicles,
  filters,
  onFilterChange,
  onSearchSubmit,
  onResetFilters,
  onOpenAppointmentModal,
  featuredVehicle,
}: HeroSectionProps) {
  // Extraer listas únicas de marcas y años del inventario real
  const availableBrands = Array.from(new Set(vehicles.map((v) => v.brand))).sort();
  const availableYears = Array.from(new Set(vehicles.map((v) => v.year))).sort((a, b) => b - a);

  // Contadores del Hero con datos reales confirmados (Fase 9)
  const disponiblesCount = vehicles.filter((v) => v.status === "DISPONIBLE" && v.verificationStatus !== "POR_CONFIRMAR").length;
  const vendidosCount = vehicles.filter((v) => v.status === "VENDIDO").length;
  const marcasDisponiblesCount = new Set(
    vehicles
      .filter((v) => v.status === "DISPONIBLE" && v.verificationStatus !== "POR_CONFIRMAR")
      .map((v) => v.brand)
  ).size;

  // Rangos de precios estándar chilenos en CLP
  const priceMinOptions = [
    { label: "Precio mínimo", value: "" },
    { label: "$4.000.000", value: "4000000" },
    { label: "$6.000.000", value: "6000000" },
    { label: "$10.000.000", value: "10000000" },
    { label: "$15.000.000", value: "15000000" },
    { label: "$20.000.000", value: "20000000" },
    { label: "$30.000.000", value: "30000000" },
    { label: "$50.000.000", value: "50000000" },
  ];

  const priceMaxOptions = [
    { label: "Precio máximo", value: "" },
    { label: "Hasta $8.000.000", value: "8000000" },
    { label: "Hasta $12.000.000", value: "12000000" },
    { label: "Hasta $15.000.000", value: "15000000" },
    { label: "Hasta $25.000.000", value: "25000000" },
    { label: "Hasta $35.000.000", value: "35000000" },
    { label: "Hasta $50.000.000", value: "50000000" },
    { label: "Hasta $120.000.000", value: "120000000" },
  ];

  // Cálculo en tiempo real de vehículos coincidentes
  const matchingCount = vehicles.filter((v) => {
    if (filters.marca && v.brand !== filters.marca) return false;
    if (filters.sucursal && v.branchId !== filters.sucursal) return false;
    if (filters.anio && v.year !== parseInt(filters.anio, 10)) return false;
    if (filters.precioMin && v.price < parseInt(filters.precioMin, 10)) return false;
    if (filters.precioMax && v.price > parseInt(filters.precioMax, 10)) return false;
    if (filters.kmMax && v.km > parseInt(filters.kmMax, 10)) return false;
    if (filters.transmision && v.transmission.toLowerCase() !== filters.transmision.toLowerCase()) return false;
    return true;
  }).length;

  const handleFieldChange = (field: keyof HeroFilterState, value: string) => {
    onFilterChange({
      ...filters,
      [field]: value,
    });
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchSubmit();
  };

  const scrollToCatalog = () => {
    const el = document.getElementById("vitrina");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section className="relative overflow-hidden bg-zinc-950 text-white min-h-[660px] lg:min-h-[720px] flex flex-col justify-between">
      {/* Fondo cinematográfico con fotografía oficial de Automotora Stroker */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        {/* Imagen de fondo del héroe */}
        <img
          src={heroImage || "/brand/stroker-portada.jpg"}
          alt="Automotora Stroker Portada"
          fetchPriority="high"
          decoding="async"
          className="size-full object-cover object-center lg:object-[center_35%] scale-105 opacity-35 brightness-75 contrast-125"
        />

        {/* Gradientes cinematográficos multicapa para máxima legibilidad */}
        {/* Gradiente horizontal: oscuro a la izquierda para el texto, transparente a la derecha */}
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/85 to-zinc-950/40" />

        {/* Gradiente vertical: viñeta superior e inferior profunda */}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-zinc-950/70" />

        {/* Acento de iluminación rojo sutil institucional */}
        <div className="absolute -top-32 left-1/4 size-96 rounded-full bg-red-600/15 blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-32 right-10 size-96 rounded-full bg-red-800/15 blur-[120px] pointer-events-none" />
      </div>

      {/* Contenido principal del HERO */}
      <div className="relative mx-auto max-w-[1280px] w-full px-4 sm:px-6 lg:px-8 pt-10 sm:pt-14 pb-12 flex-1 flex flex-col justify-center">
        {/* Badges superiores con indicadores reales confirmados de inventario */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 mb-5">
          <div className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-600/15 px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur-md shadow-sm">
            <Sparkles className="size-3.5 text-red-400" />
            <span>Showroom Antofagasta · Despachos a todo Chile</span>
          </div>

          <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/40 px-3 py-1.5 text-xs font-bold text-emerald-300 backdrop-blur-md shadow-sm">
            <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{disponiblesCount} disponibles</span>
          </div>

          {vendidosCount > 0 && (
            <div className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-950/40 px-3 py-1.5 text-xs font-bold text-rose-300 backdrop-blur-md">
              <span className="size-2 rounded-full bg-rose-400" />
              <span>{vendidosCount} vendido{vendidosCount > 1 ? "s" : ""}</span>
            </div>
          )}

          <div className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-300 backdrop-blur-md">
            <span>{marcasDisponiblesCount} marcas disponibles</span>
          </div>
        </div>

        {/* Layout en dos columnas: Titular/Buscador a la izquierda, Ficha destacada a la derecha en escritorio */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          <div className="lg:col-span-8">
            {/* Título grande, elegante y contundente */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1] text-white">
              {title || "Special Cars for Special People"}
            </h1>

            {/* Traducción del lema */}
            <p className="mt-2.5 text-base sm:text-xl font-medium italic text-red-400 tracking-wide">
              Autos especiales para gente especial
            </p>

            <p className="mt-4 sm:mt-5 max-w-2xl text-base sm:text-lg text-zinc-300/90 leading-relaxed font-normal">
              {subtitle || "Compra, venta y consignación de autos, camionetas y motocicletas en Antofagasta. Conoce nuestro catálogo, consulta por financiamiento a medida y coordina el despacho a cualquier región de Chile."}
            </p>

            {/* BOTONES PRINCIPALES */}
            <div className="mt-7 sm:mt-8 flex flex-wrap items-center gap-3.5 sm:gap-4">
              {/* Botón 1: Explorar vehículos (Rojo Stroker) */}
              <button
                type="button"
                onClick={scrollToCatalog}
                className="inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 px-6 sm:px-7 h-12 text-sm sm:text-base font-bold text-white shadow-xl shadow-red-950/60 hover:shadow-red-800/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer"
              >
                <Car className="size-5" />
                <span>Explorar vehículos</span>
              </button>

              {/* Botón 2: Consultar por WhatsApp */}
              <a
                href={waUrl("Hola, quiero más información sobre el catálogo.")}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2.5 rounded-xl border border-emerald-500/40 bg-emerald-600/25 hover:bg-emerald-600/35 px-6 sm:px-7 h-12 text-sm sm:text-base font-semibold text-white backdrop-blur-md shadow-lg shadow-black/30 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer"
              >
                <MessageCircle className="size-5 text-emerald-400" />
                <span>Consultar por WhatsApp</span>
              </a>
            </div>
          </div>

          {/* Tarjeta carrusel automático de vehículos destacados */}
          <div className="w-full lg:col-span-4 mt-6 lg:mt-0">
            <HeroFeaturedCarousel
              vehicles={vehicles}
              featuredVehicle={featuredVehicle}
              onOpenAppointmentModal={onOpenAppointmentModal}
            />
          </div>
        </div>

        {/* 3. BUSCADOR INTELIGENTE */}
        <div className="mt-10 sm:mt-12">
          <form
            onSubmit={handleFormSubmit}
            className="rounded-2xl border border-white/15 bg-zinc-900/80 p-3 sm:p-4 backdrop-blur-xl shadow-2xl"
          >
            <div className="mb-2.5 flex items-center justify-between px-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Search className="size-3 text-red-500" /> Buscador Inteligente Stroker
              </span>
              <span className="text-[11px] font-semibold text-zinc-400">
                {matchingCount} {matchingCount === 1 ? "vehículo coincidente" : "vehículos disponibles"}
              </span>
            </div>

            {/* Selector Grid responsivo: 1 col (móvil), 2 cols (tablet), 5 cols (escritorio) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
              {/* Marca */}
              <div className="relative">
                <select
                  value={filters.marca}
                  onChange={(e) => handleFieldChange("marca", e.target.value)}
                  className="w-full h-11 min-h-[44px] appearance-none rounded-xl border border-white/15 bg-zinc-950/90 px-3.5 py-2.5 text-xs sm:text-sm text-white focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 transition-colors cursor-pointer"
                  aria-label="Filtrar por marca"
                >
                  <option value="">Todas las marcas</option>
                  {availableBrands.map((b) => (
                    <option key={b} value={b} className="bg-zinc-900 text-white">
                      {b}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-3 top-3.5 text-zinc-400 text-xs">
                  ▼
                </div>
              </div>

              {/* Rango de Precios: Mínimo y Máximo */}
              <div className="grid grid-cols-2 gap-1.5">
                <div className="relative">
                  <select
                    value={filters.precioMin}
                    onChange={(e) => handleFieldChange("precioMin", e.target.value)}
                    className="w-full h-11 min-h-[44px] appearance-none rounded-xl border border-white/15 bg-zinc-950/90 px-2.5 py-2.5 text-xs sm:text-sm text-white focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 transition-colors cursor-pointer"
                    aria-label="Precio mínimo"
                  >
                    {priceMinOptions.map((opt) => (
                      <option key={opt.value} value={opt.value} className="bg-zinc-900 text-white">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-2.5 top-3.5 text-zinc-400 text-xs">
                    ▼
                  </div>
                </div>

                <div className="relative">
                  <select
                    value={filters.precioMax}
                    onChange={(e) => handleFieldChange("precioMax", e.target.value)}
                    className="w-full h-11 min-h-[44px] appearance-none rounded-xl border border-white/15 bg-zinc-950/90 px-2.5 py-2.5 text-xs sm:text-sm text-white focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 transition-colors cursor-pointer"
                    aria-label="Precio máximo"
                  >
                    {priceMaxOptions.map((opt) => (
                      <option key={opt.value} value={opt.value} className="bg-zinc-900 text-white">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-2.5 top-3.5 text-zinc-400 text-xs">
                    ▼
                  </div>
                </div>
              </div>

              {/* Año */}
              <div className="relative">
                <select
                  value={filters.anio}
                  onChange={(e) => handleFieldChange("anio", e.target.value)}
                  className="w-full h-11 min-h-[44px] appearance-none rounded-xl border border-white/15 bg-zinc-950/90 px-3.5 py-2.5 text-xs sm:text-sm text-white focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 transition-colors cursor-pointer"
                  aria-label="Filtrar por año"
                >
                  <option value="">Todos los años</option>
                  {availableYears.map((y) => (
                    <option key={y} value={y.toString()} className="bg-zinc-900 text-white">
                      Año {y}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-3 top-3.5 text-zinc-400 text-xs">
                  ▼
                </div>
              </div>

              {/* Transmisión (las sucursales de la semilla no se exponen: la sede confirmada es Antofagasta) */}
              <div className="relative">
                <select
                  value={filters.transmision}
                  onChange={(e) => handleFieldChange("transmision", e.target.value)}
                  className="w-full h-11 min-h-[44px] appearance-none rounded-xl border border-white/15 bg-zinc-950/90 px-3.5 py-2.5 text-xs sm:text-sm text-white focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 transition-colors cursor-pointer"
                  aria-label="Filtrar por transmisión"
                >
                  <option value="">Toda transmisión</option>
                  {[...new Set(vehicles.map((v) => v.transmission))].sort().map((t) => (
                    <option key={t} value={t} className="bg-zinc-900 text-white">
                      {t}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-3 top-3.5 text-zinc-400 text-xs">
                  ▼
                </div>
              </div>

              {/* Botón Buscar vehículos */}
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 px-4 h-11 min-h-[44px] text-xs sm:text-sm font-bold text-white shadow-lg shadow-red-950/50 hover:shadow-red-800/40 transition-all duration-200 active:scale-[0.98] cursor-pointer"
                >
                  <Search className="size-4 shrink-0" />
                  <span>Buscar vehículos</span>
                </button>

                {(filters.marca || filters.precioMin || filters.precioMax || filters.anio || filters.sucursal || filters.kmMax || filters.transmision) && (
                  <button
                    type="button"
                    onClick={onResetFilters}
                    className="grid size-11 min-h-[44px] min-w-[44px] place-items-center rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-colors cursor-pointer shrink-0"
                    title="Limpiar filtros"
                    aria-label="Limpiar filtros"
                  >
                    <FilterX className="size-4" />
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
