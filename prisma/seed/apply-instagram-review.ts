// Aplica prisma/seed/instagram-review.json (revisión verificada de cada publicación de Instagram)
// a InstagramImport y Vehicle. Lo usan seed-stroker.ts (cada build) y scripts/sync-ig-review.mts (vista previa/respaldo).
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";

type Review = {
  imports: Record<string, { status: string; commercialStatus: string; note: string }>;
  vehicles: Record<string, Record<string, unknown>>;
};
export type ReviewChange = { target: string; field: string; from: unknown; to: unknown };

const shortcode = (url: string) => url.match(/\/(?:p|reel)\/([^/]+)/)?.[1] ?? "";

export async function applyInstagramReview(db: PrismaClient, { apply }: { apply: boolean }) {
  const file = path.resolve(process.cwd(), "prisma/seed/instagram-review.json");
  if (!existsSync(file)) return [];
  const review = JSON.parse(readFileSync(file, "utf8")) as Review;

  const imports = await db.instagramImport.findMany();
  const vehicles = await db.vehicle.findMany({
    where: { source: "INSTAGRAM_OFFICIAL" },
    include: { photos: { orderBy: { order: "asc" } } },
  });
  const changes: ReviewChange[] = [];

  for (const imp of imports) {
    const code = shortcode(imp.postUrl);
    const r = review.imports[code];
    if (!r) continue;
    const v = vehicles.find((x) => x.instagramUrl === imp.postUrl);
    // Fotos en almacenamiento del proyecto (no CDN temporal de Instagram)
    const localPhotos = v?.photos.length ? v.photos.map((p) => p.url) : [`/inventory/stroker/ig/${code}.jpg`];
    const next = { status: r.status, commercialStatus: r.commercialStatus, localPhotos, vehicleId: v?.id ?? null };
    const data = (imp.extractedData as Record<string, unknown>) || {};
    let dirty = data.reviewNote !== r.note;
    for (const f of ["status", "commercialStatus", "vehicleId"] as const) {
      if (imp[f] !== next[f]) { changes.push({ target: `import ${code}`, field: f, from: imp[f], to: next[f] }); dirty = true; }
    }
    if (JSON.stringify(imp.localPhotos) !== JSON.stringify(localPhotos)) {
      changes.push({ target: `import ${code}`, field: "localPhotos", from: imp.localPhotos[0] ?? "(CDN temporal IG)", to: localPhotos.join(", ") });
      dirty = true;
    }
    if (apply && dirty) {
      await db.instagramImport.update({
        where: { id: imp.id },
        data: {
          ...next,
          extractedData: { ...data, reviewNote: r.note },
          reviewedAt: imp.reviewedAt ?? new Date(),
          reviewedBy: imp.reviewedBy ?? "Sincronización Instagram verificada",
        },
      });
    }
  }

  for (const [code, patch] of Object.entries(review.vehicles)) {
    const v = vehicles.find((x) => x.instagramUrl && shortcode(x.instagramUrl) === code);
    if (!v) { changes.push({ target: code, field: "(vehículo no encontrado)", from: null, to: null }); continue; }
    const diff: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(patch)) {
      const cur = (v as Record<string, unknown>)[k];
      if (JSON.stringify(cur) !== JSON.stringify(val)) { diff[k] = val; changes.push({ target: `vehículo ${v.stockCode}`, field: k, from: cur, to: val }); }
    }
    if (apply && Object.keys(diff).length) await db.vehicle.update({ where: { id: v.id }, data: diff });
  }
  return changes;
}
