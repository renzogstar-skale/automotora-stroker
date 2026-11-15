import { NextRequest } from "next/server";
import { getActor } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { STAGE_LABEL, SOURCE_LABEL, OPP_TYPE_LABEL } from "@/lib/labels";
import { date } from "@/lib/format";
import { oppWhere } from "@/app/panel/crm/query";

const esc = (v: unknown) => { const s = v == null ? "" : String(v); return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

/** Exportación filtrada: aplica los mismos filtros y alcance de permisos que la vista Leads. */
export async function GET(req: NextRequest) {
  const a = await getActor();
  if (!a) return new Response("No autenticado", { status: 401 });
  if (!can(a, "leads.export")) return new Response("Sin permiso para exportar", { status: 403 });
  const s = Object.fromEntries(req.nextUrl.searchParams);
  const rows = await db.opportunity.findMany({ where: oppWhere(a, s, { ignoreType: !s.type }), include: { contact: true, seller: true, branch: true }, orderBy: { createdAt: "desc" }, take: 10000 });
  const head = ["Nombre", "Teléfono", "Correo", "RUT", "Comuna", "Tipo", "Etapa", "Origen", "Vendedor", "Sucursal", "Presupuesto", "Interés", "Creado"];
  const lines = rows.map((o) => [o.contact.name, o.contact.phone, o.contact.email, o.contact.rut, o.contact.comuna, OPP_TYPE_LABEL[o.type], STAGE_LABEL[o.stage], SOURCE_LABEL[o.source], o.seller?.name, o.branch.name, o.budget, o.interest, date(o.createdAt)].map(esc).join(","));
  await audit(a, "leads.export", "Opportunity", "-", `Exportó ${rows.length} leads`, { filters: s });
  return new Response("﻿" + [head.join(","), ...lines].join("\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="leads-${Date.now()}.csv"` } });
}
