import type { Role } from "@prisma/client";

/** Permisos por rol. Se verifican en el servidor (páginas, acciones, API, exportaciones y documentos). */
export type Perm =
  | "dashboard" | "dashboard.exec" | "crm" | "crm.all" | "crm.trash" | "leads.import" | "leads.export" | "whatsapp"
  | "appointments" | "dailyreport" | "dailyreport.supervise" | "team" | "ceo" | "social"
  | "inventory" | "inventory.edit" | "inventory.cost" | "consignments" | "albums" | "web.publish" | "appraisal"
  | "documents" | "documents.templates" | "sales" | "sales.edit" | "payments" | "finance" | "commissions"
  | "ranking" | "sellers" | "calculator" | "config" | "web.admin" | "integrations" | "users" | "audit";

const ALL: Perm[] = [
  "dashboard", "dashboard.exec", "crm", "crm.all", "crm.trash", "leads.import", "leads.export", "whatsapp", "appointments",
  "dailyreport", "dailyreport.supervise", "team", "ceo", "social", "inventory", "inventory.edit", "inventory.cost", "consignments",
  "albums", "web.publish", "appraisal", "documents", "documents.templates", "sales", "sales.edit", "payments", "finance",
  "commissions", "ranking", "sellers", "calculator", "config", "web.admin", "integrations", "users", "audit",
];

export const ROLE_PERMS: Record<Role, Perm[]> = {
  ADMIN: ALL,
  GERENCIA: [
    "dashboard", "dashboard.exec", "crm", "crm.all", "crm.trash", "leads.import", "leads.export", "whatsapp", "appointments",
    "dailyreport", "dailyreport.supervise", "team", "ceo", "social", "inventory", "inventory.edit", "inventory.cost", "consignments",
    "albums", "web.publish", "appraisal", "documents", "sales", "sales.edit", "ranking", "sellers", "calculator",
  ],
  VENDEDOR: ["dashboard", "crm", "whatsapp", "appointments", "dailyreport", "social", "inventory", "appraisal", "documents", "sales", "sales.edit", "calculator"],
  FINANZAS: [
    "dashboard", "dashboard.exec", "inventory", "inventory.cost", "consignments", "documents", "sales", "payments", "finance",
    "commissions", "ranking", "sellers", "calculator", "ceo",
  ],
  FOTOGRAFO: ["inventory", "albums"],
};

export type Actor = {
  id: string; name: string; email: string; role: Role; canPublish: boolean;
  branchIds: string[]; sellerId: string | null;
};

export function can(a: Actor, p: Perm) {
  if (p === "web.publish" && a.role === "FOTOGRAFO") return a.canPublish;
  return ROLE_PERMS[a.role].includes(p);
}

/** Sucursales visibles: null = todas (administrador). */
export const branchScope = (a: Actor) => (a.role === "ADMIN" ? null : a.branchIds);

/** Filtro Prisma por sucursal (+ cartera propia para vendedores) en oportunidades y citas. */
export function oppScope(a: Actor) {
  const b = branchScope(a);
  return {
    ...(b ? { branchId: { in: b } } : {}),
    ...(a.role === "VENDEDOR" ? { sellerId: a.sellerId ?? "__none__" } : {}),
  };
}
export function branchWhere(a: Actor): { branchId?: { in: string[] } } {
  const b = branchScope(a);
  return b ? { branchId: { in: b } } : {};
}
export class Forbidden extends Error { constructor(msg = "No tienes permiso para esta acción.") { super(msg); } }
export function assert(a: Actor, p: Perm) { if (!can(a, p)) throw new Forbidden(); }
export function assertBranch(a: Actor, branchId: string | null | undefined) {
  const b = branchScope(a);
  if (b && branchId && !b.includes(branchId)) throw new Forbidden("Registro fuera de tus sucursales.");
}
