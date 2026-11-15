import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

/**
 * Almacenamiento de archivos. Local: carpeta ./storage (public = fotos de la vitrina, private = documentos).
 * En Vercel configurar STORAGE_DRIVER=supabase|blob (pendiente de credenciales; ver README).
 */
const ROOT = path.join(process.cwd(), "storage");
const IMG = new Set(["image/jpeg", "image/png", "image/webp", "image/heic"]);

export async function savePublicImage(folder: string, file: File) {
  if (!IMG.has(file.type)) throw new Error(`Formato no admitido: ${file.type || "desconocido"}`);
  if (file.size > 8 * 1024 * 1024) throw new Error("Cada foto debe pesar menos de 8 MB.");
  const ext = file.type.split("/")[1].replace("jpeg", "jpg");
  const rel = path.posix.join("public", folder.replace(/[^\w-]/g, ""), `${randomUUID()}.${ext}`);
  await mkdir(path.join(ROOT, path.dirname(rel)), { recursive: true });
  await writeFile(path.join(ROOT, rel), Buffer.from(await file.arrayBuffer()));
  return `/api/files/${rel}`;
}
/** Guarda un archivo privado (solo servido por rutas con control de acceso). No sobrescribe: falla si ya existe. */
export async function savePrivateFile(name: string, bytes: Uint8Array) {
  const rel = path.posix.join("private", ...name.split("/").map((p) => p.replace(/[^\w.-]/g, "")));
  await mkdir(path.join(ROOT, path.dirname(rel)), { recursive: true });
  await writeFile(path.join(ROOT, rel), bytes, { flag: "wx" });
  return rel;
}
export async function readStored(rel: string) {
  const full = path.join(ROOT, rel);
  if (!full.startsWith(ROOT + path.sep)) throw new Error("Ruta inválida");
  return readFile(full);
}
export async function removeStored(url: string) {
  if (!url.startsWith("/api/files/")) return;
  try { await unlink(path.join(ROOT, url.replace("/api/files/", ""))); } catch { /* ya no existe */ }
}
