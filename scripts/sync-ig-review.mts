// Vista previa / aplicación de prisma/seed/instagram-review.json sobre la BD indicada.
// Uso: npx tsx scripts/sync-ig-review.mts [--env .env] [--apply]
// Con --apply crea respaldo en storage/backups/ antes de escribir.
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync } from "node:fs";
import { applyInstagramReview } from "../prisma/seed/apply-instagram-review";

const envFile = process.argv.includes("--env") ? process.argv[process.argv.indexOf("--env") + 1] : ".env";
config({ path: envFile, override: true });
const APPLY = process.argv.includes("--apply");
const db = new PrismaClient();

if (APPLY) {
  mkdirSync("storage/backups", { recursive: true });
  const file = `storage/backups/ig-sync-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  const [imports, vehicles, photos] = await Promise.all([
    db.instagramImport.findMany(),
    db.vehicle.findMany({ where: { source: "INSTAGRAM_OFFICIAL" } }),
    db.vehiclePhoto.findMany({ where: { vehicle: { source: "INSTAGRAM_OFFICIAL" } } }),
  ]);
  writeFileSync(file, JSON.stringify({ env: envFile, imports, vehicles, photos }, null, 2));
  console.log("respaldo:", file);
}
const changes = await applyInstagramReview(db, { apply: APPLY });
console.log(`${APPLY ? "APLICADO" : "VISTA PREVIA"} (${envFile}) — cambios: ${changes.length}`);
for (const c of changes) console.log(`  ${c.target} · ${c.field}: ${JSON.stringify(c.from)} → ${JSON.stringify(c.to)}`);
await db.$disconnect();
