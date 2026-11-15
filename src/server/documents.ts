import { createHash } from "node:crypto";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { db, type Tx } from "@/lib/db";
import { audit } from "@/lib/audit";
import { clp, date, km } from "@/lib/format";
import { assert, assertBranch, Forbidden, type Actor } from "@/lib/rbac";
import { AppError, conflict, notFound } from "./errors";
import { getSetting } from "./settings";
import { readStored, savePrivateFile } from "./storage";

/** Alcance de lectura: admin todo; resto, su sucursal o sus propios documentos sin sucursal. */
export const docScope = (a: Actor) => (a.role === "ADMIN" ? {} : { OR: [{ branchId: { in: a.branchIds } }, { branchId: null, createdById: a.id }] });

/** Carga un documento verificando permiso, sucursal y (para vendedores) que la venta sea suya. Lanza 403/404. */
export async function loadDocFor(actor: Actor, id: string) {
  assert(actor, "documents");
  const d = await db.document.findFirst({ where: { id, ...docScope(actor) } });
  if (!d) throw notFound("Documento no encontrado.");
  if (actor.role === "VENDEDOR" && d.createdById !== actor.id && d.saleId) {
    const s = await db.sale.findUnique({ where: { id: d.saleId } });
    if (s && s.sellerId !== actor.sellerId) throw new Forbidden("Documento de otro vendedor.");
  }
  return d;
}

const PREFIX: Record<string, string> = { VENTA: "NV", RESERVA: "RS", CONSIGNACION: "CC" };

/** Folio único y correlativo por tipo y año (incremento atómico en la base). */
export async function nextFolio(type: string, t: Tx | typeof db = db) {
  const year = new Date().getFullYear();
  const key = `${type}-${year}`;
  const rows = await t.$queryRaw<{ last: number }[]>`
    INSERT INTO "FolioCounter" (key, last) VALUES (${key}, 1)
    ON CONFLICT (key) DO UPDATE SET last = "FolioCounter".last + 1 RETURNING last`;
  return `${PREFIX[type]}-${year}-${String(rows[0].last).padStart(5, "0")}`;
}

type Refs = { vehicleId?: string; saleId?: string; reservationId?: string; consignmentId?: string };

/** Autocompleta los campos disponibles desde la venta, reserva, consignación o vehículo. */
export async function buildData(type: string, r: Refs) {
  const company = await getSetting("company");
  const sale = r.saleId ? await db.sale.findUnique({ where: { id: r.saleId }, include: { contact: true, vehicle: true, seller: true, payments: true } }) : null;
  const res = r.reservationId ? await db.reservation.findUnique({ where: { id: r.reservationId }, include: { contact: true, vehicle: true } }) : null;
  const cons = r.consignmentId ? await db.consignment.findUnique({ where: { id: r.consignmentId }, include: { owner: true, vehicle: true } }) : null;
  const v = sale?.vehicle ?? res?.vehicle ?? cons?.vehicle ?? (r.vehicleId ? await db.vehicle.findUnique({ where: { id: r.vehicleId } }) : null);
  const c = sale?.contact ?? res?.contact ?? cons?.owner ?? null;
  return {
    empresa: { nombre: company.name, rut: company.rut, direccion: company.address },
    fecha: date(new Date()),
    cliente: { nombre: c?.name ?? "", rut: c?.rut ?? "", telefono: c?.phone ?? "", correo: c?.email ?? "" },
    vehiculo: v ? { marca: v.brand, modelo: v.model, version: v.version, anio: String(v.year), patente: v.plate, vin: v.vin ?? "", kilometraje: km(v.km), color: v.color, precio: clp(v.price) } : {},
    venta: sale ? { numero: String(sale.number), precio: clp(sale.finalPrice), descuento: clp(sale.discount), forma_pago: sale.payMethod, vendedor: sale.seller.name } : {},
    reserva: res ? { monto: clp(res.amount), vence: date(res.expiresAt) } : {},
    consignacion: cons ? { modalidad: cons.modality === "FISICA" ? "Física" : "Online", monto_acordado: clp(cons.agreedPrice), vigencia: date(cons.endDate) } : {},
    _type: type,
  };
}

export function render(body: string, data: Record<string, unknown>) {
  return body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path: string) => {
    const val = path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), data);
    return val == null || val === "" ? "________" : String(val);
  });
}

export async function createDocument(type: string, refs: Refs, actor: Actor, overrides?: Record<string, unknown>) {
  assert(actor, "documents");
  const tpl = await db.documentTemplate.findFirst({ where: { type, active: true } });
  if (!tpl) throw new AppError("No hay plantilla activa para este tipo.");
  const data = { ...(await buildData(type, refs)), ...(overrides ?? {}) };
  const anyData = data as unknown as Record<string, Record<string, string>>;
  const branchId = refs.vehicleId || refs.saleId || refs.reservationId || refs.consignmentId
    ? (await db.vehicle.findFirst({ where: { OR: [{ id: refs.vehicleId ?? "" }, { sales: { some: { id: refs.saleId ?? "" } } }, { reservations: { some: { id: refs.reservationId ?? "" } } }, { consignment: { id: refs.consignmentId ?? "" } }] } }))?.branchId
    : undefined;
  if (branchId) assertBranch(actor, branchId);
  const doc = await db.$transaction(async (t) =>
    t.document.create({
      data: {
        folio: await nextFolio(type, t), type, templateId: tpl.id, templateVersion: tpl.version, data: JSON.parse(JSON.stringify(data)),
        vehicleId: refs.vehicleId ?? null, saleId: refs.saleId ?? null, reservationId: refs.reservationId ?? null, consignmentId: refs.consignmentId ?? null,
        clientName: anyData.cliente?.nombre || null, plate: anyData.vehiculo?.patente || null, branchId: branchId ?? null, createdById: actor.id,
      },
    }));
  await audit(actor, "document.create", "Document", doc.id, `Borrador ${doc.folio}`);
  return doc;
}

/** Emitir congela la versión de la plantilla y los datos usados. */
export async function emitDocument(id: string, actor: Actor) {
  const d = await loadDocFor(actor, id);
  if (d.status !== "BORRADOR") throw conflict("Solo se emiten borradores.");
  const tpl = await db.documentTemplate.findUniqueOrThrow({ where: { id: d.templateId } });
  const emittedAt = new Date();
  const bytes = await renderPdf({ ...d, status: "EMITIDO", bodySnapshot: tpl.body });
  const pdfPath = await savePrivateFile(`documents/${d.folio}.pdf`, bytes);
  const pdfSha256 = createHash("sha256").update(bytes).digest("hex");
  const n = await db.document.updateMany({
    where: { id, status: "BORRADOR" },
    data: { status: "EMITIDO", emittedAt, templateVersion: tpl.version, templateName: tpl.name, bodySnapshot: tpl.body, pdfPath, pdfSha256 },
  });
  if (!n.count) throw conflict("El documento ya fue emitido.");
  await audit(actor, "document.emit", "Document", id, `Emitido ${d.folio} (plantilla «${tpl.name}» v${tpl.version}, sha256 ${pdfSha256.slice(0, 12)})`);
}

const winAnsi = (s: string) => s.replace(/[→]/g, "->").replace(/[^\x0A\x20-\x7E\xA0-\xFF–—•€]/g, "");

/** Emitidos/anulados: devuelve el PDF archivado al emitir (byte a byte). Borradores: vista previa con la plantilla vigente. */
export async function documentPdf(id: string) {
  const d = await db.document.findUnique({ where: { id } });
  if (!d) throw notFound();
  if (d.pdfPath) return new Uint8Array(await readStored(d.pdfPath));
  return renderPdf(d);
}

type PdfSource = { folio: string; status: string; templateId: string; bodySnapshot: string | null; data: unknown };
async function renderPdf(d: PdfSource) {
  const tpl = await db.documentTemplate.findUniqueOrThrow({ where: { id: d.templateId } });
  const text = winAnsi(render(d.bodySnapshot ?? tpl.body, { ...(d.data as Record<string, unknown>), folio: d.folio }));
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595, 842]);
  let y = 790;
  page.drawText("AUTOMOTORA STROKER", { x: 50, y, size: 14, font: bold, color: rgb(0.75, 0.1, 0.12) });
  page.drawText(winAnsi(`Folio ${d.folio}${d.status === "BORRADOR" ? "  ·  BORRADOR (vista previa)" : ""}`), { x: 360, y, size: 10, font: bold });
  y -= 30;
  for (const para of text.split("\n")) {
    const words = para.split(" ");
    let line = "";
    const flush = () => {
      if (y < 60) { page = pdf.addPage([595, 842]); y = 790; }
      const isTitle = line.startsWith("# ");
      page.drawText(isTitle ? line.slice(2) : line, { x: 50, y, size: isTitle ? 13 : 10, font: isTitle ? bold : font });
      y -= isTitle ? 20 : 14; line = "";
    };
    for (const w of words) {
      if (font.widthOfTextAtSize(`${line} ${w}`, 10) > 495) flush();
      line = line ? `${line} ${w}` : w;
    }
    flush();
  }
  return pdf.save();
}
