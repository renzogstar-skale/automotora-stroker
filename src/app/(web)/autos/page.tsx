import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { catalogWhere, publicSelect, publicWhere } from "@/server/web";
import { Shell, VehicleCard, loadSite, one, trackView } from "../site";

export const dynamic = "force-dynamic";
export const metadata = { title: "Autos en venta" };

const KEYS = ["q", "marca", "tipo", "anio", "precio", "km", "sucursal", "orden"];
const ORDER: Record<string, Prisma.VehicleOrderByWithRelationInput> = { recientes: { publishedAt: "desc" }, "precio-asc": { price: "asc" }, "precio-desc": { price: "desc" }, km: { km: "asc" }, anio: { year: "desc" } };

export default async function Catalog({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const s = await searchParams;
  const ctx = await loadSite(s);
  const q = Object.fromEntries(KEYS.map((k) => [k, one(s, k)]));
  const page = Math.max(1, +(one(s, "page") ?? 1));
  const where = catalogWhere(q);
  const [total, rows, brands, types] = await Promise.all([
    db.vehicle.count({ where }),
    db.vehicle.findMany({ where, select: publicSelect, orderBy: [ORDER[q.orden ?? ""] ?? { featured: "desc" }, { publishedAt: "desc" }], skip: (page - 1) * 24, take: 24 }),
    db.vehicle.findMany({ where: publicWhere, distinct: ["brand"], select: { brand: true }, orderBy: { brand: "asc" } }),
    db.vehicle.findMany({ where: publicWhere, distinct: ["bodyType"], select: { bodyType: true }, orderBy: { bodyType: "asc" } }),
  ]);
  if (!ctx.preview) await trackView("VIEW", "/autos");
  const pages = Math.ceil(total / 24);
  const pageHref = (p: number) => ctx.href(`/autos?${new URLSearchParams({ ...Object.fromEntries(Object.entries(q).filter(([, v]) => v) as [string, string][]), page: String(p) })}`);
  const yearNow = new Date().getFullYear();
  return (
    <Shell {...ctx}>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight">Autos en venta</h1>
        <p className="mt-1 text-sm text-muted">{total} {total === 1 ? "unidad" : "unidades"} con estos filtros</p>
        <form className="card mt-5 grid grid-cols-2 gap-2 p-3 md:grid-cols-4 lg:grid-cols-8" method="get">
          {ctx.preview && <input type="hidden" name="preview" value="1" />}
          <input name="q" defaultValue={q.q} placeholder="Buscar marca o modelo" className="input col-span-2" aria-label="Buscar" />
          <select name="marca" defaultValue={q.marca ?? ""} className="input" aria-label="Marca"><option value="">Marca</option>{brands.map((b) => <option key={b.brand}>{b.brand}</option>)}</select>
          <select name="tipo" defaultValue={q.tipo ?? ""} className="input" aria-label="Tipo"><option value="">Tipo</option>{types.map((t) => <option key={t.bodyType}>{t.bodyType}</option>)}</select>
          <select name="anio" defaultValue={q.anio ?? ""} className="input" aria-label="Año desde"><option value="">Año desde</option>{Array.from({ length: 15 }, (_, i) => yearNow - i).map((y) => <option key={y}>{y}</option>)}</select>
          <select name="precio" defaultValue={q.precio ?? ""} className="input" aria-label="Precio máximo"><option value="">Precio máx.</option>{[6, 8, 10, 12, 15, 20, 25, 30, 40].map((m) => <option key={m} value={m * 1e6}>${m} millones</option>)}</select>
          <select name="km" defaultValue={q.km ?? ""} className="input" aria-label="Kilometraje máximo"><option value="">Km máx.</option>{[10, 30, 50, 80, 120].map((k) => <option key={k} value={k * 1000}>{k}.000 km</option>)}</select>
          <select name="sucursal" defaultValue={q.sucursal ?? ""} className="input" aria-label="Sucursal"><option value="">Sucursal</option>{ctx.site.branches.filter((b) => b.visible).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
          <select name="orden" defaultValue={q.orden ?? ""} className="input" aria-label="Ordenar"><option value="">Destacados</option><option value="recientes">Más recientes</option><option value="precio-asc">Menor precio</option><option value="precio-desc">Mayor precio</option><option value="km">Menor kilometraje</option><option value="anio">Más nuevos</option></select>
          <button className="btn btn-primary">Filtrar</button>
          <Link href={ctx.href("/autos")} className="btn btn-ghost">Limpiar</Link>
        </form>
        {rows.length ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{rows.map((v) => <VehicleCard key={v.id} v={v} href={ctx.href} />)}</div>
        ) : <div className="card mt-5 p-10 text-center"><p className="font-semibold">No hay autos con estos filtros</p><Link href={ctx.href("/autos")} className="link mt-2 inline-block text-sm">Ver todo el catálogo</Link></div>}
        {pages > 1 && (
          <nav className="mt-6 flex items-center justify-center gap-2 text-sm" aria-label="Paginación">
            {page > 1 && <Link className="btn" href={pageHref(page - 1)}>Anterior</Link>}
            <span className="text-muted">Página {page} de {pages}</span>
            {page < pages && <Link className="btn" href={pageHref(page + 1)}>Siguiente</Link>}
          </nav>
        )}
      </div>
    </Shell>
  );
}
