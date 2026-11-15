import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSite, track } from "@/server/web";
import { BUSINESS } from "@/lib/business";
import { clp } from "@/lib/format";

/** Clic a WhatsApp desde la vitrina: se registra como clic (no como contacto) y redirige a wa.me con mensaje prellenado. */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const { cfg } = await getSite();
  const v = p.get("v")
    ? await db.vehicle.findFirst({
        where: { id: p.get("v")!, published: true },
        select: { id: true, stockCode: true, brand: true, model: true, year: true, slug: true, price: true, status: true },
      })
    : null;

  // Siempre el número confirmado del negocio
  const number = (cfg.whatsapp || BUSINESS.whatsapp).replace(/\D/g, "");
  
  let text = "Hola, quiero más información sobre el catálogo de Automotora Stroker.";
  if (v) {
    const code = v.stockCode ? ` (Cód. ${v.stockCode})` : "";
    if (v.status === "VENDIDO") {
      text = `Hola, vi el ${v.brand} ${v.model} ${v.year}${code} que figura vendido en Stroker. ¿Tienen disponible una unidad similar o nuevo ingreso? ${req.nextUrl.origin}/autos/${v.slug}`;
    } else {
      text = `Hola, me interesa el ${v.brand} ${v.model} ${v.year}${code} publicado en ${clp(v.price)}. ¿Sigue disponible? ${req.nextUrl.origin}/autos/${v.slug}`;
    }
  }

  const ua = req.headers.get("user-agent") ?? "";
  if (!/bot|crawl|spider/i.test(ua))
    await track("WHATSAPP_CLICK", v ? `/autos/${v.slug}` : req.headers.get("referer")?.replace(req.nextUrl.origin, "") ?? "/", `${req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local"}|${ua}`, v?.id);
  
  return Response.redirect(`https://wa.me/${number}?text=${encodeURIComponent(text)}`, 302);
}
