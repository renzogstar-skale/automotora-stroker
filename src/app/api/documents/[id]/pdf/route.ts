import { getActor } from "@/lib/auth";
import { can, Forbidden } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { documentPdf, loadDocFor } from "@/server/documents";

/** PDF privado: requiere sesión, permiso de documentos y pertenecer a la sucursal del documento. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await getActor();
  if (!a) return new Response("No autenticado", { status: 401 });
  if (!can(a, "documents")) return new Response("Sin permiso", { status: 403 });
  const { id } = await params;
  let d;
  try { d = await loadDocFor(a, id); } catch (e) {
    return e instanceof Forbidden ? new Response(e.message, { status: 403 }) : new Response("No encontrado", { status: 404 });
  }
  const bytes = await documentPdf(d.id);
  await audit(a, "document.download", "Document", id, `Descarga PDF ${d.folio}`);
  return new Response(new Uint8Array(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${d.folio}.pdf"`, "Cache-Control": "private, no-store" } });
}
