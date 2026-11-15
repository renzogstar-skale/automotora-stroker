import { db } from "../src/lib/db";

async function main() {
  const branches = await db.branch.findMany();
  console.log("Branches count:", branches.length);
  branches.forEach(b => console.log(`- ${b.name} (${b.id}, ${b.code}, ${b.comuna})`));
  const vehicleCount = await db.vehicle.count();
  console.log("Vehicles count:", vehicleCount);
  const vehicles = await db.vehicle.findMany({ take: 5, select: { brand: true, model: true, year: true, status: true, slug: true } });
  console.log("Sample vehicles:", vehicles);
}

main().catch(console.error).finally(() => process.exit(0));
