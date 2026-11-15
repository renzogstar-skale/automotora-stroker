import Link from "next/link";
import { Clock, ArrowLeft, ArrowRight, ShieldCheck, CheckCircle2 } from "lucide-react";
import { Badge, PageHeader } from "@/components/ui";

type Props = {
  title: string;
  section: string;
  description: string;
  roadmap?: string[];
  backHref?: string;
};

export function InPreparation({
  title,
  section,
  description,
  roadmap,
  backHref = "/panel",
}: Props) {
  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        desc={
          <span className="flex items-center gap-2">
            Módulo: <b className="font-semibold text-ink">{section}</b>
          </span>
        }
        actions={
          <Link href={backHref} className="btn btn-ghost text-xs sm:text-sm">
            <ArrowLeft className="size-4" /> Volver al panel
          </Link>
        }
      />

      <div className="card rounded-2xl overflow-hidden shadow-sm">
        <div className="border-b border-line bg-surface-2/60 p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="amber" className="px-3 py-1 text-xs">
              <Clock className="size-3.5" /> En preparación
            </Badge>
            <span className="text-xs font-semibold text-muted">
              Fase de despliegue gradual · Automotora Stroker
            </span>
          </div>

          <h2 className="mt-4 text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
            {title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            {description}
          </p>
        </div>

        <div className="grid gap-6 p-6 sm:p-8 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-bold text-ink uppercase tracking-wider">
              Alcance planificado para esta sección
            </h3>
            <ul className="mt-4 space-y-3 text-sm text-muted">
              {(
                roadmap || [
                  "Estructura de datos y modelos Prisma validados",
                  "Control de acceso y permisos RBAC integrados",
                  "Conexión con sucursales Santiago y Viña del Mar",
                  "Integración con auditoría y trazabilidad en CLP",
                ]
              ).map((item, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" />
                  <span className="font-medium text-ink/90">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col justify-between rounded-xl border border-line bg-surface-2/50 p-6">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted">
                <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                Seguridad y consistencia de datos
              </div>
              <p className="mt-2.5 text-xs leading-relaxed text-muted">
                Este módulo respeta las políticas de sucursales (Santiago y Viña del Mar), roles de usuario y formato local chileno (CLP sin decimales y zona horaria America/Santiago).
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-2.5 pt-4 border-t border-line">
              <Link href="/panel" className="btn btn-primary text-xs">
                Ir al Dashboard
              </Link>
              <Link href="/panel/inventario" className="btn text-xs">
                Ver Inventario <ArrowRight className="size-3.5" />
              </Link>
              <Link href="/panel/crm" className="btn text-xs">
                Ver CRM <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
