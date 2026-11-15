"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { guard } from "@/lib/auth";
import { db } from "@/lib/db";
import { run, str, opt, int, type ActionState } from "@/lib/action";
import { normalizePlate } from "@/lib/format";
import { assertBranch } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { cancelReservation, createVehicle, reserveVehicle, retireVehicle, setPublished } from "@/server/inventory";
import { catId } from "@/server/categories";
import { AppError } from "@/server/errors";

export async function createVehicleAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("inventory.edit");
  let id = "";
  const r = await run(async () => {
    const p = normalizePlate(str(fd, "plate"));
    if (!p) throw new AppError("Patente inválida. Formatos: AA1234, BBBB12 (autos) o AA123, BBB12 (motos).");
    const v = await createVehicle({
      branchId: str(fd, "branchId"), brand: str(fd, "brand"), model: str(fd, "model"), version: str(fd, "version"), year: int(fd, "year"), plate: p.plate,
      vin: opt(fd, "vin"), km: int(fd, "km"), transmission: str(fd, "transmission"), fuel: str(fd, "fuel"), bodyType: p.kind === "MOTO" ? "Moto" : str(fd, "bodyType"),
      color: str(fd, "color"), condition: str(fd, "condition") as "USADO", price: int(fd, "price"), cost: int(fd, "cost"), description: opt(fd, "description"),
    }, a);
    if (v.ownership === "PROPIO" && fd.get("registerPurchase"))
      await db.movement.create({ data: { date: new Date(), type: "EGRESO", categoryId: await catId("Compra de vehículo"), amount: v.cost, description: `Compra ${v.brand} ${v.model} ${v.plate}`, tags: ["inventario"], branchId: v.branchId, vehicleId: v.id, createdById: a.id } });
    id = v.id;
  });
  if (r?.error) return r;
  redirect(`/panel/inventario/${id}`);
}

export async function updateVehicleAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("inventory.edit");
  return run(async () => {
    const v = await db.vehicle.findUniqueOrThrow({ where: { id: str(fd, "id") } });
    assertBranch(a, v.branchId);
    const data = {
      price: int(fd, "price"),
      km: int(fd, "km"),
      color: str(fd, "color"),
      description: opt(fd, "description"),
      featured: fd.get("featured") === "on",
      version: str(fd, "version"),
      vin: opt(fd, "vin"),
      stockCode: opt(fd, "stockCode"),
      minDownPayment: fd.get("minDownPayment") ? int(fd, "minDownPayment") : undefined,
    };
    await db.vehicle.update({ where: { id: v.id }, data });
    if (data.price !== v.price) await audit(a, "vehicle.price", "Vehicle", v.id, `Precio ${v.price} → ${data.price}`);
    revalidatePath(`/panel/inventario/${v.id}`);
    revalidatePath("/panel/inventario");
    revalidatePath("/");
    revalidatePath("/autos");
  });
}

export async function changeVehicleStatusAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("inventory.edit");
  return run(async () => {
    const id = str(fd, "id");
    const newStatus = str(fd, "status") as any;
    const v = await db.vehicle.findUniqueOrThrow({ where: { id } });
    assertBranch(a, v.branchId);
    await db.vehicle.update({
      where: { id },
      data: { status: newStatus },
    });
    await audit(a, "vehicle.status", "Vehicle", v.id, `Estado cambiado de ${v.status} a ${newStatus}`);
    revalidatePath(`/panel/inventario/${v.id}`);
    revalidatePath("/panel/inventario");
    revalidatePath("/");
    revalidatePath("/autos");
  }, "Estado del vehículo actualizado correctamente.");
}

export async function approveInstagramImportAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("inventory.edit");
  return run(async () => {
    const id = str(fd, "id");
    const item = await db.instagramImport.findUniqueOrThrow({ where: { id } });
    await db.instagramImport.update({
      where: { id },
      data: {
        status: "APROBADO",
        reviewedAt: new Date(),
        reviewedBy: a.name || a.email,
      },
    });
    await audit(a, "instagram.approve", "InstagramImport", id, `Importación aprobada: ${item.postUrl}`);
    revalidatePath("/panel/inventario/instagram-sync");
    revalidatePath("/panel/inventario");
  }, "Importación aprobada con éxito.");
}

export async function rejectInstagramImportAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("inventory.edit");
  return run(async () => {
    const id = str(fd, "id");
    const item = await db.instagramImport.findUniqueOrThrow({ where: { id } });
    await db.instagramImport.update({
      where: { id },
      data: {
        status: "RECHAZADO",
        reviewedAt: new Date(),
        reviewedBy: a.name || a.email,
      },
    });
    await audit(a, "instagram.reject", "InstagramImport", id, `Importación rechazada: ${item.postUrl}`);
    revalidatePath("/panel/inventario/instagram-sync");
    revalidatePath("/panel/inventario");
  }, "Importación rechazada.");
}

export async function publishAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard();
  const pub = str(fd, "publish") === "1";
  return run(async () => {
    await setPublished(str(fd, "id"), pub, a);
    revalidatePath("/panel/inventario");
    revalidatePath(`/panel/inventario/${str(fd, "id")}`);
    revalidatePath("/panel/albumes");
    revalidatePath("/");
    revalidatePath("/autos");
  }, pub ? "Publicado en la web." : "Despublicado.");
}

export async function reserveAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("sales.edit");
  return run(async () => {
    await reserveVehicle({ vehicleId: str(fd, "vehicleId"), opportunityId: opt(fd, "opportunityId"), amount: int(fd, "amount"), days: int(fd, "days") || 3, method: str(fd, "method"), idempotencyKey: str(fd, "key") }, a);
    revalidatePath(`/panel/inventario/${str(fd, "vehicleId")}`);
    revalidatePath("/panel/inventario");
    revalidatePath("/");
  }, "Reserva registrada y abono cobrado.");
}

export async function cancelReservationAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("sales.edit");
  return run(async () => {
    await cancelReservation(str(fd, "id"), str(fd, "reason"), a);
    revalidatePath("/panel/inventario");
    revalidatePath("/");
  }, "Reserva anulada.");
}

export async function retireAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("inventory.edit");
  return run(async () => {
    await retireVehicle(str(fd, "id"), str(fd, "reason"), a);
    revalidatePath("/panel/inventario");
    revalidatePath("/");
  }, "Vehículo retirado y despublicado.");
}

export async function prepExpenseAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("inventory.edit");
  return run(async () => {
    const v = await db.vehicle.findUniqueOrThrow({ where: { id: str(fd, "id") } });
    assertBranch(a, v.branchId);
    if (int(fd, "amount") <= 0) throw new AppError("Monto inválido.");
    await db.movement.create({ data: { date: new Date(), type: "EGRESO", categoryId: await catId("Preparación de vehículo"), amount: int(fd, "amount"), description: `${str(fd, "desc") || "Preparación"} ${v.plate}`, tags: ["preparación"], branchId: v.branchId, vehicleId: v.id, createdById: a.id } });
    await audit(a, "movement.create", "Vehicle", v.id, `Gasto de preparación ${int(fd, "amount")}`);
    revalidatePath(`/panel/inventario/${v.id}`);
  }, "Gasto de preparación registrado.");
}
