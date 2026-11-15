import type { NextRequest } from "next/server";
import { safeEqual } from "@/lib/crypto";
import { applyStatuses, parseMeta, receiveInbound, verifyMeta } from "@/server/whatsapp";

/** Verificación de suscripción de Meta: hub.verify_token debe coincidir con WA_META_VERIFY_TOKEN. */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams, token = process.env.WA_META_VERIFY_TOKEN;
  if (p.get("hub.mode") === "subscribe" && token && safeEqual(p.get("hub.verify_token") ?? "", token)) return new Response(p.get("hub.challenge") ?? "");
  return new Response("No autorizado", { status: 403 });
}

/** Mensajes y estados de Meta Cloud API. Firma X-Hub-Signature-256 obligatoria. */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifyMeta(raw, req.headers.get("x-hub-signature-256"))) return new Response("Firma inválida", { status: 401 });
  let p: unknown;
  try { p = JSON.parse(raw); } catch { return new Response("JSON inválido", { status: 400 }); }
  const { inbound, statuses } = parseMeta(p);
  const r = await receiveInbound("META", inbound);
  return Response.json({ ...r, statuses: await applyStatuses(statuses) });
}
