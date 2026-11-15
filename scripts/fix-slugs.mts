// Una vez: quita la patente de los slugs públicos ya existentes (antes se generaban con la patente).
import { randomBytes } from "node:crypto";
import { db } from "../src/lib/db";
const vs = await db.vehicle.findMany({ select: { id: true, slug: true, plate: true } });
const leak = vs.filter((v) => v.slug.endsWith(v.plate.toLowerCase()));
for (const v of leak) await db.vehicle.update({ where: { id: v.id }, data: { slug: v.slug.slice(0, -v.plate.length) + randomBytes(3).toString("hex") } });
console.log(`${vs.length} vehículos · ${leak.length} slugs corregidos`);
await db.$disconnect();
