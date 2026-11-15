"use server";
import { revalidatePath } from "next/cache";
import { guard } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assertBranch } from "@/lib/rbac";
import { run, str, opt, int, type ActionState } from "@/lib/action";

export async function sellerAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("sellers");
  return run(async () => {
    const branchId = str(fd, "branchId");
    assertBranch(a, branchId);
    const data = { name: str(fd, "name"), email: str(fd, "email").toLowerCase(), phone: str(fd, "phone"), branchId, monthlyGoal: int(fd, "goal") || 5, active: fd.get("active") === "on" };
    const id = opt(fd, "id");
    const s = id ? await db.seller.update({ where: { id }, data }) : await db.seller.create({ data });
    await audit(a, id ? "seller.update" : "seller.create", "Seller", s.id, `Ficha vendedor ${s.name}`);
    revalidatePath("/panel/vendedores");
  }, "Ficha guardada.");
}
