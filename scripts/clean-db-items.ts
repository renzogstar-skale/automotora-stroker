import { db } from "../src/lib/db";

async function clean() {
  // Remove institutional non-vehicle post from Vehicle table
  const institutional = await db.vehicle.findFirst({ where: { stockCode: "STK-DEXG0FNT" } });
  if (institutional) {
    await db.vehiclePhoto.deleteMany({ where: { vehicleId: institutional.id } });
    await db.vehicle.delete({ where: { id: institutional.id } });
    await db.instagramImport.updateMany({
      where: { postUrl: { contains: "DexG0fntLyM" } },
      data: { status: "INSTITUCIONAL", vehicleId: null }
    });
    console.log("Cleaned institutional reel STK-DEXG0FNT from Vehicle table.");
  }

  // Handle duplicate Coleman Lantern Edition reel
  const duplicate = await db.vehicle.findFirst({ where: { stockCode: "STK-DVJKNRJK" } });
  if (duplicate) {
    await db.vehiclePhoto.deleteMany({ where: { vehicleId: duplicate.id } });
    await db.vehicle.delete({ where: { id: duplicate.id } });
    await db.instagramImport.updateMany({
      where: { postUrl: { contains: "DVJKnRjkV-h" } },
      data: { status: "DUPLICADO", vehicleId: null }
    });
    console.log("Cleaned duplicate Coleman reel STK-DVJKNRJK from Vehicle table.");
  }

  // Count current official vehicles
  const vehicles = await db.vehicle.findMany({
    where: { source: "INSTAGRAM_OFFICIAL" },
    select: { stockCode: true, brand: true, model: true, year: true, status: true, price: true }
  });
  console.log(`\nInventario Stroker oficial actual en BD: ${vehicles.length} vehículos:`);
  vehicles.forEach((v, i) => console.log(` [${i + 1}] [${v.status}] ${v.brand} ${v.model} ${v.year} - $${v.price.toLocaleString("es-CL")} CLP (${v.stockCode})`));
}

clean().catch(console.error).finally(() => process.exit(0));
