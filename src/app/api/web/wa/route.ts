import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSite, publicWhere, track } from "@/server/web";

/** Clic a WhatsApp desde la vitrina: se registra como clic (no como contacto) y redirige a wa.me con mensaje prellenado. */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const { cfg, branches } = await getSite();
  const v = p.get("v") ? await db.vehicle.findFirst({ where: { id: p.get("v")!, ...publicWhere }, select: { id: true, brand: true, model: true, year: true, slug: true, branchId: true } }) : null;
  const branch = branches.find((b) => b.id === (v?.branchId ?? p.get("b")));
  const number = (branch?.whatsapp ?? cfg.whatsapp).replace(/\D/g, "");
  const text = v ? `Hola, me interesa el ${v.brand} ${v.model} ${v.year} (${req.nextUrl.origin}/autos/${v.slug})` : "Hola, quiero más información.";
  const ua = req.headers.get("user-agent") ?? "";
  if (!/bot|crawl|spider/i.test(ua))
    await track("WHATSAPP_CLICK", v ? `/autos/${v.slug}` : req.headers.get("referer")?.replace(req.nextUrl.origin, "") ?? "/", `${req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local"}|${ua}`, v?.id);
  return Response.redirect(`https://wa.me/${number}?text=${encodeURIComponent(text)}`, 302);
}
