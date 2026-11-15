import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import path from "path";

const raw = JSON.parse(readFileSync("./storage/instagram_raw_posts.json", "utf8"));

function refineVehicle(post, index) {
  const cap = post.caption || "";
  const lines = cap.split("\n").map(l => l.trim()).filter(Boolean);

  if (lines.length < 2 && !cap.includes("$")) {
    return null;
  }

  // Identify status
  let status = "DISPONIBLE";
  let verificationStatus = "VERIFICADO";

  if (/vendid[oa]|sold|ya se fue|entregad[oa]/i.test(cap)) {
    status = "VENDIDO";
  } else if (/reservad[oa]/i.test(cap)) {
    status = "RESERVADO";
  } else if (/consignaci[oó]n/i.test(cap)) {
    status = "EN_CONSIGNACION";
  } else if (!cap.includes("$") && !cap.includes("Año")) {
    status = "POR_CONFIRMAR";
    verificationStatus = "POR_CONFIRMAR";
  }

  // Find the vehicle title line (skip ✅VENDIDO✅ or ✅RESERVADO✅ or 💸💸¡SE VENDE!💸💸)
  let titleLine = lines[0] || "";
  for (const line of lines) {
    if (/SAVEIRO|PANAMERA|SILVERADO|AZKARRA|FAT CAT|AMAROK|WRANGLER|EXPLORER|TIGGO|PARTNER|BONNEVILLE|BMW M4|COLEMAN|CASA RODANTE|CAN AM|CAN-AM/i.test(line)) {
      titleLine = line;
      break;
    }
  }

  // Parse Brand, Model, Version, Year, BodyType
  let brand = "Otros";
  let model = "Especial";
  let version = "";
  let bodyType = "SUV";
  let year = 2022;

  if (/SAVEIRO/i.test(cap)) {
    brand = "Volkswagen"; model = "Saveiro"; version = "1.6 MSI"; bodyType = "Camioneta"; year = 2023;
  } else if (/PANAMERA/i.test(cap)) {
    brand = "Porsche"; model = "Panamera"; version = "G2 4.0 Turbo"; bodyType = "Sedán"; year = 2018;
  } else if (/SILVERADO/i.test(cap)) {
    brand = "Chevrolet"; model = "Silverado"; version = "High Country 3.0 Duramax"; bodyType = "Camioneta"; year = 2023;
  } else if (/AZKARRA/i.test(cap)) {
    brand = "Geely"; model = "Azkarra"; version = "Exclusive 1.5 Turbo"; bodyType = "SUV"; year = 2024;
  } else if (/FAT CAT/i.test(cap)) {
    brand = "Honda"; model = "Fat Cat"; version = "TR200 Clásica"; bodyType = "Moto"; year = 1987;
  } else if (/AMAROK/i.test(cap)) {
    brand = "Volkswagen"; model = "Amarok"; version = "Trendline 2.0 TDI"; bodyType = "Camioneta"; year = 2017;
  } else if (/WRANGLER/i.test(cap)) {
    brand = "Jeep"; model = "Wrangler"; version = "Sahara 4x4 2.8 Diésel"; bodyType = "SUV"; year = 2016;
  } else if (/EXPLORER/i.test(cap)) {
    brand = "Ford"; model = "Explorer"; version = "Limited 2.3 EcoBoost"; bodyType = "SUV"; year = 2019;
  } else if (/TIGGO\s*7/i.test(cap)) {
    brand = "Chery"; model = "Tiggo 7 Pro"; version = "GLX CVT 1.5"; bodyType = "SUV"; year = 2022;
  } else if (/PARTNER/i.test(cap)) {
    brand = "Peugeot"; model = "Partner"; version = "Cargo 1.6 Diésel"; bodyType = "Furgón"; year = 2016;
  } else if (/BONNEVILLE|BOBBER/i.test(cap)) {
    brand = "Triumph"; model = "Bonneville Bobber"; version = "Bobber 1200"; bodyType = "Moto"; year = 2023;
  } else if (/BMW\s+M4/i.test(cap)) {
    brand = "BMW"; model = "M4"; version = "Competition LCI2 S58 M xDrive"; bodyType = "Sedán"; year = 2025;
  } else if (/COLEMAN|CASA\s+RODANTE/i.test(cap)) {
    brand = "Coleman"; model = "Lantern Edition"; version = "Casa Rodante Outdoor 10 Personas"; bodyType = "Motorhome"; year = 2021;
  } else if (/CAN\s*AM\s*X3/i.test(cap)) {
    brand = "Can-Am"; model = "Maverick X3"; version = "4 Plazas Turbo"; bodyType = "Otros"; year = 2020;
  } else if (/CAN\s*AM\s*RENEGADE/i.test(cap)) {
    brand = "Can-Am"; model = "Renegade 1000"; version = "4x4 V-Twin 1000cc"; bodyType = "Moto"; year = 2020;
  }

  // Extract explicit year from caption if available
  const yrMatch = cap.match(/(?:Año|AÑO)[\s:*]*([12][0-9]{3})/i);
  if (yrMatch) year = parseInt(yrMatch[1], 10);

  // Mileage
  let mileage = 0;
  const kmMatch = cap.match(/([0-9]{1,3}(?:\.[0-9]{3})*)\s*km\b/i);
  if (kmMatch) {
    mileage = parseInt(kmMatch[1].replace(/\./g, ""), 10);
  } else {
    const hoursMatch = cap.match(/([0-9]+)\s*horas de uso/i);
    if (hoursMatch) mileage = parseInt(hoursMatch[1], 10);
  }

  // Price
  let priceCLP = 0;
  const priceMatch = cap.match(/(?:Precio|VALOR|PRECIO|Valor)[\s:*$]*([0-9]{1,3}(?:\.[0-9]{3})+|[0-9]{6,9})/i) ||
                     cap.match(/\$\s*([0-9]{1,3}(?:\.[0-9]{3})+)/);
  if (priceMatch) {
    priceCLP = parseInt(priceMatch[1].replace(/\./g, ""), 10);
  }

  // Down payment & financing
  let minDownPayment = 0;
  const pieMatch = cap.match(/(?:Pie desde|PIE MÍNIMO|Pie mínimo|Pie)[\s:*$]*([0-9]{1,3}(?:\.[0-9]{3})+)/i);
  if (pieMatch) minDownPayment = parseInt(pieMatch[1].replace(/\./g, ""), 10);

  let expressCredit = null;
  const creditMatch = cap.match(/(?:CRÉDITO EXPRESS!|Crédito express)[\s\S]*?\$([0-9]{1,3}(?:\.[0-9]{3})+)/i);
  if (creditMatch) expressCredit = `$${creditMatch[1]}`;

  // Fuel & transmission
  let fuel = "Bencina";
  if (/di[eé]sel|TDI|Duramax/i.test(cap)) fuel = "Diésel";
  else if (/h[ií]brido/i.test(cap)) fuel = "Híbrido";
  else if (/el[eé]ctrico/i.test(cap)) fuel = "Eléctrico";

  let transmission = "Automática";
  if (/mec[aá]nica|manual/i.test(cap)) transmission = "Manual";

  // Color
  let color = "No especificado";
  const colorMatch = cap.match(/Color[\s:*]+([^\n\r,.]+)/i);
  if (colorMatch) color = colorMatch[1].trim();

  // Features list
  const features = [];
  for (const l of lines) {
    if (l.startsWith("✔️") || l.startsWith("•") || l.startsWith("- ")) {
      const feat = l.replace(/^[✔️•\-\s]+/, "").trim();
      if (feat && feat.length > 2 && !feat.includes("Visítanos") && !feat.includes("Automotora") && !feat.includes("Special Cars")) {
        features.push(feat);
      }
    }
  }

  // Shortcode & Stock Code
  const shortcodeMatch = post.url.match(/\/(?:p|reel)\/([A-Za-z0-9_-]+)/);
  const shortcode = shortcodeMatch ? shortcodeMatch[1] : `ITEM${index + 1}`;
  const stockCode = `STK-${shortcode.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8)}`;

  // Candidate image URLs
  const candidateUrls = [];
  if (post.pageImages && post.pageImages.length > 0) {
    for (const img of post.pageImages) {
      if (img.width >= 350 && img.height >= 350 && !img.src.includes("s150x150") && !img.src.includes("profile_pic")) {
        candidateUrls.push(img.src);
      }
    }
  }
  if (candidateUrls.length === 0 && post.ogImage) {
    candidateUrls.push(post.ogImage);
  }

  return {
    stockCode,
    shortcode,
    brand,
    model,
    version,
    year,
    mileage,
    transmission,
    fuel,
    color,
    bodyType,
    priceCLP,
    minDownPayment,
    expressCredit,
    status,
    verificationStatus,
    headline: titleLine,
    description: lines.find(l => l.length > 25 && !l.startsWith("✅") && !l.startsWith("💰") && !l.startsWith("✔️") && !l.startsWith("http")) || titleLine,
    features,
    originalCaption: cap,
    instagramUrl: post.url,
    instagramPublishedAt: new Date().toISOString(),
    rawMediaUrls: candidateUrls,
    videoUrl: post.ogVideo || null,
    source: "INSTAGRAM_OFFICIAL"
  };
}

async function run() {
  console.log("Parsing and refining vehicles...");
  const refined = [];
  const duplicates = [];
  const seenPosts = new Set();
  const seenVehicles = new Map();

  for (let i = 0; i < raw.length; i++) {
    const v = refineVehicle(raw[i], i);
    if (!v) continue;

    // Check post duplicates
    if (seenPosts.has(v.instagramUrl)) {
      duplicates.push({ url: v.instagramUrl, reason: "Duplicate post URL" });
      continue;
    }
    seenPosts.add(v.instagramUrl);

    // Detect duplicate vehicles (like Coleman Lantern duplicate reels 14, 15, 16)
    const vehKey = `${v.brand}_${v.model}_${v.year}_${v.priceCLP}`;
    if (seenVehicles.has(vehKey)) {
      duplicates.push({ url: v.instagramUrl, vehicle: `${v.brand} ${v.model} ${v.year}`, price: v.priceCLP, reason: "Duplicate vehicle listing reel" });
      continue;
    }
    seenVehicles.set(vehKey, v);
    refined.push(v);
  }

  console.log(`\nUnique vehicles identified: ${refined.length}`);
  console.log(`Duplicates detected: ${duplicates.length}`);
  console.log("Duplicates details:", duplicates);

  // Now download and store photos locally
  mkdirSync("./public/inventory/stroker", { recursive: true });

  for (let i = 0; i < refined.length; i++) {
    const v = refined[i];
    const vehDir = `./public/inventory/stroker/${v.stockCode.toLowerCase()}`;
    mkdirSync(vehDir, { recursive: true });
    v.localPhotos = [];

    console.log(`\n[${i + 1}/${refined.length}] Downloading photos for ${v.brand} ${v.model} (${v.stockCode})...`);
    const urlsToDownload = v.rawMediaUrls.slice(0, 5); // Download up to 5 best photos

    for (let pIdx = 0; pIdx < urlsToDownload.length; pIdx++) {
      const imgUrl = urlsToDownload[pIdx];
      const fileName = `${pIdx + 1}.jpg`;
      const filePath = path.join(vehDir, fileName);
      const publicPath = `/inventory/stroker/${v.stockCode.toLowerCase()}/${fileName}`;

      try {
        const res = await fetch(imgUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36"
          }
        });
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          writeFileSync(filePath, buf);
          v.localPhotos.push(publicPath);
          process.stdout.write(`  [photo ${pIdx + 1} OK] `);
        } else {
          console.warn(`  [photo ${pIdx + 1} HTTP ${res.status}]`);
        }
      } catch (err) {
        console.warn(`  [photo ${pIdx + 1} error: ${err.message}]`);
      }
    }
    if (v.localPhotos.length === 0) {
      console.warn(`  WARNING: No photos could be downloaded for ${v.stockCode}`);
      v.verificationStatus = "POR_CONFIRMAR";
    }
  }

  writeFileSync("./storage/imported_vehicles_with_local_photos.json", JSON.stringify(refined, null, 2), "utf8");
  writeFileSync("./storage/duplicate_vehicles.json", JSON.stringify(duplicates, null, 2), "utf8");

  // Also generate CSV export as requested!
  const csvHeaders = [
    "id", "stockCode", "brand", "model", "version", "year", "mileage",
    "transmission", "fuel", "color", "bodyType", "priceCLP", "minDownPayment",
    "status", "verificationStatus", "instagramUrl", "photosCount", "firstPhoto"
  ];
  const csvRows = [csvHeaders.join(",")];
  for (const v of refined) {
    csvRows.push([
      `"${v.stockCode}"`,
      `"${v.stockCode}"`,
      `"${v.brand}"`,
      `"${v.model}"`,
      `"${v.version}"`,
      v.year,
      v.mileage,
      `"${v.transmission}"`,
      `"${v.fuel}"`,
      `"${v.color}"`,
      `"${v.bodyType}"`,
      v.priceCLP,
      v.minDownPayment,
      `"${v.status}"`,
      `"${v.verificationStatus}"`,
      `"${v.instagramUrl}"`,
      v.localPhotos.length,
      `"${v.localPhotos[0] || ""}"`
    ].join(","));
  }
  writeFileSync("./storage/inventario_stroker_instagram.csv", csvRows.join("\n"), "utf8");
  console.log("\nSaved CSV to storage/inventario_stroker_instagram.csv");
  console.log("Saved JSON to storage/imported_vehicles_with_local_photos.json");
}

run();
