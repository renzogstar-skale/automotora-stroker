"use server";
import { revalidatePath } from "next/cache";
import { guard } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assertBranch } from "@/lib/rbac";
import { run, str, type ActionState } from "@/lib/action";
import { removeStored, savePublicImage } from "@/server/storage";

async function vehicleFor(id: string) {
  const a = await guard("albums");
  const v = await db.vehicle.findUniqueOrThrow({ where: { id }, include: { photos: { orderBy: { order: "asc" } } } });
  assertBranch(a, v.branchId);
  return { a, v };
}
export async function uploadPhotosAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { a, v } = await vehicleFor(str(fd, "id"));
    const files = fd.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
    if (!files.length) throw new Error("Selecciona al menos una foto.");
    let order = v.photos.length;
    for (const f of files) {
      const url = await savePublicImage(v.id, f);
      await db.vehiclePhoto.create({ data: { vehicleId: v.id, url, order: order++, isCover: order === 1 && !v.photos.some((p) => p.isCover) } });
    }
    await audit(a, "album.upload", "Vehicle", v.id, `${files.length} foto(s) cargadas`);
    revalidatePath(`/panel/albumes/${v.id}`);
  }, "Fotos cargadas.");
}
export async function photoAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { v } = await vehicleFor(str(fd, "vehicleId"));
    const pid = str(fd, "photoId"), op = str(fd, "op");
    const list = [...v.photos];
    const i = list.findIndex((p) => p.id === pid);
    if (i < 0) throw new Error("Foto no encontrada.");
    if (op === "cover") {
      await db.$transaction([db.vehiclePhoto.updateMany({ where: { vehicleId: v.id }, data: { isCover: false } }), db.vehiclePhoto.update({ where: { id: pid }, data: { isCover: true } })]);
    } else if (op === "up" || op === "down") {
      const j = op === "up" ? i - 1 : i + 1;
      if (j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
      await db.$transaction(list.map((p, k) => db.vehiclePhoto.update({ where: { id: p.id }, data: { order: k } })));
    } else if (op === "delete") {
      await db.vehiclePhoto.delete({ where: { id: pid } });
      await removeStored(list[i].url);
      if (list[i].isCover && list.length > 1) await db.vehiclePhoto.update({ where: { id: list.find((p) => p.id !== pid)!.id }, data: { isCover: true } });
      if (list.length === 1 && v.published) await db.vehicle.update({ where: { id: v.id }, data: { published: false } });
    }
    revalidatePath(`/panel/albumes/${v.id}`);
  }, "Álbum actualizado.");
}
