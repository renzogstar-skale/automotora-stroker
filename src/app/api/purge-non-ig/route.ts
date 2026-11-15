import { NextResponse } from "next/server";
import { purgeNonInstagramVehicles, seedOfficialStrokerInventory } from "@/server/seed-stroker";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const beforeCount = await db.vehicle.count();
    const purged = await purgeNonInstagramVehicles();
    await seedOfficialStrokerInventory();
    const afterCount = await db.vehicle.count();
    const igCount = await db.vehicle.count({ where: { source: "INSTAGRAM_OFFICIAL" } });

    return NextResponse.json({
      success: true,
      beforeCount,
      purged,
      afterCount,
      igCount,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
