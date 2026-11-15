import { readFileSync } from "fs";
import { db } from "../src/lib/db";

const importedVehicles = JSON.parse(readFileSync("./storage/imported_vehicles_with_local_photos.json", "utf8"));
const rawPosts = JSON.parse(readFileSync("./storage/instagram_raw_posts.json", "utf8"));

const slugify = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

async function main() {
  console.log("=== INICIANDO IMPORTACIÓN DE INVENTARIO INSTAGRAM A BASE DE DATOS ===");

  const antofagasta = await db.branch.findUniqueOrThrow({ where: { code: "ANF" } });
  console.log(`Sucursal destino: ${antofagasta.name} (${antofagasta.id})`);

  let importedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  // 1. First, save all raw posts in InstagramImport
  for (const post of rawPosts) {
    const existing = await db.instagramImport.findUnique({ where: { postUrl: post.url } });
    if (!existing) {
      await db.instagramImport.create({
        data: {
          postUrl: post.url,
          shortcode: post.url.match(/\/(?:p|reel)\/([A-Za-z0-9_-]+)/)?.[1] || null,
          caption: post.caption || "",
          extractedData: post,
          mediaUrls: post.mediaCandidates || [],
          localPhotos: [],
          status: "PENDIENTE",
          commercialStatus: "DISPONIBLE"
        }
      });
    }
  }

  // 2. Process each vehicle
  for (const v of importedVehicles) {
    // Check if vehicle exists by instagramUrl or stockCode
    const existing = await db.vehicle.findFirst({
      where: {
        OR: [
          { instagramUrl: v.instagramUrl },
          { stockCode: v.stockCode }
        ]
      },
      include: { photos: true }
    });

    const baseSlug = slugify(`${v.brand} ${v.model} ${v.year}`);
    const slug = `${baseSlug}-${v.stockCode.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
    const plate = `IG-${v.stockCode.replace("STK-", "").slice(0, 6)}`;

    const vehicleData = {
      slug,
      stockCode: v.stockCode,
      branchId: antofagasta.id,
      brand: v.brand,
      model: v.model,
      version: v.version || "",
      year: v.year || 2022,
      plate,
      km: v.mileage || 0,
      transmission: v.transmission || "Automática",
      fuel: v.fuel || "Bencina",
      bodyType: v.bodyType || "SUV",
      color: v.color || "No especificado",
      condition: "USADO" as const,
      ownership: (v.status === "EN_CONSIGNACION" ? "CONSIGNADO" : "PROPIO") as "PROPIO" | "CONSIGNADO",
      status: v.status as any,
      price: v.priceCLP || 0,
      cost: Math.round((v.priceCLP || 0) * 0.85),
      description: v.description || v.headline,
      originalCaption: v.originalCaption,
      features: v.features,
      instagramUrl: v.instagramUrl,
      instagramPublishedAt: v.instagramPublishedAt ? new Date(v.instagramPublishedAt) : new Date(),
      lastVerifiedAt: new Date(),
      source: "INSTAGRAM_OFFICIAL",
      verificationStatus: v.verificationStatus || "VERIFICADO",
      minDownPayment: v.minDownPayment || null,
      published: v.status !== "POR_CONFIRMAR", // No publicar si está por confirmar
      featured: (v.status === "DISPONIBLE" && v.priceCLP >= 15000000) || v.brand === "Porsche" || v.brand === "BMW",
    };

    let vehicleId: string;

    if (existing) {
      console.log(`[UPDATE] Vehículo ${v.brand} ${v.model} (${v.stockCode}) ya existía.`);
      const updated = await db.vehicle.update({
        where: { id: existing.id },
        data: vehicleData
      });
      vehicleId = updated.id;
      updatedCount++;
    } else {
      console.log(`[CREATE] Creando ${v.brand} ${v.model} ${v.year} (${v.stockCode}) [${v.status}] - $${v.priceCLP?.toLocaleString("es-CL")} CLP...`);
      const created = await db.vehicle.create({
        data: vehicleData
      });
      vehicleId = created.id;
      importedCount++;
    }

    // Manage photos
    if (v.localPhotos && v.localPhotos.length > 0) {
      // Clear existing photos and insert local persistent photos
      await db.vehiclePhoto.deleteMany({ where: { vehicleId } });
      for (let pIdx = 0; pIdx < v.localPhotos.length; pIdx++) {
        await db.vehiclePhoto.create({
          data: {
            vehicleId,
            url: v.localPhotos[pIdx],
            order: pIdx,
            isCover: pIdx === 0
          }
        });
      }
    }

    // Update InstagramImport status to APROBADO
    await db.instagramImport.updateMany({
      where: { postUrl: v.instagramUrl },
      data: {
        status: "APROBADO",
        commercialStatus: v.status,
        vehicleId,
        localPhotos: v.localPhotos || [],
        reviewedAt: new Date()
      }
    });
  }

  console.log("\n=== RESUMEN DE IMPORTACIÓN A BASE DE DATOS ===");
  console.log(`Nuevos vehículos creados: ${importedCount}`);
  console.log(`Vehículos actualizados: ${updatedCount}`);

  // Query database status counts
  const statusCounts = await db.vehicle.groupBy({
    by: ["status"],
    where: { source: "INSTAGRAM_OFFICIAL" },
    _count: true
  });
  console.log("\nConteo por estado en BD (Inventario Instagram):");
  statusCounts.forEach(s => console.log(` - ${s.status}: ${s._count}`));

  const totalInDb = await db.vehicle.count({ where: { source: "INSTAGRAM_OFFICIAL" } });
  console.log(`Total vehículos oficiales Stroker en BD: ${totalInDb}`);
}

main().catch(console.error).finally(() => process.exit(0));
