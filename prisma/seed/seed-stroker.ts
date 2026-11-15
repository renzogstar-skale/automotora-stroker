import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { db } from "../../src/lib/db";
import { BUSINESS } from "../../src/lib/business";

const slugify = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

// Los 15 códigos de stock oficiales confirmados en reporte_importacion_instagram.md
const OFFICIAL_STOCK_CODES = [
  "STK-DC4NFFPM", // Volkswagen Saveiro 2023 - $10.000.000 (DISPONIBLE)
  "STK-DCKBVVKX", // Porsche Panamera 2018 - $81.990.000 (DISPONIBLE)
  "STK-DEIHI4EG", // Chevrolet Silverado 2023 - $48.990.000 (DISPONIBLE)
  "STK-DFU6Q3IM", // Geely Azkarra 2024 - $13.390.000 (DISPONIBLE)
  "STK-DFPV8SPM", // Honda Fat Cat 1987 - $5.990.000 (DISPONIBLE)
  "STK-DFPVQFNM", // Volkswagen Amarok 2017 - $10.990.000 (DISPONIBLE)
  "STK-DFNAAEDO", // Jeep Wrangler 2016 - $21.590.000 (DISPONIBLE)
  "STK-DFHL4SMP", // Ford Explorer 2019 - $22.900.000 (DISPONIBLE)
  "STK-DFXQA9ZG", // Chery Tiggo 7 Pro 2022 - $11.390.000 (DISPONIBLE)
  "STK-DFC1YDAE", // Peugeot Partner Cargo 2016 - $4.500.000 (VENDIDO)
  "STK-DFCXUHBE", // Triumph Bonneville Bobber 2023 - $11.500.000 (DISPONIBLE)
  "STK-DFCTSRHK", // BMW M4 Competition 2025 - $104.900.000 (RESERVADO)
  "STK-DC14EX4X", // Coleman Lantern Edition 2021 - $25.000.000 (DISPONIBLE)
  "STK-DQNFCCJD", // Can-Am Maverick X3 2020 - $35.990.000 (DISPONIBLE)
  "STK-DQM5T1CK", // Can-Am Renegade 1000 2020 - $18.000.000 (DISPONIBLE)
];

export async function seedOfficialStrokerInventory() {
  console.log("=== SINCRONIZANDO INVENTARIO OFICIAL DE STROKER ===");

  // 1. Asegurar Sucursal Oficial Antofagasta
  let antofagasta = await db.branch.findUnique({ where: { code: "ANF" } });
  if (!antofagasta) {
    antofagasta = await db.branch.create({
      data: {
        code: "ANF",
        name: "Automotora Stroker Antofagasta",
        address: BUSINESS.address,
        comuna: "Antofagasta",
        region: "Antofagasta",
        phone: BUSINESS.phone,
        whatsapp: BUSINESS.whatsapp,
        hours: {
          lunVie: "09:30–19:00",
          sab: "10:00–14:00",
          dom: "Cerrado",
        },
        active: true,
      },
    });
    console.log("Sucursal Antofagasta creada:", antofagasta.id);
  } else {
    console.log("Sucursal Antofagasta ya existe:", antofagasta.id);
  }

  // 2. Cargar datos desde JSON local
  const jsonPath = path.resolve(process.cwd(), "prisma/seed/stroker-inventory.json");
  const postsPath = path.resolve(process.cwd(), "prisma/seed/instagram-posts.json");

  if (!existsSync(jsonPath)) {
    console.warn("No se encontró el archivo de inventario en", jsonPath);
    return 0;
  }

  const allImported = JSON.parse(readFileSync(jsonPath, "utf8"));
  const rawPosts = existsSync(postsPath) ? JSON.parse(readFileSync(postsPath, "utf8")) : [];

  // 3. Registrar publicaciones de Instagram
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
          status: "APROBADO",
          commercialStatus: post.caption && /vendid/i.test(post.caption) ? "VENDIDO" : "DISPONIBLE",
        },
      });
    }
  }

  // 4. Filtrar exclusivamente las 15 unidades confirmadas
  const vehiclesToSeed = allImported.filter((v: any) => OFFICIAL_STOCK_CODES.includes(v.stockCode));
  console.log(`Vehículos a procesar: ${vehiclesToSeed.length}`);

  let count = 0;

  for (const v of vehiclesToSeed) {
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
      published: true,
      featured: (v.status === "DISPONIBLE" && v.priceCLP >= 15000000) || v.brand === "Porsche" || v.brand === "BMW",
    };

    const existing = await db.vehicle.findFirst({
      where: {
        OR: [{ stockCode: v.stockCode }, { instagramUrl: v.instagramUrl }],
      },
    });

    let vehicleId: string;
    if (existing) {
      const updated = await db.vehicle.update({
        where: { id: existing.id },
        data: vehicleData,
      });
      vehicleId = updated.id;
    } else {
      const created = await db.vehicle.create({
        data: vehicleData,
      });
      vehicleId = created.id;
    }

    // Gestionar fotos
    await db.vehiclePhoto.deleteMany({ where: { vehicleId } });
    const photos = v.localPhotos || [];
    for (let i = 0; i < photos.length; i++) {
      await db.vehiclePhoto.create({
        data: {
          vehicleId,
          url: photos[i],
          order: i,
          isCover: i === 0,
        },
      });
    }

    count++;
    console.log(`[OK] ${v.stockCode} - ${v.brand} ${v.model} (${v.status})`);
  }

  console.log(`=== SINCRONIZACIÓN COMPLETADA: ${count} VEHÍCULOS OFICIALES ===`);
  return count;
}

if (process.argv[1]?.includes("seed-stroker")) {
  seedOfficialStrokerInventory()
    .catch(console.error)
    .finally(() => process.exit(0));
}
