export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2 bg-bg text-ink">
      {/* Columna Izquierda con Hero Visual */}
      <div className="relative hidden bg-graphite lg:block overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/demo/hero.jpg"
          alt="Automotora Stroker"
          className="absolute inset-0 size-full object-cover opacity-40 transition-transform duration-700 hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
        
        <div className="absolute top-10 left-10 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-accent font-extrabold text-white shadow-md">
            S
          </span>
          <span className="text-xl font-bold tracking-tight text-white">Automotora Stroker</span>
        </div>

        <div className="absolute bottom-12 left-10 right-10 text-white">
          <div className="inline-block rounded-lg bg-accent/30 px-3 py-1 text-xs font-semibold text-red-200 mb-3 backdrop-blur-sm">
            Plataforma Automotriz Privada
          </div>
          <p className="text-3xl font-extrabold tracking-tight">Stroker Gestión</p>
          <p className="mt-2 max-w-md text-sm text-white/80 leading-relaxed">
            Gestión interna: CRM de leads, inventario, tasaciones, contratos y control financiero en moneda chilena.
          </p>
        </div>
      </div>

      {/* Columna Derecha con Formulario */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md card p-6 sm:p-8 rounded-2xl shadow-lg border-line">
          <div className="mb-6 flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-accent font-extrabold text-white shadow-sm">
              S
            </span>
            <div>
              <span className="text-lg font-bold text-ink">Automotora Stroker</span>
              <span className="block text-xs font-medium text-muted">Panel Privado de Gestión</span>
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
