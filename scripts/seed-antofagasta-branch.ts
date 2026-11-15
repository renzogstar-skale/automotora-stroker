import { db } from "../src/lib/db";
import { BUSINESS } from "../src/lib/business";

async function main() {
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
          dom: "Cerrado"
        },
        active: true
      }
    });
    console.log("Created Antofagasta branch:", antofagasta.id);
  } else {
    console.log("Antofagasta branch already exists:", antofagasta.id);
  }
}

main().catch(console.error).finally(() => process.exit(0));
