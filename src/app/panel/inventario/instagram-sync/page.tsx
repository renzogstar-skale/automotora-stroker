import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock, ExternalLink, HelpCircle, ShieldCheck, XCircle } from "lucide-react";

function InstagramIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
    </svg>
  );
}
import { guard } from "@/lib/auth";
import { db } from "@/lib/db";
import { clp, dateTime } from "@/lib/format";
import { Badge, Card, PageHeader, Table } from "@/components/ui";
import { InlineAction } from "@/components/client/forms";
import { approveInstagramImportAction, rejectInstagramImportAction } from "../actions";

export default async function InstagramSyncPage() {
  const a = await guard("inventory");

  const [imports, totalCount, approvedCount, pendingCount] = await Promise.all([
    db.instagramImport.findMany({
      orderBy: [{ createdAt: "desc" }],
    }),
    db.instagramImport.count(),
    db.instagramImport.count({ where: { status: "APROBADO" } }),
    db.instagramImport.count({ where: { status: "PENDIENTE" } }),
  ]);

  return (
    <>
      <PageHeader
        title="Sincronización Manual Instagram"
        desc="Extracción y homologación de inventario desde @automotora_stroker con aprobación previa al catálogo público"
        actions={
          <Link href="/panel/inventario" className="btn">
            <ArrowLeft className="size-4" />
            <span>Volver a Inventario</span>
          </Link>
        }
      />

      {/* Tarjetas de Resumen de Extracción */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="card p-4 bg-surface border border-line">
          <span className="text-xs font-bold uppercase text-muted block">Publicaciones Revisadas</span>
          <span className="text-2xl font-black text-ink mt-1 block">{totalCount}</span>
        </div>
        <div className="card p-4 bg-surface border border-line">
          <span className="text-xs font-bold uppercase text-emerald-600 block">Vehículos Aprobados</span>
          <span className="text-2xl font-black text-emerald-600 mt-1 block">{approvedCount}</span>
        </div>
        <div className="card p-4 bg-surface border border-line">
          <span className="text-xs font-bold uppercase text-amber-600 block">Pendientes / Archivo</span>
          <span className="text-2xl font-black text-amber-600 mt-1 block">{pendingCount}</span>
        </div>
        <div className="card p-4 bg-surface border border-line">
          <span className="text-xs font-bold uppercase text-pink-600 block">Fuente Oficial</span>
          <span className="text-sm font-bold text-ink mt-2 flex items-center gap-1 truncate">
            <InstagramIcon className="size-4 text-pink-500" />
            @automotora_stroker
          </span>
        </div>
      </div>

      {/* Protocolo de Control de Calidad */}
      <div className="card p-4 bg-pink-500/5 border border-pink-500/20 mb-6 text-xs text-muted flex items-start gap-3 rounded-xl">
        <ShieldCheck className="size-5 text-pink-500 shrink-0 mt-0.5" />
        <div>
          <h3 className="font-bold text-ink text-sm">Protocolo de Sincronización Manual y Aprobación</h3>
          <p className="mt-1">
            Cada publicación extraída se almacena localmente con sus fotografías de alta resolución en almacenamiento persistente del proyecto.
            Ninguna publicación afecta el catálogo público sin validación de su estado comercial real (Disponible, Reservado o Vendido).
          </p>
        </div>
      </div>

      {/* Tabla de Publicaciones Extraídas */}
      <Card title="Publicaciones Extraídas de Instagram" sub="Cola de verificación y control administrativo" bodyClass="p-0">
        <Table>
          <thead>
            <tr>
              <th>Miniatura</th>
              <th>Vehículo Detectado</th>
              <th>Precio CLP</th>
              <th>Estado Comercial</th>
              <th>Estado Importación</th>
              <th>Revisado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {imports.map((item) => {
              const data = (item.extractedData as any) || {};
              const thumb = item.localPhotos?.[0] || item.mediaUrls?.[0] || "/demo/placeholder.svg";
              const isApproved = item.status === "APROBADO";
              const isPending = item.status === "PENDIENTE";

              return (
                <tr key={item.id}>
                  <td>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={thumb}
                      alt=""
                      className="h-12 w-16 rounded-md object-cover border border-line"
                      loading="lazy"
                    />
                  </td>
                  <td>
                    <div className="font-bold text-ink">
                      {data.brand || "Sin marca"} {data.model || "Sin modelo"} {data.year ? `(${data.year})` : ""}
                    </div>
                    <div className="text-xs text-muted truncate max-w-xs">{data.version || item.caption.slice(0, 60)}…</div>
                    <a
                      href={item.postUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-pink-600 hover:underline inline-flex items-center gap-1 mt-1 font-semibold"
                    >
                      <ExternalLink className="size-3" />
                      <span>Ver en Instagram</span>
                    </a>
                  </td>
                  <td className="font-mono font-bold text-accent">
                    {data.priceCLP ? clp(data.priceCLP) : "A consultar"}
                  </td>
                  <td>
                    {item.commercialStatus === "VENDIDO" ? (
                      <Badge tone="red">🔴 Vendido</Badge>
                    ) : item.commercialStatus === "RESERVADO" ? (
                      <Badge tone="amber">🟠 Reservado</Badge>
                    ) : item.commercialStatus === "EN_CONSIGNACION" ? (
                      <Badge tone="violet">🟣 Consignación</Badge>
                    ) : item.commercialStatus === "POR_CONFIRMAR" ? (
                      <Badge tone="gray">⚪ Por confirmar</Badge>
                    ) : (
                      <Badge tone="green">🟢 Disponible</Badge>
                    )}
                  </td>
                  <td>
                    {isApproved ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                        <CheckCircle2 className="size-3.5" /> Aprobado
                      </span>
                    ) : isPending ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600">
                        <Clock className="size-3.5" /> Pendiente
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-muted">
                        <XCircle className="size-3.5" /> {item.status}
                      </span>
                    )}
                  </td>
                  <td className="text-xs text-muted">
                    {item.reviewedAt ? dateTime(item.reviewedAt) : "Sin revisar"}
                    {item.reviewedBy ? <div className="text-[10px] text-muted">por {item.reviewedBy}</div> : null}
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      {!isApproved && (
                        <InlineAction
                          action={approveInstagramImportAction}
                          fields={{ id: item.id }}
                          label="Aprobar"
                          className="btn btn-sm btn-dark"
                        />
                      )}
                      {item.status !== "RECHAZADO" && !isApproved && (
                        <InlineAction
                          action={rejectInstagramImportAction}
                          fields={{ id: item.id }}
                          label="Descartar"
                          className="btn btn-sm btn-ghost"
                        />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
