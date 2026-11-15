"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { guard } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assertBranch } from "@/lib/rbac";
import { run, str, opt, int, type ActionState } from "@/lib/action";
import { normalizePlate } from "@/lib/format";
import { createConsignment, payOwner } from "@/server/consignments";
import { retireVehicle } from "@/server/inventory";
import { AppError } from "@/server/errors";

const DOC_KEYS = ["padron", "permiso", "revision", "mandato", "poder"];

export async function createConsignmentAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("consignments");
  let id = "";
  const r = await run(async () => {
    const p = normalizePlate(str(fd, "plate"));
    if (!p) throw new AppError("Patente inválida.");
    const c = await createConsignment({
      owner: { name: str(fd, "ownerName"), phone: str(fd, "ownerPhone"), email: str(fd, "ownerEmail") || undefined, rut: str(fd, "ownerRut") || undefined },
      vehicle: { branchId: str(fd, "branchId"), brand: str(fd, "brand"), model: str(fd, "model"), version: str(fd, "version"), year: int(fd, "year"), plate: p.plate, km: int(fd, "km"), transmission: str(fd, "transmission"), fuel: str(fd, "fuel"), bodyType: p.kind === "MOTO" ? "Moto" : str(fd, "bodyType"), color: str(fd, "color"), price: int(fd, "price"), description: opt(fd, "description") },
      modality: str(fd, "modality") as "FISICA", agreedPrice: int(fd, "agreedPrice"), days: int(fd, "days") || 60, responsibleId: opt(fd, "responsibleId"), appraisalId: opt(fd, "appraisalId"),
      documents: Object.fromEntries(DOC_KEYS.map((k) => [k, fd.get(`doc_${k}`) === "on"])),
    }, a);
    id = c.id;
  });
  if (r?.error) return r;
  redirect(`/panel/consignaciones/${id}`);
}
export async function docsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("consignments");
  return run(async () => {
    const c = await db.consignment.findUniqueOrThrow({ where: { id: str(fd, "id") }, include: { vehicle: true } });
    assertBranch(a, c.vehicle.branchId);
    await db.consignment.update({ where: { id: c.id }, data: { documents: Object.fromEntries(DOC_KEYS.map((k) => [k, fd.get(`doc_${k}`) === "on"])) } });
    revalidatePath(`/panel/consignaciones/${c.id}`);
  });
}
export async function retireConsignmentAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("consignments");
  return run(async () => {
    const c = await db.consignment.findUniqueOrThrow({ where: { id: str(fd, "id") } });
    await retireVehicle(c.vehicleId, str(fd, "reason") || "Propietario retira el vehículo", a);
    revalidatePath(`/panel/consignaciones/${c.id}`);
  }, "Consignación retirada; vehículo despublicado.");
}
export async function closeConsignmentAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("consignments");
  return run(async () => {
    const c = await db.consignment.findUniqueOrThrow({ where: { id: str(fd, "id") }, include: { payouts: true, vehicle: { include: { sales: { where: { status: "CONFIRMADA" } } } } } });
    const due = c.vehicle.sales[0]?.costBasis ?? 0, paid = c.payouts.reduce((t, p) => t + p.amount, 0);
    if (c.status === "VENDIDA" && due > paid) throw new AppError("Queda saldo por liquidar al propietario.");
    await db.consignment.update({ where: { id: c.id }, data: { status: "CERRADA", closedAt: new Date() } });
    await audit(a, "consignment.close", "Consignment", c.id, "Consignación cerrada");
    revalidatePath(`/panel/consignaciones/${c.id}`);
  }, "Consignación cerrada.");
}
export async function payoutAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("payments");
  return run(async () => { await payOwner(str(fd, "id"), int(fd, "amount"), str(fd, "key"), a); revalidatePath(`/panel/consignaciones/${str(fd, "id")}`); }, "Liquidación registrada.");
}
