import Link from "next/link";
import { ArrowRight, CalendarCheck, HandCoins, MapPin, MessageCircle, Phone, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { publicSelect, publicWhere } from "@/server/web";
import { Shell, VehicleCard, loadSite, trackView, waLink } from "./site";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await loadSite(await searchParams);
  const { cfg, branches } = ctx.site;
  const [chosen, latest, brands, types] = await Promise.all([
    cfg.featuredIds.length ? db.vehicle.findMany({ where: { ...publicWhere, id: { in: cfg.featuredIds } }, select: publicSelect }) : [],
    db.vehicle.findMany({ where: publicWhere, select: publicSelect, orderBy: [{ featured: "desc" }, { publishedAt: "desc" }], take: 8 }),
    db.vehicle.findMany({ where: publicWhere, distinct: ["brand"], select: { brand: true }, orderBy: { brand: "asc" } }),
    db.vehicle.findMany({ where: publicWhere, distinct: ["bodyType"], select: { bodyType: true }, orderBy: { bodyType: "asc" } }),
  ]);
  const featured = chosen.length ? cfg.featuredIds.map((id) => chosen.find((v) => v.id === id)!).filter(Boolean) : latest;
  const total = await db.vehicle.count({ where: publicWhere });
  if (!ctx.preview) await trackView("VIEW", "/");
  return (
    <Shell {...ctx}>
      <section className="relative isolate overflow-hidden bg-graphite">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {cfg.heroImage && <img src={cfg.heroImage} alt="" className="absolute inset-0 -z-10 size-full object-cover opacity-45" />}
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
          <h1 className="max-w-3xl text-3xl font-bold tracking-tight text-white sm:text-5xl">{cfg.heroTitle}</h1>
          <p className="mt-4 max-w-2xl text-base text-white/85 sm:text-lg">{cfg.heroSubtitle}</p>
          <form action="/autos" className="mt-8 grid max-w-3xl gap-2 rounded-xl bg-surface p-3 shadow-lg sm:grid-cols-4">
            {ctx.preview && <input type="hidden" name="preview" value="1" />}
            <select name="marca" className="input" aria-label="Marca"><option value="">Todas las marcas</option>{brands.map((b) => <option key={b.brand}>{b.brand}</option>)}</select>
            <select name="tipo" className="input" aria-label="Tipo"><option value="">Todos los tipos</option>{types.map((t) => <option key={t.bodyType}>{t.bodyType}</option>)}</select>
            <select name="precio" className="input" aria-label="Precio máximo"><option value="">Cualquier precio</option>{[8, 12, 16, 20, 25, 35].map((m) => <option key={m} value={m * 1e6}>Hasta ${m} millones</option>)}</select>
            <button className="btn btn-primary">Buscar {total} autos</button>
          </form>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="mb-5 flex items-end justify-between gap-3">
          <h2 className="text-2xl font-bold tracking-tight">Destacados</h2>
          <Link href={ctx.href("/autos")} className="link flex items-center gap-1 text-sm font-medium">Ver todo el catálogo <ArrowRight className="size-4" /></Link>
        </div>
        {featured.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{featured.map((v) => <VehicleCard key={v.id} v={v} href={ctx.href} />)}</div>
          : <p className="text-muted">Pronto publicaremos nuevas unidades.</p>}
      </section>

      <section className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:grid-cols-3 sm:px-6">
          {[[ShieldCheck, "Documentación a la vista", "Pide el CAV y los papeles de la unidad antes de reservar."], [CalendarCheck, "Test drive agendado", "Elige la unidad y el horario desde su ficha."], [HandCoins, "Consigna tu auto", "Lo publicamos y vendemos por ti."]].map(([I, t, d]) => {
            const Icon = I as typeof ShieldCheck;
            return <div key={t as string} className="flex gap-3"><Icon className="size-6 shrink-0 text-accent" /><div><p className="font-semibold">{t as string}</p><p className="text-sm text-muted">{d as string}</p></div></div>;
          })}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-12 sm:px-6 lg:grid-cols-2">
        <div className="card p-6"><h2 className="text-xl font-bold">¿Quieres vender tu auto?</h2><p className="mt-2 text-sm text-muted">Te ayudamos a venderlo en consignación física u online: tasación, fotos profesionales, publicación y trámites.</p><Link href={ctx.href("/consignar")} className="btn btn-primary mt-4">Consignar mi auto</Link></div>
        <div className="card p-6"><h2 className="text-xl font-bold">Conversemos</h2><p className="mt-2 text-sm text-muted">{cfg.aboutText}</p><div className="mt-4 flex flex-wrap gap-2"><a href={waLink()} className="btn btn-primary"><MessageCircle className="size-4" />WhatsApp</a>{cfg.phone && <a href={`tel:${cfg.phone.replace(/\s/g, "")}`} className="btn"><Phone className="size-4" />{cfg.phone}</a>}</div></div>
      </section>

      {cfg.showBranches && (
        <section id="sucursales" className="mx-auto max-w-7xl px-4 pb-14 sm:px-6">
          <h2 className="mb-5 text-2xl font-bold tracking-tight">Sucursales</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {branches.filter((b) => b.visible).map((b) => (
              <div key={b.id} className="card p-5 text-sm">
                <p className="text-base font-semibold">{b.name}</p>
                <p className="mt-2 flex items-start gap-2 text-muted"><MapPin className="mt-0.5 size-4 shrink-0" />{b.address}, {b.comuna}, {b.region}</p>
                <p className="mt-1 text-muted">{b.hours}</p>
                <div className="mt-3 flex flex-wrap gap-2"><a href={waLink(undefined, b.id)} className="btn btn-sm"><MessageCircle className="size-4" />{b.whatsapp}</a><a href={`tel:${b.phone.replace(/\s/g, "")}`} className="btn btn-sm"><Phone className="size-4" />{b.phone}</a><Link href={ctx.href(`/autos?sucursal=${b.id}`)} className="btn btn-sm">Ver autos</Link></div>
              </div>
            ))}
          </div>
        </section>
      )}
    </Shell>
  );
}
