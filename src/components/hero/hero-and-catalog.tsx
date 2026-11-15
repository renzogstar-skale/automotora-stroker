"use client";

import { useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { HeroSection } from "./hero-section";
import { TrustIndicators } from "./trust-indicators";
import { DemoCatalogShowcase } from "./demo-catalog-showcase";
import { DemoAppointmentModal } from "./demo-appointment-modal";
import { BranchesSection } from "@/components/branches/branches-section";
import { FloatingWhatsApp } from "@/components/ui/floating-whatsapp";
import type { DemoVehicle, DemoBranch, HeroFilterState } from "@/types/hero-demo";

interface HeroAndCatalogProps {
  initialVehicles: DemoVehicle[];
  branches: DemoBranch[];
  heroTitle: string;
  heroSubtitle: string;
}

const DEFAULT_FILTERS: HeroFilterState = {
  marca: "",
  precioMin: "",
  precioMax: "",
  anio: "",
  kmMax: "",
  transmision: "",
  sucursal: "",
  orden: "destacados",
};

export function HeroAndCatalog({ initialVehicles, branches, heroTitle, heroSubtitle }: HeroAndCatalogProps) {
  // Filtros iniciales desde la URL (enlaces compartidos); la página es dinámica, así servidor y cliente coinciden.
  const params = useSearchParams();
  const [filters, setFilters] = useState<HeroFilterState>(() => ({
    marca: params.get("marca") || "", precioMin: params.get("precioMin") || "", precioMax: params.get("precioMax") || "",
    anio: params.get("anio") || "", kmMax: params.get("kmMax") || "", transmision: params.get("transmision") || "",
    sucursal: params.get("sucursal") || "", orden: (params.get("orden") as HeroFilterState["orden"]) || "destacados",
  }));
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [selectedVehicleForModal, setSelectedVehicleForModal] = useState<string | undefined>();
  const [selectedBranchForModal, setSelectedBranchForModal] = useState<string | undefined>();

  // Filtrado y ordenamiento reactivo sobre el inventario DEMO existente
  const filteredAndSortedVehicles = useMemo(() => {
    // 1. Filtrado
    const list = initialVehicles.filter((v) => {
      if (filters.marca && v.brand !== filters.marca) {
        return false;
      }
      if (filters.sucursal && v.branchId !== filters.sucursal) {
        return false;
      }
      if (filters.anio && v.year !== parseInt(filters.anio, 10)) {
        return false;
      }
      if (filters.transmision && v.transmission.toLowerCase() !== filters.transmision.toLowerCase()) {
        return false;
      }
      if (filters.precioMin && v.price < parseInt(filters.precioMin, 10)) {
        return false;
      }
      if (filters.precioMax && v.price > parseInt(filters.precioMax, 10)) {
        return false;
      }
      if (filters.kmMax && v.km > parseInt(filters.kmMax, 10)) {
        return false;
      }
      return true;
    });

    // 2. Ordenamiento por precio, año o kilometraje
    return [...list].sort((a, b) => {
      switch (filters.orden) {
        case "precio-asc":
          return a.price - b.price;
        case "precio-desc":
          return b.price - a.price;
        case "anio-desc":
          return b.year - a.year;
        case "anio-asc":
          return a.year - b.year;
        case "km-asc":
          return a.km - b.km;
        case "destacados":
        default:
          if (a.featured && !b.featured) return -1;
          if (!a.featured && b.featured) return 1;
          return 0;
      }
    });
  }, [initialVehicles, filters]);

  // Selección de vehículo protagonista para el Hero
  const featuredVehicle = useMemo(() => {
    return initialVehicles.find((v) => v.featured) || initialVehicles[0];
  }, [initialVehicles]);

  const handleFilterChange = (newFilters: HeroFilterState) => {
    setFilters(newFilters);
  };

  const handleSearchSubmit = () => {
    const el = document.getElementById("vitrina");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleResetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    if (typeof window !== "undefined" && window.location.search) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  };

  const handleOpenAppointmentModal = (vehicleId?: string, branchId?: string) => {
    setSelectedVehicleForModal(vehicleId);
    setSelectedBranchForModal(branchId);
    setIsAppointmentModalOpen(true);
  };

  const handleCloseAppointmentModal = () => {
    setIsAppointmentModalOpen(false);
  };

  const handleSelectBranchFilter = (branchId: string) => {
    setFilters((prev) => ({
      ...prev,
      sucursal: branchId,
    }));
    const el = document.getElementById("vitrina");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <>
      {/* 1. Hero Section Premium con Buscador Inteligente y Fotografía Protagonista */}
      <HeroSection
        title={heroTitle}
        subtitle={heroSubtitle}
        vehicles={initialVehicles}
        branches={branches}
        filters={filters}
        onFilterChange={handleFilterChange}
        onSearchSubmit={handleSearchSubmit}
        onResetFilters={handleResetFilters}
        onOpenAppointmentModal={handleOpenAppointmentModal}
        featuredVehicle={featuredVehicle}
      />

      {/* 4. Indicadores de Confianza Comerciales (Con identificación DEMO) */}
      <TrustIndicators />

      {/* Vitrina de Vehículos Conectada con Filtros y Ordenamiento Premium */}
      <DemoCatalogShowcase
        vehicles={filteredAndSortedVehicles}
        allVehicles={initialVehicles}
        branches={branches}
        filters={filters}
        onFilterChange={handleFilterChange}
        onResetFilters={handleResetFilters}
        onOpenAppointmentModal={handleOpenAppointmentModal}
      />

      {/* Modernización de la Sección Nuestras Sucursales y Confianza Comercial */}
      <BranchesSection
        branches={branches}
        vehicles={initialVehicles}
        onSelectBranchFilter={handleSelectBranchFilter}
        onOpenAppointmentModal={(branchId) => handleOpenAppointmentModal(undefined, branchId)}
      />

      {/* 2. Modal de Agendamiento DEMO Interactivo con Confirmación */}
      {isAppointmentModalOpen && (
        <DemoAppointmentModal
          onClose={handleCloseAppointmentModal}
          vehicles={initialVehicles}
          branches={branches}
          initialVehicleId={selectedVehicleForModal}
          initialBranchId={selectedBranchForModal}
        />
      )}
      {/* Botón Flotante de WhatsApp para la vitrina comercial */}
      <FloatingWhatsApp />
    </>
  );
}
