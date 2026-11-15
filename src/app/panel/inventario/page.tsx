import Link from "next/link";
import { Download, LayoutGrid, List, Plus, RefreshCw, CheckCircle2, Clock, Check, AlertCircle, HelpCircle, Car } from "lucide-react";

function InstagramIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
    </svg>
  );
}
import { guard } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, branchWhere } from "@/lib/rbac";
import { sp, qs } from "@/lib/period";
import { VEHICLE_STATUS, FUELS, TRANSMISSIONS } from "@/lib/labels";
import { clp, daysBetween, km, fmtPlate } from "@/lib/format";
import { expireReservations, vehicleWhere } from "@/server/inventory";
import { seedOfficialStrokerInventory } from "@/server/seed-stroker";
import { Badge, Card, Empty, PageHeader, Pagination, StatusBadge, Table, cx } from "@/components/ui";

type SP = Promise<Record<string, string | string[] | undefined>>;
const KEEP = ["q", "status", "condition", "ownership", "branch", "brand", "fuel", "transmission", "yearMin", "yearMax", "priceMax", "view", "accion"];

export default async function Inventory({ searchParams }: { searchParams: SP }) {
  const a = await guard("inventory");
  await expireReservations();

  // Asegura que las 15 unidades oficiales estén sincronizadas en la base de datos (incluso en Vercel)
  const officialCount = await db.vehicle.count({ where: { source: "INSTAGRAM_OFFICIAL" } });
  if (officialCount < 15) {
    try {
      await seedOfficialStrokerInventory();
    } catch (e) {
      console.error("Auto-sync error:", e);
    }
  }
  const s = await searchParams;
  const q = Object.fromEntries(KEEP.map((k) => [k, sp(s, k)]));
  const view = q.view ?? "table", page = Math.max(1, +(sp(s, "page") ?? 1));
  const where = {
    ...branchWhere(a),
    ...vehicleWhere(q),
    ...(q.status ? {} : { status: { in: ["DISPONIBLE", "RESERVADO", "VENDIDO", "EN_CONSIGNACION", "POR_CONFIRMAR"] as never[] } }),
  };
  const showCost = can(a, "inventory.cost");

  // 6 Indicadores Mandatorios FASE 7
  const [
    totalVehicles,
    countDisponible,
    countVendido,
    countReservado,
    countConsignacion,
    countPendientes,
    pendingInstagramCount,
    total,
    rows,
    brands,
    branches,
  ] = await Promise.all([
    db.vehicle.count({ where: branchWhere(a) }),
    db.vehicle.count({ where: { ...branchWhere(a), status: "DISPONIBLE" } }),
    db.vehicle.count({ where: { ...branchWhere(a), status: "VENDIDO" } }),
    db.vehicle.count({ where: { ...branchWhere(a), status: "RESERVADO" } }),
    db.vehicle.count({ where: { ...branchWhere(a), OR: [{ status: "EN_CONSIGNACION" }, { ownership: "CONSIGNADO" }] } }),
    db.vehicle.count({ where: { ...branchWhere(a), OR: [{ status: "POR_CONFIRMAR" }, { verificationStatus: "POR_CONFIRMAR" }] } }),
    db.instagramImport.count({ where: { status: "PENDIENTE" } }),
    db.vehicle.count({ where }),
    db.vehicle.findMany({
      where,
      include: { branch: true, photos: { where: { isCover: true }, take: 1 }, movements: { include: { category: true } } },
      orderBy: [{ published: "desc" }, { stockSince: "asc" }],
      skip: (page - 1) * 24,
      take: 24,
    }),
    db.vehicle.findMany({ where: branchWhere(a), distinct: ["brand"], select: { brand: true }, orderBy: { brand: "asc" } }),
    db.branch.findMany({ where: a.role === "ADMIN" ? {} : { id: { in: a.branchIds } } }),
  ]);

  const prep = (v: (typeof rows)[number]) =>
    v.movements.filter((m) => m.category.name === "Preparación de vehículo").reduce((t, m) => t + (m.type === "EGRESO" ? m.amount : -m.amount), 0);
  const link = (o: Record<string, string | undefined>) => `/panel/inventario${qs(s, o, KEEP)}`;

  return (
    <>
      <PageHeader
        title="Inventario de Vehículos"
        desc={`${total} unidades mostradas con los filtros actuales · Gestión centralizada Stroker`}
        actions={
          <>
            <Link
              className="btn btn-outline border-pink-500/30 text-pink-600 hover:bg-pink-500/10 flex items-center gap-1.5"
              href="/panel/inventario/instagram-sync"
            >
              <InstagramIcon className="size-4 text-pink-500" />
              <span>Sincronizar Instagram</span>
              {pendingInstagramCount > 0 && (
                <span className="ml-1 rounded-full bg-pink-500 text-white text-[10px] font-bold px-1.5 py-0.2">
                  {pendingInstagramCount}
                </span>
              )}
            </Link>
            <Link className={cx("btn px-2", view === "table" && "btn-dark")} href={link({ view: "table" })} aria-label="Tabla">
              <List className="size-4" />
            </Link>
            <Link className={cx("btn px-2", view === "cards" && "btn-dark")} href={link({ view: "cards" })} aria-label="Tarjetas">
              <LayoutGrid className="size-4" />
            </Link>
            <a className="btn" href={`/api/export/inventario${qs(s, {}, KEEP)}`}>
              <Download className="size-4" />Exportar CSV
            </a>
            {can(a, "inventory.edit") && (
              <Link className="btn btn-primary" href="/panel/inventario/nuevo">
                <Plus className="size-4" />Agregar vehículo
              </Link>
            )}
          </>
        }
      />

      {/* 6 Indicadores Principales Mandatorios */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Link
          href={link({ status: "" })}
          className="card p-3.5 hover:border-accent transition-all text-center border-l-4 border-l-zinc-500 bg-surface"
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted block flex items-center justify-center gap-1">
            <Car className="size-3.5" /> Total Vehículos
          </span>
          <span className="text-2xl font-black text-ink mt-1 block">{totalVehicles}</span>
        </Link>

        <Link
          href={link({ status: "DISPONIBLE" })}
          className="card p-3.5 hover:border-emerald-500 transition-all text-center border-l-4 border-l-emerald-500 bg-surface"
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block flex items-center justify-center gap-1">
            <CheckCircle2 className="size-3.5" /> Disponibles
          </span>
          <span className="text-2xl font-black text-emerald-600 mt-1 block">{countDisponible}</span>
        </Link>

        <Link
          href={link({ status: "VENDIDO" })}
          className="card p-3.5 hover:border-red-500 transition-all text-center border-l-4 border-l-red-500 bg-surface"
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-red-700 dark:text-red-400 block flex items-center justify-center gap-1">
            <Check className="size-3.5" /> Vendidos
          </span>
          <span className="text-2xl font-black text-red-600 mt-1 block">{countVendido}</span>
        </Link>

        <Link
          href={link({ status: "RESERVADO" })}
          className="card p-3.5 hover:border-amber-500 transition-all text-center border-l-4 border-l-amber-500 bg-surface"
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 block flex items-center justify-center gap-1">
            <Clock className="size-3.5" /> Reservados
          </span>
          <span className="text-2xl font-black text-amber-600 mt-1 block">{countReservado}</span>
        </Link>

        <Link
          href={link({ status: "EN_CONSIGNACION" })}
          className="card p-3.5 hover:border-purple-500 transition-all text-center border-l-4 border-l-purple-500 bg-surface"
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400 block flex items-center justify-center gap-1">
            <AlertCircle className="size-3.5" /> En Consignación
          </span>
          <span className="text-2xl font-black text-purple-600 mt-1 block">{countConsignacion}</span>
        </Link>

        <Link
          href={link({ status: "POR_CONFIRMAR" })}
          className="card p-3.5 hover:border-zinc-400 transition-all text-center border-l-4 border-l-zinc-400 bg-surface"
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 block flex items-center justify-center gap-1">
            <HelpCircle className="size-3.5" /> Por Confirmar
          </span>
          <span className="text-2xl font-black text-zinc-500 mt-1 block">{countPendientes}</span>
        </Link>
      </div>

      {/* Filtros de Inventario */}
      <form className="card mb-3 grid grid-cols-2 gap-2 p-3 md:grid-cols-4 xl:grid-cols-6" method="get">
        <input type="hidden" name="view" value={view} />
        <input name="q" defaultValue={q.q} placeholder="Marca, modelo, patente, stockCode" className="input col-span-2" aria-label="Buscar" />
        <select name="status" defaultValue={q.status ?? ""} className="input" aria-label="Estado">
          <option value="">Todos los estados</option>
          {Object.entries(VEHICLE_STATUS).map(([k, [l]]) => (
            <option key={k} value={k}>{l}</option>
          ))}
        </select>
        <select name="ownership" defaultValue={q.ownership ?? ""} className="input" aria-label="Propiedad">
          <option value="">Propio y consignado</option>
          <option value="PROPIO">Propio</option>
          <option value="CONSIGNADO">Consignado</option>
        </select>
        <select name="condition" defaultValue={q.condition ?? ""} className="input" aria-label="Condición">
          <option value="">Nuevo y usado</option>
          <option value="NUEVO">Nuevo</option>
          <option value="USADO">Usado</option>
        </select>
        <select name="brand" defaultValue={q.brand ?? ""} className="input" aria-label="Marca">
          <option value="">Marca</option>
          {brands.map((b) => <option key={b.brand}>{b.brand}</option>)}
        </select>
        {branches.length > 1 && (
          <select name="branch" defaultValue={q.branch ?? ""} className="input" aria-label="Sucursal">
            <option value="">Sucursal</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        <select name="fuel" defaultValue={q.fuel ?? ""} className="input" aria-label="Combustible">
          <option value="">Combustible</option>
          {FUELS.map((f) => <option key={f}>{f}</option>)}
        </select>
        <select name="transmission" defaultValue={q.transmission ?? ""} className="input" aria-label="Transmisión">
          <option value="">Transmisión</option>
          {TRANSMISSIONS.map((f) => <option key={f}>{f}</option>)}
        </select>
        <input name="yearMin" type="number" defaultValue={q.yearMin} placeholder="Año desde" className="input" aria-label="Año desde" />
        <input name="priceMax" type="number" defaultValue={q.priceMax} placeholder="Precio máx." className="input" aria-label="Precio máximo" />
        <button className="btn btn-dark">Filtrar</button>
      </form>

      {rows.length === 0 ? (
        <Card><Empty title="Sin vehículos con estos filtros" /></Card>
      ) : view === "cards" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rows.map((v) => (
            <Link key={v.id} href={`/panel/inventario/${v.id}`} className="card overflow-hidden hover:border-accent/50 transition-all">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <div className="relative aspect-[4/3] w-full bg-surface-2">
                <img src={v.photos[0]?.url ?? "/demo/placeholder.svg"} alt={`${v.brand} ${v.model}`} className="size-full object-cover" loading="lazy" />
                {v.stockCode && (
                  <span className="absolute top-2 left-2 rounded bg-black/75 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                    {v.stockCode}
                  </span>
                )}
                {v.status === "VENDIDO" && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <span className="bg-red-600 text-white font-black text-xs px-2.5 py-1 rounded">🔴 VENDIDO</span>
                  </div>
                )}
              </div>
              <div className="space-y-1 p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold truncate">{v.brand} {v.model} <span className="font-normal text-muted">{v.year}</span></p>
                  <StatusBadge map={VEHICLE_STATUS} value={v.status} />
                </div>
                <p className="text-xs text-muted truncate">{v.version} · {km(v.km)} · {v.transmission} · {v.fuel}</p>
                <p className="text-xs text-muted">{fmtPlate(v.plate)}{v.vin && ` · VIN ${v.vin}`}</p>
                <div className="flex items-center justify-between">
                  <span className="font-semibold tabular-nums text-accent">{clp(v.price)}</span>
                  <span className="text-xs text-muted">{daysBetween(v.stockSince)} días</span>
                </div>
                {showCost && (
                  <p className="text-xs text-muted">
                    Costo {clp(v.cost)} · margen <span className={cx("tabular-nums", v.price - v.cost - prep(v) < 0 && "text-red-700")}>{clp(v.price - v.cost - prep(v))}</span>
                  </p>
                )}
                <div className="flex flex-wrap gap-1 pt-1">
                  <Badge tone={v.condition === "NUEVO" ? "teal" : undefined} icon={false}>{v.condition === "NUEVO" ? "Nuevo" : "Usado"}</Badge>
                  <Badge tone={v.ownership === "CONSIGNADO" ? "violet" : undefined} icon={false}>{v.ownership === "CONSIGNADO" ? "Consignado" : "Propio"}</Badge>
                  {v.published && <Badge tone="green">En la web</Badge>}
                  {v.source === "INSTAGRAM_OFFICIAL" && <Badge tone="teal">Instagram</Badge>}
                </div>
              </div>
            </Link>
          ))}
          <div className="col-span-full">
            <Pagination page={page} pages={Math.ceil(total / 24)} href={(p) => link({ page: String(p) })} />
          </div>
        </div>
      ) : (
        <Card bodyClass="p-0">
          <Table>
            <thead>
              <tr>
                <th>Foto</th>
                <th>Código / Vehículo</th>
                <th>Patente / VIN</th>
                <th className="num">Km</th>
                <th>Transm. / Comb.</th>
                <th>Sucursal</th>
                <th>Estado</th>
                <th className="num">Precio</th>
                {showCost && (
                  <>
                    <th className="num">Costo</th>
                    <th className="num">Margen</th>
                  </>
                )}
                <th className="num">Días</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => {
                const p = prep(v), margin = v.price - v.cost - p;
                return (
                  <tr key={v.id}>
                    <td>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={v.photos[0]?.url ?? "/demo/placeholder.svg"} alt="" className="h-10 w-14 rounded object-cover" loading="lazy" />
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        {v.stockCode && (
                          <span className="font-mono text-[10px] font-bold text-muted bg-surface-2 px-1 rounded">
                            {v.stockCode}
                          </span>
                        )}
                        <Link href={`/panel/inventario/${v.id}`} className="font-medium hover:text-accent">
                          {v.brand} {v.model} {v.year}
                        </Link>
                      </div>
                      <div className="flex gap-1 text-xs text-muted">
                        <span className="truncate max-w-[180px]">{v.version}</span>
                        <Badge tone={v.condition === "NUEVO" ? "teal" : undefined} icon={false}>{v.condition === "NUEVO" ? "Nuevo" : "Usado"}</Badge>
                        {v.source === "INSTAGRAM_OFFICIAL" && <Badge tone="teal">IG</Badge>}
                      </div>
                    </td>
                    <td className="text-xs">{fmtPlate(v.plate)}<div className="text-muted">{v.vin ?? "—"}</div></td>
                    <td className="num">{km(v.km)}</td>
                    <td className="text-xs">{v.transmission}<div className="text-muted">{v.fuel}</div></td>
                    <td>{v.branch.name.replace("Stroker ", "")}</td>
                    <td>
                      <StatusBadge map={VEHICLE_STATUS} value={v.status} />
                      {v.published && <div className="mt-0.5 text-[11px] text-emerald-700 dark:text-emerald-400">En la web</div>}
                    </td>
                    <td className="num font-bold text-accent">{clp(v.price)}</td>
                    {showCost && (
                      <>
                        <td className="num">{clp(v.cost)}</td>
                        <td className={cx("num", margin < 0 && "text-red-700")} title="Precio − costo − preparación">{clp(margin)}</td>
                      </>
                    )}
                    <td className={cx("num", daysBetween(v.stockSince) > 90 && "font-semibold text-amber-700 dark:text-amber-400")}>{daysBetween(v.stockSince)}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <Pagination page={page} pages={Math.ceil(total / 24)} href={(p) => link({ page: String(p) })} />
        </Card>
      )}
      {showCost && (
        <p className="mt-2 text-[11px] text-muted">
          Margen estimado = precio publicado − costo − preparación registrada. Días en stock desde el ingreso.
        </p>
      )}
    </>
  );
}
