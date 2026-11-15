import { NextRequest } from "next/server";
import { getActor } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, branchWhere } from "@/lib/rbac";
import { vehicleWhere } from "@/server/inventory";
import { daysBetween, date } from "@/lib/format";

const esc = (v: unknown) => { const s = v == null ? "" : String(v); return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export async function GET(req: NextRequest) {
  const a = await getActor();
  if (!a) return new Response("No autenticado", { status: 401 });
  if (!can(a, "inventory")) return new Response("Sin permiso", { status: 403 });
  const q = Object.fromEntries(req.nextUrl.searchParams);
  const cost = can(a, "inventory.cost");
  const rows = await db.vehicle.findMany({ where: { ...branchWhere(a), ...vehicleWhere(q) }, include: { branch: true }, orderBy: { stockSince: "asc" } });
  const head = ["Marca", "Modelo", "Versión", "Año", "Patente", "VIN", "Km", "Transmisión", "Combustible", "Condición", "Propiedad", "Sucursal", "Estado", "Precio", ...(cost ? ["Costo"] : []), "Ingreso", "Días en stock"];
  const lines = rows.map((v) => [v.brand, v.model, v.version, v.year, v.plate, v.vin, v.km, v.transmission, v.fuel, v.condition, v.ownership, v.branch.name, v.status, v.price, ...(cost ? [v.cost] : []), date(v.stockSince), daysBetween(v.stockSince)].map(esc).join(","));
  return new Response("﻿" + [head.join(","), ...lines].join("\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="inventario-${Date.now()}.csv"` } });
}
