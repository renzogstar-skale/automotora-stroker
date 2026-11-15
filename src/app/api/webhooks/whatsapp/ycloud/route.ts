import type { NextRequest } from "next/server";
import { applyStatuses, parseYcloud, receiveInbound, verifyYcloud } from "@/server/whatsapp";

/** Eventos de YCloud. Firma YCloud-Signature (t=…,s=…) obligatoria. */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifyYcloud(raw, req.headers.get("ycloud-signature"))) return new Response("Firma inválida", { status: 401 });
  let p: unknown;
  try { p = JSON.parse(raw); } catch { return new Response("JSON inválido", { status: 400 }); }
  const { inbound, statuses } = parseYcloud(p);
  const r = await receiveInbound("YCLOUD", inbound);
  return Response.json({ ...r, statuses: await applyStatuses(statuses) });
}
