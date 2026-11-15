import { ShieldCheck, FileCheck, Landmark, Store, Users, AlertCircle } from "lucide-react";

export function TrustIndicators() {
  const indicators = [
    {
      icon: ShieldCheck,
      title: "Revisión Técnica",
      desc: "120 puntos inspeccionados",
      detail: "Mecánica y seguridad al día",
    },
    {
      icon: FileCheck,
      title: "Documentación",
      desc: "Historial de dominio al día",
      detail: "Transferencia rápida y segura",
    },
    {
      icon: Landmark,
      title: "Financiamiento",
      desc: "Simulación de crédito",
      detail: "Cuotas fijas en pesos CLP",
    },
    {
      icon: Store,
      title: "Sucursales Físicas",
      desc: "Santiago y Viña del Mar",
      detail: "Exhibición y entrega presencial",
    },
    {
      icon: Users,
      title: "Atención Personalizada",
      desc: "Asesoría comercial experta",
      detail: "Test drive y tasación en sala",
    },
  ];

  return (
    <div className="border-t border-white/10 bg-gradient-to-b from-zinc-950/80 to-zinc-950/95 py-8 sm:py-10">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        {/* Etiqueta ilustrativa demo */}
        <div className="flex items-center justify-between flex-wrap gap-2 mb-6">
          <span className="text-[11px] font-bold tracking-wider uppercase text-red-500">
            Estándares Automotora Stroker
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-zinc-400">
            <AlertCircle className="size-3 text-amber-400" />
            <span>Beneficios comerciales ilustrativos para demostración</span>
          </span>
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
