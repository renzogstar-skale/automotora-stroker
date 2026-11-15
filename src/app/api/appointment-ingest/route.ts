import type { NextRequest } from "next/server";
import { ingestAppointment } from "@/server/ingest";
import { handleIngest } from "@/server/ingest-route";

/** Crea únicamente una cita, con vínculo opcional a un lead existente de la misma sucursal. */
export const POST = (req: NextRequest) => handleIngest(req, "appointment-ingest", "appointments:write", ingestAppointment);
