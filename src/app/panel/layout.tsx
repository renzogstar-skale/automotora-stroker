import { guard } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { NAV } from "@/lib/nav";
import { ROLE_LABEL } from "@/lib/labels";
import { ago } from "@/lib/format";
import { getAlerts } from "@/server/alerts";
import { Shell } from "@/components/client/shell";
import { logoutAction } from "../(auth)/actions";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const a = await guard();
  const nav = NAV.map((g) => ({ ...g, items: g.items.filter((i) => can(a, i.perm)) })).filter((g) => g.items.length);
  const alerts = can(a, "dashboard") || can(a, "albums") ? await getAlerts(a) : [];
  const quick = [
    can(a, "crm") && { label: "Nuevo lead", href: "/panel/crm/nuevo" },
    can(a, "appointments") && { label: "Nueva cita", href: "/panel/citas?nueva=1" },
    can(a, "inventory.edit") && { label: "Nuevo vehículo", href: "/panel/inventario/nuevo" },
    can(a, "crm") && { label: "Nueva tarea", href: "/panel/tareas" },
    can(a, "sales.edit") && { label: "Nueva reserva", href: "/panel/inventario?status=DISPONIBLE&accion=reservar" },
    can(a, "sales.edit") && { label: "Nueva venta", href: "/panel/ventas/nueva" },
    can(a, "consignments") && { label: "Nueva consignación", href: "/panel/consignaciones/nueva" },
    can(a, "appraisal") && { label: "Nueva tasación", href: "/panel/tasacion" },
    can(a, "documents") && { label: "Nuevo documento", href: "/panel/documentos?nuevo=1" },
  ].filter(Boolean) as { label: string; href: string }[];
  return (
    <Shell nav={nav} user={{ name: a.name, email: a.email, role: ROLE_LABEL[a.role] }} quick={quick} logout={logoutAction}
      alertCount={alerts.length} alerts={alerts.slice(0, 10).map((x) => ({ kind: x.kind, reason: x.reason, who: x.who, href: x.href, tone: x.tone, age: ago(x.since) }))}>
      {children}
    </Shell>
  );
}
