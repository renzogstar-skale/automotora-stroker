"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { guard } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { run, str, opt, type ActionState } from "@/lib/action";
import { createDocument, emitDocument, loadDocFor } from "@/server/documents";
import { AppError, conflict } from "@/server/errors";

export async function createDocAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("documents");
  let id = "";
  const r = await run(async () => {
    const manual = str(fd, "mode") === "manual";
    const overrides = manual ? { cliente: { nombre: str(fd, "cName"), rut: str(fd, "cRut"), telefono: str(fd, "cPhone"), correo: str(fd, "cEmail") }, vehiculo: { marca: str(fd, "vBrand"), modelo: str(fd, "vModel"), patente: str(fd, "vPlate").toUpperCase(), anio: str(fd, "vYear"), version: str(fd, "vVersion"), vin: str(fd, "vVin"), kilometraje: str(fd, "vKm"), color: str(fd, "vColor"), precio: str(fd, "vPrice") } } : undefined;
    const [kind, refId] = str(fd, "ref").split(":");
    // Ficha elegida en el selector > ficha precargada desde la URL. En modo manual no se vincula ficha.
    const pick = (k: string, field: string) => (manual ? undefined : kind ? (kind === k ? refId : undefined) : opt(fd, field) ?? undefined);
    const type = str(fd, "type");
    if (!["VENTA", "RESERVA", "CONSIGNACION"].includes(type)) throw new AppError("Tipo de documento inválido.");
    if (manual && !str(fd, "cName")) throw new AppError("Indica el nombre del cliente.");
    if (!manual && !kind && !["vehicleId", "saleId", "reservationId", "consignmentId"].some((k) => opt(fd, k))) throw new AppError("Elige la ficha vinculada o usa ingreso manual.");
    const d = await createDocument(type, { vehicleId: pick("vehicle", "vehicleId"), saleId: pick("sale", "saleId"), reservationId: pick("reservation", "reservationId"), consignmentId: pick("consignment", "consignmentId") }, a, overrides);
    id = d.id;
  });
  if (r?.error) return r;
  redirect(`/panel/documentos/${id}`);
}
export async function saveDraftAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("documents");
  return run(async () => {
    const d = await loadDocFor(a, str(fd, "id"));
    if (d.status !== "BORRADOR") throw conflict("Un documento emitido no se puede editar; anúlalo y genera otro.");
    const data = JSON.parse(JSON.stringify(d.data)) as Record<string, Record<string, string>>;
    for (const [k, v] of fd.entries()) if (k.includes(".")) { const [g, f] = k.split("."); data[g] = { ...(data[g] ?? {}), [f]: String(v) }; }
    await db.document.update({ where: { id: d.id }, data: { data, clientName: data.cliente?.nombre || d.clientName, plate: data.vehiculo?.patente || d.plate } });
    await audit(a, "document.draft", "Document", d.id, `Borrador ${d.folio} actualizado`);
    revalidatePath(`/panel/documentos/${d.id}`);
  }, "Borrador guardado.");
}
export async function emitAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("documents");
  return run(async () => { await emitDocument(str(fd, "id"), a); revalidatePath(`/panel/documentos/${str(fd, "id")}`); }, "Documento emitido.");
}
export async function voidDocAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("documents");
  return run(async () => {
    if (!str(fd, "reason")) throw new AppError("Indica el motivo.");
    const d = await loadDocFor(a, str(fd, "id"));
    const n = await db.document.updateMany({ where: { id: d.id, status: "EMITIDO" }, data: { status: "ANULADO" } });
    if (!n.count) throw conflict("Solo se anulan documentos emitidos.");
    await audit(a, "document.void", "Document", str(fd, "id"), `Documento anulado: ${str(fd, "reason")}`);
    revalidatePath(`/panel/documentos/${str(fd, "id")}`);
  }, "Documento anulado.");
}
/** Editar una plantilla crea una nueva versión; los documentos emitidos conservan la versión y el texto usados. */
export async function templateAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("documents.templates");
  return run(async () => {
    const t = await db.documentTemplate.findUniqueOrThrow({ where: { id: str(fd, "id") } });
    const body = str(fd, "body");
    if (body === t.body && str(fd, "name") === t.name) return;
    await db.documentTemplate.update({ where: { id: t.id }, data: { body, name: str(fd, "name"), version: t.version + 1, versions: { create: { version: t.version + 1, body } } } });
    await audit(a, "template.update", "DocumentTemplate", t.id, `Plantilla ${t.name} v${t.version + 1}`);
    revalidatePath("/panel/documentos");
  }, "Nueva versión de la plantilla guardada.");
}
