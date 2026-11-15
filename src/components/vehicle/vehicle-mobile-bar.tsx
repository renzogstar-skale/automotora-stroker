"use client";

import { MessageCircle, Calendar } from "lucide-react";
import { clp } from "@/lib/format";

interface VehicleMobileBarProps {
  price: number;
  waLink: string;
  isReservado: boolean;
}

export function VehicleMobileBar({ price, waLink, isReservado }: VehicleMobileBarProps) {
  const scrollToContact = () => {
    const el = document.getElementById("consulta-form") || document.getElementById("agenda-visita-section");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 bg-zinc-950/95 backdrop-blur-md border-t border-white/15 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:hidden shadow-2xl">
      <div className="flex items-center justify-between gap-3 max-w-md mx-auto">
        {/* Precio resumido */}
        <div className="min-w-0">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            {isReservado ? "Reservado" : "Precio al contado"}
          </span>
          <span className="text-xl font-black text-white tabular-nums tracking-tight">
            {clp(price)}
          </span>
        </div>

        {/* Botones de acción móvil (con áreas táctiles ≥44px) */}
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 min-h-[44px] text-xs font-bold shadow-md shadow-emerald-950/50 transition-colors active:scale-95 cursor-pointer"
          >
            <MessageCircle className="size-4" />
            <span>WhatsApp</span>
          </a>

          {!isReservado ? (
            <button
              type="button"
              onClick={scrollToContact}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white px-3.5 min-h-[44px] text-xs font-bold shadow-md transition-colors active:scale-95 cursor-pointer"
            >
              <Calendar className="size-4" />
              <span>Agendar</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={scrollToContact}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/20 bg-white/10 text-white px-3.5 min-h-[44px] text-xs font-semibold active:scale-95 cursor-pointer"
            >
              <span>Consultar</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
