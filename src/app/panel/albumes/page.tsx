import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { guard } from "@/lib/auth";
import { db } from "@/lib/db";
import { branchWhere } from "@/lib/rbac";
import { sp } from "@/lib/period";
import { VEHICLE_STATUS } from "@/lib/labels";
import { daysBetween } from "@/lib/format";
import { Badge, Card, Empty, PageHeader, StatusBadge, Tabs } from "@/components/ui";

const TABS = { faltan: "Faltan fotos", listos: "Listos", web: "En la web", todos: "Todos" } as const;
export default async function Albums({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const a = await guard("albums");
  const s = await searchParams;
  const tab = (sp(s, "tab") ?? "faltan") as keyof typeof TABS;
  const stock: Prisma.VehicleWhereInput = { ...branchWhere(a), status: { in: ["DISPONIBLE", "RESERVADO"] } };
  const wheres: Record<string, Prisma.VehicleWhereInput> = {
    faltan: { ...stock, photos: { none: {} } }, listos: { ...stock, photos: { some: {} }, published: false }, web: { ...stock, published: true }, todos: branchWhere(a),
  };
  const counts = await Promise.all(Object.keys(TABS).map((k) => db.vehicle.count({ where: wheres[k] })));
  const rows = await db.vehicle.findMany({ where: wheres[tab], include: { photos: { orderBy: { order: "asc" }, take: 1, where: { isCover: true } }, _count: { select: { photos: true } } }, orderBy: { stockSince: "asc" }, take: 120 });
  return (
    <>
      <PageHeader title="Álbumes" desc="Preparación de fotografías y publicación en la vitrina. Al vender o retirar una unidad se despublica automáticamente." />
      <Tabs items={Object.entries(TABS).map(([k, l], i) => ({ href: `/panel/albumes?tab=${k}`, label: l, active: tab === k, count: counts[i] }))} />
      {rows.length === 0 ? <Card><Empty title="Nada pendiente en esta pestaña" /></Card> : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {rows.map((v) => (
            <Link key={v.id} href={`/panel/albumes/${v.id}`} className="card overflow-hidden hover:border-accent/50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={v.photos[0]?.url ?? "/demo/placeholder.svg"} alt="" className="aspect-[4/3] w-full object-cover" loading="lazy" />
              <div className="space-y-1 p-2.5 text-sm">
                <p className="truncate font-medium">{v.brand} {v.model} {v.year}</p>
                <p className="text-xs text-muted">{v.plate} · {v._count.photos} fotos · {daysBetween(v.stockSince)} días</p>
                <div className="flex flex-wrap gap-1"><StatusBadge map={VEHICLE_STATUS} value={v.status} />{v.published && <Badge tone="green">En la web</Badge>}</div>
              </div>
            </Link>))}
        </div>)}
    </>
  );
}
