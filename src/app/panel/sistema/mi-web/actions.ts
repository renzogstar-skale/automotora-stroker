"use server";
import { revalidatePath } from "next/cache";
import { guard } from "@/lib/auth";
import { run, str, type ActionState } from "@/lib/action";
import { savePublicImage } from "@/server/storage";
import { getSetting, type WebConfig } from "@/server/settings";
import { discardDraft, fullConfig, publishWeb, saveDraft, verifyDomain } from "@/server/web";
import { AppError } from "@/server/errors";

async function upload(fd: FormData, key: string) {
  const f = fd.get(key);
  if (!(f instanceof File) || !f.size) return null;
  try { return await savePublicImage("web", f); } catch (e) { throw new AppError((e as Error).message); }
}

export async function saveDraftAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("web.admin");
  return run(async () => {
    const w = await getSetting("web");
    const cur = fullConfig(w.draft ?? w.published);
    const branchIds = fd.getAll("branchIds").map(String);
    const cfg: WebConfig = {
      logoText: str(fd, "logoText"), logoImage: fd.get("removeLogo") ? "" : (await upload(fd, "logoFile")) ?? cur.logoImage,
      accent: str(fd, "accent"), secondary: str(fd, "secondary"),
      heroTitle: str(fd, "heroTitle"), heroSubtitle: str(fd, "heroSubtitle"), heroImage: (await upload(fd, "heroFile")) ?? (str(fd, "heroImage") || cur.heroImage),
      aboutText: str(fd, "aboutText"), phone: str(fd, "phone"), email: str(fd, "email"), whatsapp: str(fd, "whatsapp"),
      address: str(fd, "address") || cur.address,
      locationUrl: str(fd, "locationUrl") || cur.locationUrl,
      tagline: str(fd, "tagline") || cur.tagline,
      taglineTranslation: str(fd, "taglineTranslation") || cur.taglineTranslation,
      featuredIds: fd.getAll("featuredIds").map(String), showBranches: fd.get("showBranches") === "on",
      branches: Object.fromEntries(branchIds.map((id) => [id, {
        visible: fd.get(`b_${id}_visible`) === "on", address: str(fd, `b_${id}_address`), phone: str(fd, `b_${id}_phone`), whatsapp: str(fd, `b_${id}_whatsapp`), hours: str(fd, `b_${id}_hours`),
      }])),
    };
    await saveDraft(cfg, a);
    revalidatePath("/panel/sistema/mi-web");
  }, "Borrador guardado. Revísalo en Vista previa y publícalo cuando esté listo.");
}
export async function publishWebAction(): Promise<ActionState> {
  const a = await guard("web.admin");
  return run(async () => { await publishWeb(a); revalidatePath("/", "layout"); }, "Cambios publicados en la web.");
}
export async function discardDraftAction(): Promise<ActionState> {
  const a = await guard("web.admin");
  return run(async () => { await discardDraft(a); revalidatePath("/panel/sistema/mi-web"); }, "Borrador descartado.");
}
export async function domainAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await guard("web.admin");
  let msg = "";
  const r = await run(async () => {
    const res = await verifyDomain(str(fd, "domain"), a);
    msg = res.status === "ACTIVO" ? "Dominio verificado y activo." : `El DNS aún no apunta al hosting (${res.detail}).`;
    revalidatePath("/panel/sistema/mi-web");
  });
  return r?.ok ? { ok: true, message: msg } : r;
}
