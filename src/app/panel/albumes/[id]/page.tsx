import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDown, ArrowUp, Eye, Star, Trash2 } from "lucide-react";
import { guard } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, branchScope } from "@/lib/rbac";
import { VEHICLE_STATUS } from "@/lib/labels";
import { Badge, Card, Notice, PageHeader, StatusBadge } from "@/components/ui";
import { ActionForm, InlineAction, Submit } from "@/components/client/forms";
import { photoAction, uploadPhotosAction } from "../actions";
import { publishAction } from "../../inventario/actions";

export default async function Album({ params }: { params: Promise<{ id: string }> }) {
  const a = await guard("albums");
  const { id } = await params;
  const v = await db.vehicle.findUnique({ where: { id }, include: { photos: { orderBy: { order: "asc" } } } });
  const bs = branchScope(a);
  if (!v || (bs && !bs.includes(v.branchId))) notFound();
  const sellable = ["DISPONIBLE", "RESERVADO"].includes(v.status);
  return (
    <>
      <PageHeader title={`Álbum · ${v.brand} ${v.model} ${v.year}`} desc={`${v.plate} · ${v.photos.length} fotografías`}
        actions={<>
          <StatusBadge map={VEHICLE_STATUS} value={v.status} />{v.published ? <Badge tone="green">En la web</Badge> : <Badge>No publicado</Badge>}
          <Link className="btn" href={`/autos/${v.slug}?vista=previa`} target="_blank"><Eye className="size-4" />Vista previa</Link>
          {can(a, "web.publish") && sellable && <InlineAction action={publishAction} fields={{ id: v.id, publish: v.published ? "0" : "1" }} label={v.published ? "Despublicar" : "Publicar"} className={v.published ? "btn" : "btn btn-primary"} />}
        </>} />
      {v.status === "RESERVADO" && <div className="mb-3"><Notice>Unidad reservada: se muestra como «Reservado» en la web y no admite nuevas reservas.</Notice></div>}
      {!sellable && <div className="mb-3"><Notice tone="red">Unidad {v.status.toLowerCase()}: no se puede publicar.</Notice></div>}
      {!can(a, "web.publish") && <p className="mb-3 text-xs text-muted">Tu rol prepara fotos; la publicación la realiza alguien con permiso de publicar.</p>}
      <Card title="Cargar fotografías" className="mb-4">
        <ActionForm action={uploadPhotosAction} resetOnOk className="flex flex-wrap items-center gap-2 space-y-0">
          <input type="hidden" name="id" value={v.id} />
          <input type="file" name="photos" accept="image/*" capture="environment" multiple required className="text-sm file:mr-2 file:rounded-lg file:border file:border-line file:bg-surface file:px-3 file:py-1.5" />
          <Submit pendingText="Subiendo…">Subir</Submit>
          <p className="w-full text-[11px] text-muted">Desde el celular se abre la cámara. JPG, PNG, WEBP o HEIC hasta 8 MB cada una. La primera foto queda como portada si no hay otra.</p>
        </ActionForm>
      </Card>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {v.photos.map((p, i) => (
          <div key={p.id} className={`card overflow-hidden ${p.isCover ? "ring-2 ring-accent" : ""}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={`Foto ${i + 1}`} className="aspect-[4/3] w-full object-cover" />
            <div className="flex items-center justify-between gap-1 p-2">
              <span className="text-xs text-muted">{i + 1}{p.isCover && " · Portada"}</span>
              <div className="flex gap-1">
                {!p.isCover && <InlineAction action={photoAction} fields={{ vehicleId: v.id, photoId: p.id, op: "cover" }} label={<Star className="size-3.5" />} className="btn btn-sm px-2" />}
                {i > 0 && <InlineAction action={photoAction} fields={{ vehicleId: v.id, photoId: p.id, op: "up" }} label={<ArrowUp className="size-3.5" />} className="btn btn-sm px-2" />}
                {i < v.photos.length - 1 && <InlineAction action={photoAction} fields={{ vehicleId: v.id, photoId: p.id, op: "down" }} label={<ArrowDown className="size-3.5" />} className="btn btn-sm px-2" />}
                <InlineAction action={photoAction} fields={{ vehicleId: v.id, photoId: p.id, op: "delete" }} label={<Trash2 className="size-3.5" />} className="btn btn-sm btn-danger px-2" />
              </div>
            </div>
          </div>))}
      </div>
    </>
  );
}
