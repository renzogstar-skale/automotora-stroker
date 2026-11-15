import type { NextRequest } from "next/server";
import { ingestLead } from "@/server/ingest";
import { handleIngest } from "@/server/ingest-route";

/** Crea o actualiza un lead por external_id (sucursal derivada de la clave) y vincula una cita si llega válida. */
export const POST = (req: NextRequest) => handleIngest(req, "n8n-lead-ingest", "leads:write", ingestLead);
