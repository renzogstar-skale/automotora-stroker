"use client";

import { MessageCircle, Calendar, Landmark, MapPin, Phone, ShieldCheck, CheckCircle, Clock } from "lucide-react";
import { clp } from "@/lib/format";
import { computeLoan } from "@/lib/loan";

interface VehicleStickyPanelProps {
  vehicleId: string;
  brand: string;
  model: string;
  year: number;
  price: number;
  status: string;
  waLink: string;
  branch: {
    id: string;
    name: string;
    comuna: string;
    address?: string;
    phone?: string;
    whatsapp?: string;
  };
}

export function VehicleStickyPanel({
  vehicleId,
  brand,
  model,
  year,
  price,
  status,
  waLink,
  branch,
}: VehicleStickyPanelProps) {
  const isReservado = status === "RESERVADO";
  const isVendido = status === "VENDIDO";
  const isDisponible = status === "DISPONIBLE" || (!isReservado && !isVendido);

  // Cuota referencial con 30% de pie a 36 meses
  const loanRef = computeLoan({
    price,
    down: Math.round(price * 0.3),
    tradeIn: 0,
    months: 36,
    annualRate: 17.4,
  });

  const scrollToAgenda = () => {
    const el = document.getElementById("agenda-visita-section") || document.getElementById("consulta-form");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  const scrollToFinance = () => {
    const el = document.getElementById("calculadora-financiamiento");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="lg:sticky lg:top-24 space-y-4">
      {/* Tarjeta Principal de Precio y Acciones */}
      <div className="card p-6 rounded-2xl border border-line bg-surface shadow-md space-y-5">
        {/* Estado de Disponibilidad */}
        <div className="flex items-center justify-between">
          {isDisponible && (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300/60 px-3 py-1 text-xs font-bold uppercase tracking-wider">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Disponible</span>
            </span>
          )}
          {isReservado && (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300/60 px-3 py-1 text-xs font-bold uppercase tracking-wider">
              <Clock className="size-3.5 text-amber-600" />
              <span>Reservado</span>
            </span>
          )}
          {isVendido && (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 border border-zinc-300 px-3 py-1 text-xs font-bold uppercase tracking-wider">
              <CheckCircle className="size-3.5" />
              <span>Vendido</span>
            </span>
          )}

          <span className="text-xs font-semibold text-muted">
            Stock Stroker
          </span>
        </div>

        {/* Precio Destacado */}
        <div>
          <div className="text-3xl sm:text-4xl font-black text-accent tabular-nums tracking-tight">
            {clp(price)}
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-muted">
            <span>Precio al contado o financiado</span>
            <span className="font-semibold text-ink">CLP sin cobros extra</span>
          </div>
          <div className="mt-2 text-xs font-medium text-ink bg-surface-2/60 rounded-lg p-2.5 flex items-center justify-between">
            <span className="text-muted">Cuota referencial desde:</span>
            <span className="font-extrabold text-accent tabular-nums">
              {clp(loanRef.cuota)} / mes
            </span>
          </div>
        </div>

        {/* Aviso si está reservado */}
        {isReservado && (
          <div className="rounded-xl border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200">
            Esta unidad está <b>reservada</b> y no admite nuevas reservas. Déjanos tu consulta y te avisamos si se libera, o revisa autos similares.
          </div>
        )}

        {/* 8. Botones de Acción Comercial */}
        <div className="space-y-2.5 pt-1">
          {/* Botón WhatsApp */}
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white h-12 text-sm font-bold shadow-md shadow-emerald-950/20 hover:shadow-emerald-900/40 transition-all duration-200 active:scale-[0.98] cursor-pointer"
          >
            <MessageCircle className="size-4.5" />
            <span>Consultar por WhatsApp</span>
          </a>

          {/* Botón Agendar Visita */}
          {!isReservado && (
            <button
              type="button"
              onClick={scrollToAgenda}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-accent hover:bg-accent/90 text-white h-11 text-sm font-bold shadow-sm transition-all duration-200 active:scale-[0.98] cursor-pointer"
            >
              <Calendar className="size-4" />
              <span>Agendar visita a sucursal</span>
            </button>
          )}

          {/* Botón Solicitar Financiamiento */}
          <button
            type="button"
            onClick={scrollToFinance}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-surface hover:bg-surface-2 text-ink h-11 text-sm font-semibold transition-all duration-200 cursor-pointer"
          >
            <Landmark className="size-4 text-accent" />
            <span>Solicitar financiamiento</span>
          </button>
        </div>

        {/* Sucursal asignada */}
        <div className="border-t border-line pt-4 space-y-2.5 text-xs">
          <div className="flex items-start gap-2 text-muted">
            <MapPin className="size-4 shrink-0 text-accent mt-0.5" />
            <div>
              <p className="font-bold text-ink">{branch.name}</p>
              <p className="text-muted">{branch.address || "Av. Jaime Guzmán 4050, Club Pádel Llacolén"}, {branch.comuna}</p>
              <div className="mt-1 flex items-center gap-3">
                <a
                  href="https://www.google.com/search?kgmid=%2Fg%2F11zd3t8786"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-accent hover:underline text-[11px]"
                >
                  <span>Ver ubicación</span>
                </a>
                <span className="text-muted/40">·</span>
                <a
                  href="tel:+56971325262"
                  className="font-semibold text-ink hover:text-accent transition-colors text-[11px]"
                >
                  Llamar
                </a>
              </div>
            </div>
          </div>
          {branch.phone && (
            <div className="flex items-center gap-2 text-muted pl-6">
              <Phone className="size-3.5 text-accent" />
              <a href={`tel:${branch.phone.replace(/\s/g, "")}`} className="font-semibold text-ink hover:text-accent transition-colors">
                {branch.phone}
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Tarjeta de Garantía y Confianza Stroker */}
      <div className="card p-5 rounded-2xl border border-line bg-surface space-y-3 text-xs">
        <h3 className="font-bold text-ink flex items-center gap-2">
          <ShieldCheck className="size-4 text-accent" />
          <span>Compromiso Automotora Stroker</span>
        </h3>
        <ul className="space-y-2 text-muted">
          <li className="flex items-center gap-2">
            <CheckCircle className="size-3.5 text-emerald-600 shrink-0" />
            <span>Revisión técnica de 120 puntos certificada</span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="size-3.5 text-emerald-600 shrink-0" />
            <span>Historial de dominio al día sin multas</span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="size-3.5 text-emerald-600 shrink-0" />
            <span>Transferencia notarial o digital inmediata</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
