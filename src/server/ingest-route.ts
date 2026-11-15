import type { NextRequest } from "next/server";
import { authenticate, withIdempotency, type IngestResult } from "./ingest";
import type { ApiKey } from "@prisma/client";

const MAX_BODY = 32_000;

/** Envoltura común de los endpoints de ingesta: autentica por x-api-key, valida JSON, aplica idempotencia y registra. */
export async function handleIngest(req: NextRequest, endpoint: string, perm: string, fn: (k: ApiKey, body: unknown) => Promise<IngestResult>) {
  const auth = await authenticate(req.headers.get("x-api-key"), perm);
  if (!("hash" in auth)) return Response.json(auth.body, { status: auth.status });
  const k: ApiKey = auth;
  const raw = await req.text();
  if (raw.length > MAX_BODY) return Response.json({ error: "Cuerpo demasiado grande." }, { status: 413 });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return Response.json({ error: "JSON inválido." }, { status: 400 }); }
  const r = await withIdempotency(k, endpoint, req.headers.get("idempotency-key"), raw, () => fn(k, body));
  return Response.json(r.body, { status: r.status, headers: r.replay ? { "idempotent-replay": "true" } : {} });
}
