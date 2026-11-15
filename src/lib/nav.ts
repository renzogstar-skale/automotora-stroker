import type { Perm } from "./rbac";

export type NavItem = { label: string; href: string; perm: Perm };
export type NavGroup = { label: string; icon: string; items: NavItem[] };

export const NAV: NavGroup[] = [
  { label: "Dashboard", icon: "gauge", items: [
    { label: "Principal", href: "/panel", perm: "dashboard" },
    { label: "Ejecutivo", href: "/panel/ejecutivo", perm: "dashboard.exec" },
  ] },
  { label: "CRM y Leads", icon: "users", items: [
    { label: "CRM", href: "/panel/crm", perm: "crm" },
    { label: "WhatsApp", href: "/panel/whatsapp", perm: "whatsapp" },
    { label: "Leads", href: "/panel/leads", perm: "crm" },
    { label: "Citas", href: "/panel/citas", perm: "appointments" },
    { label: "Tareas", href: "/panel/tareas", perm: "crm" },
    { label: "Informe diario", href: "/panel/informe-diario", perm: "dailyreport" },
    { label: "Hoy del equipo", href: "/panel/equipo", perm: "team" },
    { label: "Informe CEO", href: "/panel/informe-ceo", perm: "ceo" },
    { label: "Redes sociales", href: "/panel/redes", perm: "social" },
  ] },
  { label: "Inventario y Vehículos", icon: "car", items: [
    { label: "Inventario", href: "/panel/inventario", perm: "inventory" },
    { label: "Consignaciones", href: "/panel/consignaciones", perm: "consignments" },
    { label: "Álbumes", href: "/panel/albumes", perm: "albums" },
    { label: "Tasación", href: "/panel/tasacion", perm: "appraisal" },
  ] },
  { label: "Documentos", icon: "file", items: [
    { label: "Documentos", href: "/panel/documentos", perm: "documents" },
    { label: "Historial", href: "/panel/documentos?tab=historial", perm: "documents" },
    { label: "Plantillas", href: "/panel/documentos?tab=plantillas", perm: "documents.templates" },
  ] },
  { label: "Finanzas", icon: "wallet", items: [
    { label: "Gastos e ingresos", href: "/panel/finanzas/movimientos", perm: "finance" },
    { label: "Ranking de vendedores", href: "/panel/finanzas/ranking", perm: "ranking" },
    { label: "Gestión de fondos", href: "/panel/finanzas/fondos", perm: "finance" },
    { label: "Ventas", href: "/panel/ventas", perm: "sales" },
    { label: "Libro de Ventas", href: "/panel/finanzas/libro", perm: "inventory.cost" },
    { label: "Comisiones y descuentos", href: "/panel/finanzas/comisiones", perm: "commissions" },
    { label: "Vendedores", href: "/panel/vendedores", perm: "sellers" },
    { label: "Seguimiento Financiero", href: "/panel/finanzas/seguimiento", perm: "finance" },
    { label: "Calculadora Financiera", href: "/panel/finanzas/calculadora", perm: "calculator" },
  ] },
  { label: "Sistema", icon: "settings", items: [
    { label: "Configuración", href: "/panel/sistema/configuracion", perm: "config" },
    { label: "Mi Web", href: "/panel/sistema/mi-web", perm: "web.admin" },
    { label: "Integraciones", href: "/panel/sistema/integraciones", perm: "integrations" },
    { label: "Usuarios", href: "/panel/sistema/usuarios", perm: "users" },
    { label: "Auditoría", href: "/panel/sistema/auditoria", perm: "audit" },
  ] },
];
const EXTRA: Record<string, string> = {
  "/panel/hoy": "Hoy", "/panel/buscar": "Búsqueda", "/panel/crm/nuevo": "Nuevo lead", "/panel/inventario/nuevo": "Nuevo vehículo",
  "/panel/ventas/nueva": "Nueva venta", "/panel/crm/papelera": "Papelera", "/panel/sin-acceso": "Acceso restringido",
};
/** Ruta de navegación a partir del pathname. */
export function crumbs(path: string) {
  if (EXTRA[path]) return [EXTRA[path]];
  for (const g of NAV) {
    const exact = g.items.find((i) => i.href === path);
    if (exact) return [g.label, exact.label];
    const parent = g.items.filter((i) => i.href !== "/panel" && path.startsWith(i.href.split("?")[0] + "/")).sort((a, b) => b.href.length - a.href.length)[0];
    if (parent) return [g.label, parent.label, "Detalle"];
  }
  return ["Panel"];
}
