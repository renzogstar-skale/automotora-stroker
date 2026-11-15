import Link from "next/link";
import { Download, LayoutGrid, List, Plus } from "lucide-react";
import { guard } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, branchWhere } from "@/lib/rbac";
import { sp, qs } from "@/lib/period";
import { VEHICLE_STATUS, FUELS, TRANSMISSIONS } from "@/lib/labels";
import { clp, daysBetween, km, fmtPlate } from "@/lib/format";
import { expireReservations, vehicleWhere } from "@/server/inventory";
import { Badge, Card, Empty, PageHeader, Pagination, StatusBadge, Table, cx } from "@/components/ui";

type SP = Promise<Record<string, string | string[] | undefined>>;
const KEEP = ["q", "status", "condition", "ownership", "branch", "brand", "fuel", "transmission", "yearMin", "yearMax", "priceMax", "view", "accion"];
export default async function Inventory({ searchParams }: { searchParams: SP }) {
  const a = await guard("inventory");
  await expireReservations();
  const s = await searchParams;
  const q = Object.fromEntries(KEEP.map((k) => [k, sp(s, k)]));
  const view = q.view ?? "table", page = Math.max(1, +(sp(s, "page") ?? 1));
  const where = { ...branchWhere(a), ...vehicleWhere(q), ...(q.status ? {} : { status: { in: ["DISPONIBLE", "RESERVADO"] as never[] } }) };
  const showCost = can(a, "inventory.cost");
  const [total, rows, brands, branches, byBranch] = await Promise.all([
    db.vehicle.count({ where }),
    db.vehicle.findMany({ where, include: { branch: true, photos: { where: { isCover: true }, take: 1 }, movements: { include: { category: true } } }, orderBy: { stockSince: "asc" }, skip: (page - 1) * 24, take: 24 }),
    db.vehicle.findMany({ where: branchWhere(a), distinct: ["brand"], select: { brand: true }, orderBy: { brand: "asc" } }),
    db.branch.findMany({ where: a.role === "ADMIN" ? {} : { id: { in: a.branchIds } } }),
    db.vehicle.groupBy({ by: ["branchId", "status"], where: { ...branchWhere(a), status: { in: ["DISPONIBLE", "RESERVADO"] } }, _count: true }),
  ]);
  const prep = (v: (typeof rows)[number]) => v.movements.filter((m) => m.category.name === "Preparación de vehículo").reduce((t, m) => t + (m.type === "EGRESO" ? m.amount : -m.amount), 0);
  const link = (o: Record<string, string | undefined>) => `/panel/inventario${qs(s, o, KEEP)}`;
  return (
    <>
      <PageHeader title="Inventario" desc={`${total} unidades con los filtros actuales${q.accion === "reservar" ? " · elige una unidad para reservar" : ""}`}
        actions={<>
          <Link className={cx("btn px-2", view === "table" && "btn-dark")} href={link({ view: "table" })} aria-label="Tabla"><List className="size-4" /></Link>
          <Link className={cx("btn px-2", view === "cards" && "btn-dark")} href={link({ view: "cards" })} aria-label="Tarjetas"><LayoutGrid className="size-4" /></Link>
          <a className="btn" href={`/api/export/inventario${qs(s, {}, KEEP)}`}><Download className="size-4" />Exportar</a>
          {can(a, "inventory.edit") && <Link className="btn btn-primary" href="/panel/inventario/nuevo"><Plus className="size-4" />Agregar vehículo</Link>}
        </>} />
      <div className="mb-3 flex flex-wrap gap-2 text-sm">
        {branches.map((b) => {
          const av = byBranch.find((x) => x.branchId === b.id && x.status === "DISPONIBLE")?._count ?? 0, rs = byBranch.find((x) => x.branchId === b.id && x.status === "RESERVADO")?._count ?? 0;
          return <Link key={b.id} href={link({ branch: b.id })} className="card px-3 py-2 hover:border-accent/50"><b>{b.name}</b> <span className="text-muted">· {av} disponibles · {rs} reservados</span></Link>;
        })}
      </div>
      <form className="card mb-3 grid grid-cols-2 gap-2 p-3 md:grid-cols-4 xl:grid-cols-6" method="get">
        <input type="hidden" name="view" value={view} />
        <input name="q" defaultValue={q.q} placeholder="Marca, modelo, patente, VIN" className="input col-span-2" aria-label="Buscar" />
        <select name="status" defaultValue={q.status ?? ""} className="input" aria-label="Estado"><option value="">En stock (disp. + reserv.)</option>{Object.entries(VEHICLE_STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select>
        <select name="ownership" defaultValue={q.ownership ?? ""} className="input" aria-label="Propiedad"><option value="">Propio y consignado</option><option value="PROPIO">Propio</option><option value="CONSIGNADO">Consignado</option></select>
        <select name="condition" defaultValue={q.condition ?? ""} className="input" aria-label="Condición"><option value="">Nuevo y usado</option><option value="NUEVO">Nuevo</option><option value="USADO">Usado</option></select>
        <select name="brand" defaultValue={q.brand ?? ""} className="input" aria-label="Marca"><option value="">Marca</option>{brands.map((b) => <option key={b.brand}>{b.brand}</option>)}</select>
        {branches.length > 1 && <select name="branch" defaultValue={q.branch ?? ""} className="input" aria-label="Sucursal"><option value="">Sucursal</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>}
        <select name="fuel" defaultValue={q.fuel ?? ""} className="input" aria-label="Combustible"><option value="">Combustible</option>{FUELS.map((f) => <option key={f}>{f}</option>)}</select>
        <select name="transmission" defaultValue={q.transmission ?? ""} className="input" aria-label="Transmisión"><option value="">Transmisión</option>{TRANSMISSIONS.map((f) => <option key={f}>{f}</option>)}</select>
        <input name="yearMin" type="number" defaultValue={q.yearMin} placeholder="Año desde" className="input" aria-label="Año desde" />
        <input name="priceMax" type="number" defaultValue={q.priceMax} placeholder="Precio máx." className="input" aria-label="Precio máximo" />
        <button className="btn btn-dark">Filtrar</button>
      </form>
      {rows.length === 0 ? <Card><Empty title="Sin vehículos con estos filtros" /></Card> : view === "cards" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rows.map((v) => (
            <Link key={v.id} href={`/panel/inventario/${v.id}`} className="card overflow-hidden hover:border-accent/50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={v.photos[0]?.url ?? "/demo/placeholder.svg"} alt={`${v.brand} ${v.model}`} className="aspect-[4/3] w-full object-cover" loading="lazy" />
              <div className="space-y-1 p-3 text-sm">
                <div className="flex items-start justify-between gap-2"><p className="font-semibold">{v.brand} {v.model} <span className="font-normal text-muted">{v.year}</span></p><StatusBadge map={VEHICLE_STATUS} value={v.status} /></div>
                <p className="text-xs text-muted">{v.version} · {km(v.km)} · {v.transmission} · {v.fuel}</p>
                <p className="text-xs text-muted">{fmtPlate(v.plate)}{v.vin && ` · VIN ${v.vin}`}</p>
                <div className="flex items-center justify-between"><span className="font-semibold tabular-nums">{clp(v.price)}</span><span className="text-xs text-muted">{daysBetween(v.stockSince)} días · {v.branch.name.replace("Stroker ", "")}</span></div>
                {showCost && <p className="text-xs text-muted">Costo {clp(v.cost)} · margen <span className={cx("tabular-nums", v.price - v.cost - prep(v) < 0 && "text-red-700")}>{clp(v.price - v.cost - prep(v))}</span></p>}
                <div className="flex gap-1"><Badge tone={v.condition === "NUEVO" ? "teal" : undefined} icon={false}>{v.condition === "NUEVO" ? "Nuevo" : "Usado"}</Badge><Badge tone={v.ownership === "CONSIGNADO" ? "violet" : undefined} icon={false}>{v.ownership === "CONSIGNADO" ? "Consignado" : "Propio"}</Badge>{v.published && <Badge tone="green">En la web</Badge>}</div>
              </div>
            </Link>))}
          <div className="col-span-full"><Pagination page={page} pages={Math.ceil(total / 24)} href={(p) => link({ page: String(p) })} /></div>
        </div>
      ) : (
        <Card bodyClass="p-0">
          <Table><thead><tr><th>Foto</th><th>Vehículo</th><th>Patente / VIN</th><th className="num">Km</th><th>Transm. / comb.</th><th>Sucursal</th><th>Estado</th><th className="num">Precio</th>{showCost && <><th className="num">Costo</th><th className="num">Margen est.</th></>}<th className="num">Días</th></tr></thead><tbody>
            {rows.map((v) => {
              const p = prep(v), margin = v.price - v.cost - p;
              return (
                <tr key={v.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <td><img src={v.photos[0]?.url ?? "/demo/placeholder.svg"} alt="" className="h-10 w-14 rounded object-cover" loading="lazy" /></td>
                  <td><Link href={`/panel/inventario/${v.id}`} className="font-medium hover:text-accent">{v.brand} {v.model} {v.year}</Link><div className="flex gap-1 text-xs text-muted">{v.version}<Badge tone={v.condition === "NUEVO" ? "teal" : undefined} icon={false}>{v.condition === "NUEVO" ? "Nuevo" : "Usado"}</Badge><Badge tone={v.ownership === "CONSIGNADO" ? "violet" : undefined} icon={false}>{v.ownership === "CONSIGNADO" ? "Consignado" : "Propio"}</Badge></div></td>
                  <td className="text-xs">{fmtPlate(v.plate)}<div className="text-muted">{v.vin ?? "—"}</div></td>
                  <td className="num">{km(v.km)}</td><td className="text-xs">{v.transmission}<div className="text-muted">{v.fuel}</div></td><td>{v.branch.name.replace("Stroker ", "")}</td>
                  <td><StatusBadge map={VEHICLE_STATUS} value={v.status} />{v.published && <div className="mt-0.5 text-[11px] text-emerald-700 dark:text-emerald-400">En la web</div>}</td>
                  <td className="num">{clp(v.price)}</td>
                  {showCost && <><td className="num">{clp(v.cost)}</td><td className={cx("num", margin < 0 && "text-red-700")} title="Precio − costo − preparación">{clp(margin)}</td></>}
                  <td className={cx("num", daysBetween(v.stockSince) > 90 && "font-semibold text-amber-700 dark:text-amber-400")}>{daysBetween(v.stockSince)}</td>
                </tr>);
            })}
          </tbody></Table>
          <Pagination page={page} pages={Math.ceil(total / 24)} href={(p) => link({ page: String(p) })} />
        </Card>
      )}
      {showCost && <p className="mt-2 text-[11px] text-muted">Margen estimado = precio publicado − costo (propio: adquisición; consignado: monto acordado al propietario) − preparación registrada. Días en stock desde el ingreso.</p>}
    </>
  );
}
