"use client";

import Link from "next/link";
import {
  MapPin,
  Clock,
  Phone,
  MessageCircle,
  Navigation,
  Car,
  Calendar,
  Building2,
  ShieldCheck,
  FileCheck2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Truck,
  Landmark,
  BadgeCheck,
  ArrowRight,
} from "lucide-react";
import type { DemoBranch, DemoVehicle } from "@/types/hero-demo";

interface BranchesSectionProps {
  branches: DemoBranch[];
  vehicles: DemoVehicle[];
  onSelectBranchFilter: (branchId: string) => void;
  onOpenAppointmentModal: (branchId: string) => void;
}

export function BranchesSection({
  branches,
  vehicles,
  onSelectBranchFilter,
  onOpenAppointmentModal,
}: BranchesSectionProps) {
  const googleMapsUrl = "https://www.google.com/search?kgmid=%2Fg%2F11zd3t8786";
  const whatsAppUrl = "https://wa.me/56971325262";
  const phoneUrl = "tel:+56971325262";

  return (
    <section id="sucursales" className="py-16 sm:py-24 border-t border-line bg-surface-2/30 scroll-mt-20">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 space-y-20">
        
        {/* ========================================================= */}
        {/* SECCIÓN: SOBRE NOSOTROS                                    */}
        {/* ========================================================= */}
        <div id="nosotros" className="scroll-mt-24 rounded-3xl border border-line bg-surface p-6 sm:p-10 lg:p-12 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-8 -mr-8 size-64 bg-accent/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-xl bg-accent/10 px-3 py-1 text-xs font-bold text-accent uppercase tracking-wider mb-3">
              <Sparkles className="size-3.5" />
              <span>Automotora Stroker · Antofagasta</span>
            </div>
            
            <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-ink">
              Sobre nosotros
            </h2>
            
            <p className="mt-4 text-base sm:text-lg text-ink/90 leading-relaxed font-normal">
              En <strong className="font-bold text-ink">Automotora Stroker</strong> nos dedicamos a la compra, venta y consignación de autos, camionetas y motocicletas. Si estás buscando tu próximo vehículo o quieres vender el que ya tienes, contáctanos para conocer las opciones disponibles. Atendemos en Antofagasta y coordinamos despachos a todo Chile.
            </p>

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-line">
              <div className="rounded-2xl border border-line bg-surface-2/50 p-4">
                <Car className="size-6 text-accent mb-2" />
                <h4 className="font-bold text-sm text-ink">Catálogo Multimarca</h4>
                <p className="text-xs text-muted mt-1">Autos, camionetas y motocicletas inspeccionados y listos para transferir.</p>
              </div>

              <div className="rounded-2xl border border-line bg-surface-2/50 p-4">
                <MapPin className="size-6 text-accent mb-2" />
                <h4 className="font-bold text-sm text-ink">Showroom Antofagasta</h4>
                <p className="text-xs text-muted mt-1">Ubicados en Av. Jaime Guzmán 4050, Club Pádel Llacolén.</p>
              </div>

              <div className="rounded-2xl border border-line bg-surface-2/50 p-4">
                <Truck className="size-6 text-accent mb-2" />
                <h4 className="font-bold text-sm text-ink">Despachos a Todo Chile</h4>
                <p className="text-xs text-muted mt-1">Logística y entrega segura coordinada hasta tu comuna.</p>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* SECCIÓN: SERVICIOS                                         */}
        {/* ========================================================= */}
        <div id="servicios" className="scroll-mt-24">
          <div className="max-w-2xl mb-10">
            <span className="text-xs font-bold uppercase tracking-wider text-accent">
              Nuestras Soluciones
            </span>
            <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-ink mt-1">
              Servicios
            </h2>
            <p className="text-sm sm:text-base text-muted mt-2 leading-relaxed">
              Acompañamiento transparente y profesional en cada etapa de tu operación vehicular.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Servicio 1: Compra y venta */}
            <div className="card card-hover rounded-2xl border border-line bg-surface p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="grid size-12 place-items-center rounded-xl bg-red-600/10 text-red-600 mb-4">
                  <Car className="size-6" />
                </div>
                <h3 className="text-lg font-bold text-ink">
                  Compra y venta de vehículos
                </h3>
                <p className="mt-2 text-xs sm:text-sm text-muted leading-relaxed">
                  Explora el catálogo o consulta por la compra de tu auto, camioneta o motocicleta.
                </p>
              </div>
              <div className="pt-5 mt-4 border-t border-line">
                <a
                  href="#vitrina"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-accent hover:text-accent/80 transition-colors"
                >
                  <span>Explorar catálogo</span>
                  <ArrowRight className="size-3.5" />
                </a>
              </div>
            </div>

            {/* Servicio 2: Consignación */}
            <div className="card card-hover rounded-2xl border border-line bg-surface p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="grid size-12 place-items-center rounded-xl bg-amber-500/10 text-amber-600 mb-4">
                  <BadgeCheck className="size-6" />
                </div>
                <h3 className="text-lg font-bold text-ink">
                  Consignación
                </h3>
                <p className="mt-2 text-xs sm:text-sm text-muted leading-relaxed">
                  Consúltanos cómo vender tu vehículo a través de Automotora Stroker.
                </p>
              </div>
              <div className="pt-5 mt-4 border-t border-line">
                <a
                  href={whatsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-500 transition-colors"
                >
                  <MessageCircle className="size-3.5" />
                  <span>Consultar consignación</span>
                </a>
              </div>
            </div>

            {/* Servicio 3: Financiamiento a medida */}
            <div className="card card-hover rounded-2xl border border-line bg-surface p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="grid size-12 place-items-center rounded-xl bg-blue-500/10 text-blue-600 mb-4">
                  <Landmark className="size-6" />
                </div>
                <h3 className="text-lg font-bold text-ink">
                  Financiamiento a medida
                </h3>
                <p className="mt-2 text-xs sm:text-sm text-muted leading-relaxed">
                  Pregunta por las alternativas de financiamiento y las opciones de crédito express, sujetas a evaluación.
                </p>
              </div>
              <div className="pt-5 mt-4 border-t border-line">
                <a
                  href={whatsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-accent hover:text-accent/80 transition-colors"
                >
                  <MessageCircle className="size-3.5" />
                  <span>Evaluar financiamiento</span>
                </a>
              </div>
            </div>

            {/* Servicio 4: Despachos a todo Chile */}
            <div className="card card-hover rounded-2xl border border-line bg-surface p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="grid size-12 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 mb-4">
                  <Truck className="size-6" />
                </div>
                <h3 className="text-lg font-bold text-ink">
                  Despachos a todo Chile
                </h3>
                <p className="mt-2 text-xs sm:text-sm text-muted leading-relaxed">
                  Consulta el costo, el plazo y la disponibilidad de entrega para tu comuna.
                </p>
              </div>
              <div className="pt-5 mt-4 border-t border-line">
                <a
                  href={whatsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-500 transition-colors"
                >
                  <MessageCircle className="size-3.5" />
                  <span>Cotizar despacho</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* SECCIÓN: CONTACTO Y UBICACIÓN                              */}
        {/* ========================================================= */}
        <div id="contacto" className="scroll-mt-24">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-accent">
                  Atención Directa y Showroom
                </span>
                <span className="rounded-full bg-emerald-500/10 text-emerald-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                  Antofagasta, Chile
                </span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-ink mt-1.5">
                Contacto
              </h2>
              <p className="text-sm sm:text-base text-muted mt-1 max-w-2xl leading-relaxed">
                Visítanos en nuestro showroom o contáctanos por teléfono y WhatsApp para una atención inmediata.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs font-medium text-muted bg-surface border border-line rounded-xl px-3.5 py-2">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Horario Continuo · Lunes a Sábado</span>
            </div>
          </div>

          {/* Tarjeta Principal de Contacto */}
          <div className="rounded-3xl border border-line bg-surface p-6 sm:p-10 shadow-lg">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              
              {/* Información y Datos de Contacto */}
              <div className="lg:col-span-7 space-y-6">
                <div>
                  <h3 className="text-xl sm:text-2xl font-black text-ink">
                    Automotora Stroker
                  </h3>
                  <p className="text-xs text-muted font-medium mt-1">
                    Special Cars for Special People · Autos especiales para gente especial
                  </p>
                </div>

                <div className="space-y-4 pt-2">
                  {/* Dirección */}
                  <div className="flex items-start gap-3.5">
                    <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent/10 text-accent">
                      <MapPin className="size-5" />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">
                        Dirección
                      </span>
                      <p className="font-extrabold text-ink text-base sm:text-lg mt-0.5">
                        Av. Jaime Guzmán 4050, Club Pádel Llacolén, Antofagasta, Chile.
                      </p>
                    </div>
                  </div>

                  {/* Teléfono y WhatsApp */}
                  <div className="flex items-start gap-3.5 border-t border-line pt-4">
                    <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600">
                      <Phone className="size-5" />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">
                        Teléfono y WhatsApp
                      </span>
                      <p className="font-extrabold text-ink text-base sm:text-lg mt-0.5">
                        +56 9 7132 5262
                      </p>
                      <p className="text-xs text-muted mt-0.5">
                        Atención comercial, cotizaciones, consignaciones y financiamiento.
                      </p>
                    </div>
                  </div>

                  {/* Horarios */}
                  <div className="flex items-start gap-3.5 border-t border-line pt-4">
                    <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-zinc-500/10 text-zinc-600 dark:text-zinc-300">
                      <Clock className="size-5" />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">
                        Horarios de Atención
                      </span>
                      <p className="text-sm font-bold text-ink mt-0.5">
                        Lunes a Viernes: 09:30 – 19:00 hrs · Sábados: 10:00 – 14:00 hrs
                      </p>
                      <p className="text-xs text-muted mt-0.5">
                        Domingos y Festivos: Cerrado
                      </p>
                    </div>
                  </div>
                </div>

                {/* BOTONES PRINCIPALES DE CONTACTO EXIGIDOS */}
                <div className="pt-4 flex flex-wrap items-center gap-3">
                  {/* Botón 1: Llamar */}
                  <a
                    href={phoneUrl}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent hover:bg-accent/90 text-white px-5 sm:px-6 h-12 text-sm font-bold shadow-md shadow-accent/20 transition-all duration-200 active:scale-95 cursor-pointer"
                  >
                    <Phone className="size-4" />
                    <span>Llamar</span>
                  </a>

                  {/* Botón 2: WhatsApp */}
                  <a
                    href={whatsAppUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-5 sm:px-6 h-12 text-sm font-bold shadow-md shadow-emerald-950/20 transition-all duration-200 active:scale-95 cursor-pointer"
                  >
                    <MessageCircle className="size-4.5" />
                    <span>WhatsApp</span>
                  </a>

                  {/* Botón 3: Ver ubicación */}
                  <a
                    href={googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-surface hover:bg-surface-2 text-ink px-5 sm:px-6 h-12 text-sm font-semibold transition-all duration-200 active:scale-95 cursor-pointer shadow-sm"
                  >
                    <Navigation className="size-4 text-accent" />
                    <span>Ver ubicación</span>
                    <ExternalLink className="size-3 text-muted" />
                  </a>
                </div>
              </div>

              {/* Tarjeta Visual de Ficha de Ubicación */}
              <div className="lg:col-span-5">
                <div className="rounded-2xl border border-line bg-gradient-to-br from-zinc-950 to-zinc-900 text-white p-6 sm:p-7 shadow-xl space-y-5">
                  <div className="flex items-center justify-between">
                    <span className="rounded-lg bg-red-600/20 border border-red-500/30 px-2.5 py-1 text-[11px] font-bold text-red-300">
                      Ficha Oficial Google
                    </span>
                    <span className="text-xs text-zinc-400">Antofagasta, Chile</span>
                  </div>

                  <div>
                    <h4 className="text-lg sm:text-xl font-bold text-white">
                      Club Pádel Llacolén
                    </h4>
                    <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                      Av. Jaime Guzmán 4050, Antofagasta
                    </p>
                    <p className="text-xs text-zinc-400 mt-2">
                      Acceso expedito, estacionamiento para clientes y exhibición de vehículos en entorno deportivo y seguro.
                    </p>
                  </div>

                  <div className="pt-2 border-t border-white/10 space-y-2.5">
                    <a
                      href={googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white hover:bg-zinc-100 text-zinc-950 h-11 text-xs sm:text-sm font-bold transition-all shadow-md active:scale-95"
                    >
                      <MapPin className="size-4 text-red-600" />
                      <span>Abrir ficha en Google Search</span>
                      <ExternalLink className="size-3.5 text-zinc-600" />
                    </a>

                    <a
                      href={whatsAppUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 text-white h-11 text-xs sm:text-sm font-semibold transition-all"
                    >
                      <MessageCircle className="size-4 text-emerald-400" />
                      <span>Coordinar visita al showroom</span>
                    </a>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* SECCIÓN: PILARES COMERCIALES Y DE SEGURIDAD                */}
        {/* ========================================================= */}
        <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6 border-b border-line pb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-accent">
                Transparencia y Garantía Stroker
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-ink mt-0.5">
                Pilares Comerciales y de Seguridad
              </h3>
            </div>

            <div className="inline-flex items-center gap-1.5 rounded-lg bg-surface-2 border border-line px-3 py-1.5 text-xs font-medium text-muted">
              <ShieldCheck className="size-4 text-accent" />
              <span>Estándar Operativo Verificado</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Pilar 1: Revisión Técnica */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-bold text-ink">
                <CheckCircle2 className="size-4.5 text-emerald-600 shrink-0" />
                <span>Revisión Técnica 120 Puntos</span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Inspección mecánica y computarizada exhaustiva antes de su exhibición: frenos, motor, dirección y tren delantero.
              </p>
            </div>

            {/* Pilar 2: Documentación */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-bold text-ink">
                <FileCheck2 className="size-4.5 text-emerald-600 shrink-0" />
                <span>Documentación Verificada</span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Validación de Certificado de Anotaciones Vigentes (CAV) en Registro Civil. Sin prendas, órdenes judiciales ni multas de tránsito impagas.
              </p>
            </div>

            {/* Pilar 3: Garantías Reales */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-bold text-ink">
                <ShieldCheck className="size-4.5 text-emerald-600 shrink-0" />
                <span>Garantía Legal Ley 19.496</span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Garantía legal de 3 meses en motor y transmisión para unidades seminuevas adquiridas en sala de ventas, respaldada por contrato.
              </p>
            </div>

            {/* Pilar 4: Política de Testimonios */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-bold text-ink">
                <AlertCircle className="size-4.5 text-amber-500 shrink-0" />
                <span>Testimonios Verificables</span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                No inventamos opiniones ni valoraciones comerciales simuladas. Las encuestas de satisfacción se recogen exclusivamente de compradores reales tras la firma en notaría.
              </p>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
