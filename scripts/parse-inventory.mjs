import { readFileSync, writeFileSync } from "fs";

const raw = JSON.parse(readFileSync("./storage/instagram_raw_posts.json", "utf8"));

function parseVehicleFromPost(post, index) {
  const cap = post.caption || "";
  const lines = cap.split("\n").map(l => l.trim()).filter(Boolean);

  // If there's no vehicle content (e.g., purely institutional or empty dates)
  if (lines.length < 3 && !cap.includes("$")) {
    return {
      type: "NON_VEHICLE",
      url: post.url,
      caption: cap,
      reason: "No technical or commercial vehicle data in post"
    };
  }

  // Check institutional post (e.g., Stroker branding reel)
  if (cap.includes("Tu próximo auto te está esperando") && !cap.includes("Año") && !cap.includes("Precio")) {
    return {
      type: "INSTITUTIONAL",
      url: post.url,
      caption: cap,
      reason: "Institutional brand showcase"
    };
  }

  // 1. Headline
  const headline = lines[0] || post.ogTitle || "";

  // 2. Status determination
  let status = "DISPONIBLE";
  let verificationStatus = "VERIFICADO";

  if (/vendid[oa]|sold|ya se fue|entregad[oa]/i.test(cap) || /vendid[oa]/i.test(headline)) {
    status = "VENDIDO";
  } else if (/reservad[oa]/i.test(cap) || /reservad[oa]/i.test(headline)) {
    status = "RESERVADO";
  } else if (/en consignaci[oó]n/i.test(cap)) {
    status = "EN_CONSIGNACION";
  } else if (!cap.includes("$") && !cap.includes("Año")) {
    status = "POR_CONFIRMAR";
    verificationStatus = "POR_CONFIRMAR";
  }

  // 3. Price
  let priceCLP = 0;
  const priceMatch = cap.match(/(?:Precio|VALOR|PRECIO|Valor)[\s:*$]*([0-9]{1,3}(?:\.[0-9]{3})+|[0-9]{6,9})/i) ||
                     cap.match(/\$\s*([0-9]{1,3}(?:\.[0-9]{3})+)/);
  if (priceMatch) {
    priceCLP = parseInt(priceMatch[1].replace(/\./g, ""), 10);
  }

  // Financing (Pie mínimo / Crédito express)
  let minDownPayment = 0;
  const pieMatch = cap.match(/(?:Pie desde|PIE MÍNIMO|Pie mínimo|Pie)[\s:*$]*([0-9]{1,3}(?:\.[0-9]{3})+)/i);
  if (pieMatch) {
    minDownPayment = parseInt(pieMatch[1].replace(/\./g, ""), 10);
  }

  let expressCredit = null;
  const creditMatch = cap.match(/(?:CRÉDITO EXPRESS!|Crédito express)[\s\S]*?\$([0-9]{1,3}(?:\.[0-9]{3})+)/i);
  if (creditMatch) {
    expressCredit = `$${creditMatch[1]}`;
  }

  // 4. Year
  let year = 0;
  const yearMatch = cap.match(/(?:Año|AÑO)[\s:*]*([12][0-9]{3})/i) || headline.match(/\b(19[89][0-9]|20[0-2][0-9])\b/);
  if (yearMatch) {
    year = parseInt(yearMatch[1], 10);
  }

  // 5. Mileage
  let mileage = 0;
  const kmMatch = cap.match(/([0-9]{1,3}(?:\.[0-9]{3})*)\s*km\b/i) || cap.match(/([0-9]+)\s*horas de uso/i);
  if (kmMatch) {
    mileage = parseInt(kmMatch[1].replace(/\./g, ""), 10);
  }

  // 6. Fuel
  let fuel = "Bencina";
  if (/di[eé]sel/i.test(cap) || /TDI|Duramax/i.test(cap)) {
    fuel = "Diésel";
  } else if (/h[ií]brido/i.test(cap)) {
    fuel = "Híbrido";
  } else if (/el[eé]ctrico/i.test(cap)) {
    fuel = "Eléctrico";
  }

  // 7. Transmission
  let transmission = "Automática";
  if (/mec[aá]nica|manual/i.test(cap)) {
    transmission = "Manual";
  }

  // 8. Color
  let color = "No especificado";
  const colorMatch = cap.match(/Color[\s:*]+([^\n\r,.]+)/i);
  if (colorMatch) {
    color = colorMatch[1].trim();
  }

  // 9. Brand & Model detection
  let brand = "Otros";
  let model = "";
  let version = "";
  let bodyType = "SUV";

  const cleanHead = headline.replace(/🔥|🛻|🏎️|🚙|🏍️|🏕️|🚐|✅|💸|¡OPORTUNIDAD!|¡JOYA CLÁSICA!|¡SE VENDE!|SE VENDE|RESERVADO|VENDIDO|\*/gi, "").trim();

  if (/VOLKSWAGEN\s+SAVEIRO/i.test(cleanHead)) {
    brand = "Volkswagen"; model = "Saveiro"; version = "1.6 MSI"; bodyType = "Camioneta";
  } else if (/PORSCHE\s+PANAMERA/i.test(cleanHead)) {
    brand = "Porsche"; model = "Panamera"; version = "G2 4.0 Turbo"; bodyType = "Sedán";
  } else if (/CHEVROLET\s+SILVERADO/i.test(cleanHead)) {
    brand = "Chevrolet"; model = "Silverado"; version = "High Country 3.0 Duramax"; bodyType = "Camioneta";
  } else if (/GEELY\s+AZKARRA/i.test(cleanHead)) {
    brand = "Geely"; model = "Azkarra"; version = "Exclusive 1.5 Turbo"; bodyType = "SUV";
  } else if (/HONDA\s+FAT\s+CAT/i.test(cleanHead)) {
    brand = "Honda"; model = "Fat Cat"; version = "TR200 Clásica"; bodyType = "Moto";
  } else if (/VOLKSWAGEN\s+AMAROK/i.test(cleanHead)) {
    brand = "Volkswagen"; model = "Amarok"; version = "Trendline 2.0 TDI"; bodyType = "Camioneta";
  } else if (/JEEP\s+WRANGLER/i.test(cleanHead)) {
    brand = "Jeep"; model = "Wrangler"; version = "Sahara 4x4 2.8 Diésel"; bodyType = "SUV";
  } else if (/FORD\s+EXPLORER/i.test(cleanHead)) {
    brand = "Ford"; model = "Explorer"; version = "Limited 2.3 EcoBoost"; bodyType = "SUV";
  } else if (/CHERY\s+TIGGO\s+7/i.test(cleanHead)) {
    brand = "Chery"; model = "Tiggo 7 Pro"; version = "GLX CVT 1.5"; bodyType = "SUV";
  } else if (/PEUGEOT\s+PARTNER/i.test(cleanHead)) {
    brand = "Peugeot"; model = "Partner"; version = "Cargo 1.6 Diésel"; bodyType = "Furgón";
  } else if (/TRIUMPH\s+BONNEVILLE/i.test(cleanHead)) {
    brand = "Triumph"; model = "Bonneville Bobber"; version = "Bobber 1200"; bodyType = "Moto";
  } else if (/BMW\s+M4/i.test(cleanHead)) {
    brand = "BMW"; model = "M4"; version = "Competition LCI2 S58 M xDrive"; bodyType = "Sedán";
  } else if (/COLEMAN/i.test(cleanHead) || /CASA\s+RODANTE/i.test(cleanHead)) {
    brand = "Coleman"; model = "Lantern Edition"; version = "Casa Rodante 10 Personas"; bodyType = "Motorhome";
  } else if (/CAN\s+AM\s+X3/i.test(cleanHead) || /CAN AM X3/i.test(cap)) {
    brand = "Can-Am"; model = "Maverick X3"; version = "4 Plazas Turbo"; bodyType = "Otros";
  } else if (/CAN\s+AM\s+RENEGADE/i.test(cleanHead) || /CAN AM RENEGADE/i.test(cap)) {
    brand = "Can-Am"; model = "Renegade 1000"; version = "4x4 V-Twin"; bodyType = "Moto";
  } else {
    // Generic fallback
    const words = cleanHead.split(/\s+/).filter(Boolean);
    brand = words[0] || "Stroker";
    model = words.slice(1, 3).join(" ") || "Especial";
    version = words.slice(3).join(" ") || "";
  }

  // 10. Commercial description
  // Find lines between headline and checkmarks/price
  const descLines = [];
  let recordingDesc = false;
  for (const l of lines) {
    if (l === headline) {
      recordingDesc = true;
      continue;
    }
    if (l.startsWith("✅") || l.startsWith("💰") || l.startsWith("🔥 EQUIPAMIENTO")) {
      recordingDesc = false;
    }
    if (recordingDesc && l.length > 15 && !l.startsWith("http") && !l.startsWith("📍")) {
      descLines.push(l);
    }
  }
  const description = descLines.join(" ") || cleanHead;

  // 11. Features / Equipment
  const features = [];
  for (const l of lines) {
    if (l.startsWith("✔️") || l.startsWith("•") || l.startsWith("- ")) {
      const feat = l.replace(/^[✔️•\-\s]+/, "").trim();
      if (feat && feat.length > 2 && !feat.includes("Visítanos") && !feat.includes("Automotora")) {
        features.push(feat);
      }
    }
  }

  // 12. Shortcode & Stock Code
  const shortcodeMatch = post.url.match(/\/(?:p|reel)\/([A-Za-z0-9_-]+)/);
  const shortcode = shortcodeMatch ? shortcodeMatch[1] : `ITEM${index + 1}`;
  const stockCode = `STK-${shortcode.toUpperCase().slice(0, 10)}`;

  // 13. Extract high-res vehicle photos
  const highResPhotos = [];
  if (post.pageImages && post.pageImages.length > 0) {
    for (const img of post.pageImages) {
      if (img.width >= 400 && img.height >= 400 && !img.src.includes("s150x150") && !img.src.includes("profile_pic")) {
        highResPhotos.push(img.src);
      }
    }
  }
  if (highResPhotos.length === 0 && post.ogImage) {
    highResPhotos.push(post.ogImage);
  }

  return {
    type: "VEHICLE",
    id: `ig_${shortcode}`,
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
    headline,
    description,
    features,
    originalCaption: cap,
    instagramUrl: post.url,
    instagramPublishedAt: new Date().toISOString(), // Or extracted date
    rawMediaUrls: highResPhotos,
    videoUrl: post.ogVideo || null,
    source: "INSTAGRAM_OFFICIAL"
  };
}

const parsedItems = raw.map((p, idx) => parseVehicleFromPost(p, idx));

console.log("=== PARSED VEHICLES SUMMARY ===");
const vehicles = parsedItems.filter(i => i.type === "VEHICLE");
const nonVehicles = parsedItems.filter(i => i.type !== "VEHICLE");

console.log(`Total publications parsed: ${raw.length}`);
console.log(`Total vehicles identified: ${vehicles.length}`);
console.log(`Non-vehicle / institutional: ${nonVehicles.length}`);

vehicles.forEach((v, idx) => {
  console.log(`[${idx + 1}] [${v.status}] ${v.brand} ${v.model} ${v.year} - $${v.priceCLP?.toLocaleString("es-CL")} CLP (${v.mileage} km) [${v.rawMediaUrls.length} photos] - Stock: ${v.stockCode}`);
});

writeFileSync("./storage/parsed_vehicles.json", JSON.stringify(vehicles, null, 2), "utf8");
console.log("\nSaved parsed vehicles to storage/parsed_vehicles.json");
