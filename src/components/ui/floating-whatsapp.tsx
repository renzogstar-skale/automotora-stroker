"use client";

import { MessageCircle } from "lucide-react";

interface FloatingWhatsAppProps {
  phoneNumber?: string;
  message?: string;
  vehicleId?: string;
  branchId?: string;
  className?: string;
}

export function FloatingWhatsApp({
  phoneNumber = "+56971325262",
  message = "Hola Automotora Stroker, me gustaría consultar por los vehículos disponibles.",
  vehicleId,
  branchId,
  className = "",
}: FloatingWhatsAppProps) {
  // Enlace directo al endpoint de redirección o API oficial
  const url = vehicleId
    ? `/api/web/wa?v=${vehicleId}`
    : `/api/web/wa?text=${encodeURIComponent(message)}`;

  return (
    <aside
      aria-label="Atención al cliente por WhatsApp"
      className={`fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))] right-[calc(1.25rem+env(safe-area-inset-right,0px))] z-40 ${className}`}
    >
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Contactar a Automotora Stroker por WhatsApp"
        className="group relative flex items-center gap-2.5 rounded-full bg-[#25D366] hover:bg-[#20ba5a] text-white p-3 sm:px-4 sm:py-3 shadow-xl shadow-emerald-950/40 hover:shadow-2xl hover:shadow-emerald-900/50 hover:scale-105 active:scale-95 transition-all duration-200 min-h-[48px] min-w-[48px] cursor-pointer"
      >
        {/* Indicador de pulso activo */}
        <span className="absolute -top-1 -right-1 flex size-3.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
          <span className="relative inline-flex size-3.5 rounded-full bg-emerald-400 border-2 border-white" />
        </span>

        {/* Icono de WhatsApp */}
        <MessageCircle className="size-6 text-white shrink-0 fill-white/20" />

        {/* Texto en pantallas medianas y grandes */}
        <span className="hidden sm:inline-block text-xs font-extrabold tracking-tight whitespace-nowrap text-white">
          ¿Consultas? Escríbenos
        </span>
      </a>
    </aside>
  );
}
