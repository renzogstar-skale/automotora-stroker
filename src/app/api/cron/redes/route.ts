import { NextRequest } from "next/server";
import { publishDue } from "@/server/social";

/** Publica las publicaciones programadas vencidas. Vercel Cron envía `Authorization: Bearer $CRON_SECRET`. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("No autorizado", { status: 401 });
  return Response.json(await publishDue());
}
