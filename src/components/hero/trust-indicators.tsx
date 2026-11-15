import { CalendarCheck, FileCheck, Landmark, Store, Truck, AlertCircle } from "lucide-react";
import { BUSINESS, DEMO_INVENTORY } from "@/lib/business";

/** Solo beneficios que el negocio ofrece de forma comprobable; nada de inspecciones ni garantías sin respaldo. */
export function TrustIndicators() {
  const indicators = [
    {
      icon: Store,
      title: BUSINESS.showroom,
      desc: "Av. Jaime Guzmán 4050",
      detail: "Visita con hora coordinada",
    },
    {
      icon: CalendarCheck,
      title: "Test drive",
      desc: "Agenda desde cada ficha",
      detail: "Te confirmamos el horario",
    },
    {
      icon: FileCheck,
      title: "Documentación",
      desc: "Pide el CAV de la unidad",
      detail: "Antes de reservar o pagar",
    },
    {
      icon: Landmark,
      title: "Financiamiento",
      desc: "Simulación referencial",
      detail: "Sujeto a evaluación crediticia",
    },
    {
      icon: Truck,
      title: "Despachos a todo Chile",
      desc: "Cotiza costo y plazo",
      detail: "Coordinado por WhatsApp",
    },
  ];

  return (
    <div className="border-t border-white/10 bg-gradient-to-b from-zinc-950/80 to-zinc-950/95 py-8 sm:py-10">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-6">
          <span className="text-xs font-bold text-red-400">
            Cómo compras en Stroker
          </span>
          {DEMO_INVENTORY && (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-zinc-400">
              <AlertCircle className="size-3 text-amber-400" />
              <span>Inventario publicado de demostración</span>
            </span>
          )}
        </div>

        {/* Grid de 5 pilares de confianza */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
          {indicators.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="group relative rounded-xl border border-white/10 bg-white/[0.03] p-4.5 hover:bg-white/[0.06] hover:border-red-500/30 transition-all duration-200"
              >
                <div className="flex items-start gap-3.5">
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-red-600/10 border border-red-500/20 text-red-400 group-hover:scale-105 group-hover:bg-red-600/20 transition-all">
                    <Icon className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm text-white group-hover:text-red-300 transition-colors">
                      {item.title}
                    </h3>
                    <p className="mt-0.5 text-xs font-semibold text-zinc-300">
                      {item.desc}
                    </p>
                    <p className="mt-0.5 text-[11px] text-zinc-400">
                      {item.detail}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
