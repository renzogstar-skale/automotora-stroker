import type { Prisma } from "@prisma/client";
import { can, oppScope, type Actor } from "@/lib/rbac";
import { parseYmd, addDays } from "@/lib/format";
import { sp } from "@/lib/period";

type SP = Record<string, string | string[] | undefined>;
/** Filtros CRM compartidos por tablero, lista, indicadores, Leads y exportación. */
export function oppWhere(a: Actor, s: SP, opts: { ignoreType?: boolean } = {}): Prisma.OpportunityWhereInput {
  const global = can(a, "crm.all") && sp(s, "scope") !== "mine";
  const base = global ? oppScope(a) : { ...oppScope(a), sellerId: a.sellerId ?? "__none__" };
  const w: Prisma.OpportunityWhereInput = { ...base, deletedAt: null };
  if (!opts.ignoreType) w.type = (sp(s, "type") ?? "VENTA") as never;
  const q = sp(s, "q");
  if (q) w.contact = { OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }, { email: { contains: q, mode: "insensitive" } }, { rut: { contains: q } }] };
  if (sp(s, "seller") && global) w.sellerId = sp(s, "seller");
  if (sp(s, "branch")) w.branchId = a.role === "ADMIN" || a.branchIds.includes(sp(s, "branch")!) ? sp(s, "branch") : "__none__";
  if (sp(s, "stage")) w.stage = sp(s, "stage") as never;
  if (sp(s, "source")) w.source = sp(s, "source") as never;
  if (sp(s, "from") || sp(s, "to")) w.createdAt = { gte: sp(s, "from") ? parseYmd(sp(s, "from")!) : undefined, lt: sp(s, "to") ? addDays(parseYmd(sp(s, "to")!), 1) : undefined };
  return w;
}
export const isGlobal = (a: Actor, s: SP) => can(a, "crm.all") && sp(s, "scope") !== "mine";
