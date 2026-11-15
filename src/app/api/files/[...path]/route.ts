import { getActor } from "@/lib/auth";
import { readStored } from "@/server/storage";

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", pdf: "application/pdf" };
/** Archivos públicos (fotos) sin sesión; archivos privados solo con sesión activa. */
export async function GET(_: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path;
  // Los PDF de documentos solo se sirven por /api/documents/[id]/pdf, que valida sucursal y vendedor.
  if (parts[0] === "private" && parts[1] === "documents") return new Response("No encontrado", { status: 404 });
  if (parts[0] !== "public" && !(await getActor())) return new Response("No autorizado", { status: 401 });
  try {
    const buf = await readStored(parts.join("/"));
    return new Response(new Uint8Array(buf), { headers: { "Content-Type": TYPES[parts.at(-1)!.split(".").pop()!] ?? "application/octet-stream", "Cache-Control": parts[0] === "public" ? "public, max-age=86400" : "private, no-store" } });
  } catch { return new Response("No encontrado", { status: 404 }); }
}
