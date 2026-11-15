import Link from "next/link";
import { notFound } from "next/navigation";
import { randomUUID } from "node:crypto";
import { Camera, FileSignature, Globe, ShoppingCart, ExternalLink } from "lucide-react";

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
import { can, branchScope, oppScope } from "@/lib/rbac";
import { RES_STATUS, VEHICLE_STATUS, PAYMENT_METHODS } from "@/lib/labels";
import { clp, date, dateTime, daysBetween, km, fmtPlate } from "@/lib/format";
import { expireReservations } from "@/server/inventory";
import { signed } from "@/server/categories";
import { Badge, Card, Field, Notice, PageHeader, StatusBadge, Table } from "@/components/ui";
import { ActionForm, InlineAction, Submit } from "@/components/client/forms";
import {
  cancelReservationAction,
  changeVehicleStatusAction,
  prepExpenseAction,
  publishAction,
  reserveAction,
  retireAction,
  updateVehicleAction,
} from "../actions";

export default async function Vehicle({ params }: { params: Promise<{ id: string }> }) {
  const a = await guard("inventory");
  const { id } = await params;
  await expireReservations(id);
  const v = await db.vehicle.findUnique({
    where: { id },
    include: {
      branch: true,
      photos: { orderBy: { order: "asc" } },
      consignment: { include: { owner: true } },
      reservations: { include: { contact: true, payments: true }, orderBy: { createdAt: "desc" } },
      sales: { include: { contact: true } },
      movements: { include: { category: true }, orderBy: { date: "desc" } },
      documents: true,
    },
  });
  const bs = branchScope(a);
  if (!v || (bs && !bs.includes(v.branchId))) notFound();

  const history = await db.auditLog.findMany({
    where: {
      entityId: {
        in: [v.id, ...v.reservations.map((r) => r.id), ...v.sales.map((s) => s.id), ...(v.consignment ? [v.consignment.id] : [])],
      },
    },
    orderBy: { createdAt: "desc" },
    take: 40,
  });

  const showCost = can(a, "inventory.cost");
  const prep = -v.movements.filter((m) => m.category.name === "Preparación de vehículo").reduce((t, m) => t + signed(m), 0);
  const active = v.reservations.find((r) => r.status === "ACTIVA");
  const opps = can(a, "sales.edit")
    ? await db.opportunity.findMany({
        where: { ...oppScope(a), deletedAt: null, closedAt: null, branchId: v.branchId },
        include: { contact: true },
        orderBy: { createdAt: "desc" },
        take: 150,
      })
    : [];

  return (
    <>
      <PageHeader
        title={`${v.brand} ${v.model} ${v.year}`}
        desc={
          <>
            {v.stockCode ? <span className="font-mono font-bold mr-1">[{v.stockCode}]</span> : null}
            {v.version} · {fmtPlate(v.plate)} · {v.branch.name} · {daysBetween(v.stockSince)} días en stock
          </>
        }
        actions={
          <>
            <StatusBadge map={VEHICLE_STATUS} value={v.status} />
            {v.ownership === "CONSIGNADO" && <Badge tone="violet">Consignado</Badge>}
            {v.published ? <Badge tone="green">Publicado</Badge> : <Badge>No publicado</Badge>}
            {v.source === "INSTAGRAM_OFFICIAL" && <Badge tone="teal">Instagram Oficial</Badge>}
            {can(a, "albums") && (
              <Link className="btn" href={`/panel/albumes/${v.id}`}>
                <Camera className="size-4" />Fotos ({v.photos.length})
              </Link>
            )}
            {can(a, "web.publish") && (
              <InlineAction
                action={publishAction}
                fields={{ id: v.id, publish: v.published ? "0" : "1" }}
                label={
                  <>
                    <Globe className="size-4" />
                    {v.published ? "Despublicar" : "Publicar"}
                  </>
                }
                className="btn"
              />
            )}
            {can(a, "documents") && (
              <Link className="btn" href={`/panel/documentos?nuevo=1&vehicle=${v.id}`}>
                <FileSignature className="size-4" />Documento
              </Link>
            )}
            {can(a, "sales.edit") && ["DISPONIBLE", "RESERVADO"].includes(v.status) && (
              <Link className="btn btn-primary" href={`/panel/ventas/nueva?vehicle=${v.id}${active?.opportunityId ? `&opp=${active.opportunityId}` : ""}`}>
                <ShoppingCart className="size-4" />Vender
              </Link>
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Fotos */}
          <div className="grid grid-cols-3 gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {(v.photos.length ? v.photos : [{ id: "p", url: "/demo/placeholder.svg" }])
              .slice(0, 3)
              .map((p, i) => (
                <img
                  key={p.id}
                  src={p.url}
                  alt=""
                  className={`aspect-[4/3] w-full rounded-lg object-cover ${i === 0 ? "col-span-3 sm:col-span-2 sm:row-span-2" : "hidden sm:block"}`}
                />
              ))}
          </div>

          {/* Gestión Rápida de Estados Comerciales (Fase 7) */}
          <Card title="Control de Estado Comercial" sub="Actualizar disponibilidad según Fase 7">
            <div className="flex flex-wrap gap-2">
              {v.status !== "DISPONIBLE" && (
                <InlineAction action={changeVehicleStatusAction} fields={{ id: v.id, status: "DISPONIBLE" }} label="🟢 Marcar Disponible" className="btn btn-sm" />
              )}
              {v.status !== "RESERVADO" && (
                <InlineAction action={changeVehicleStatusAction} fields={{ id: v.id, status: "RESERVADO" }} label="🟠 Marcar Reservado" className="btn btn-sm" />
              )}
              {v.status !== "VENDIDO" && (
                <InlineAction action={changeVehicleStatusAction} fields={{ id: v.id, status: "VENDIDO" }} label="🔴 Marcar Vendido" className="btn btn-sm btn-danger" confirm />
              )}
              {v.status !== "EN_CONSIGNACION" && (
                <InlineAction action={changeVehicleStatusAction} fields={{ id: v.id, status: "EN_CONSIGNACION" }} label="🟣 En Consignación" className="btn btn-sm" />
              )}
              {v.status !== "POR_CONFIRMAR" && (
                <InlineAction action={changeVehicleStatusAction} fields={{ id: v.id, status: "POR_CONFIRMAR" }} label="⚪ Por Confirmar" className="btn btn-sm" />
              )}
            </div>
          </Card>

          {/* Datos del vehículo */}
          <Card title="Datos del vehículo">
            {can(a, "inventory.edit") ? (
              <ActionForm action={updateVehicleAction} className="grid gap-3 space-y-0 sm:grid-cols-3">
                <input type="hidden" name="id" value={v.id} />
                <Field label="Código Stock"><input name="stockCode" defaultValue={v.stockCode ?? ""} className="input" /></Field>
                <Field label="Versión"><input name="version" defaultValue={v.version} className="input" /></Field>
                <Field label="Precio publicado"><input name="price" defaultValue={v.price} inputMode="numeric" className="input" /></Field>
                <Field label="Kilometraje"><input name="km" defaultValue={v.km} inputMode="numeric" className="input" /></Field>
                <Field label="Pie Mínimo Referencial"><input name="minDownPayment" defaultValue={v.minDownPayment ?? ""} inputMode="numeric" placeholder="Ej: 3000000" className="input" /></Field>
                <Field label="Color"><input name="color" defaultValue={v.color} className="input" /></Field>
                <Field label="VIN"><input name="vin" defaultValue={v.vin ?? ""} className="input" /></Field>
                <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" name="featured" defaultChecked={v.featured} />Destacado en la web</label>
                <Field label="Descripción comercial" className="sm:col-span-3"><textarea name="description" rows={3} defaultValue={v.description ?? ""} className="input" /></Field>
                <div className="flex justify-end sm:col-span-3"><Submit>Guardar Cambios</Submit></div>
              </ActionForm>
            ) : (
              <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <dt className="text-muted">Precio</dt><dd>{clp(v.price)}</dd>
                <dt className="text-muted">Km</dt><dd>{km(v.km)}</dd>
                <dt className="text-muted">Transmisión</dt><dd>{v.transmission}</dd>
                <dt className="text-muted">Combustible</dt><dd>{v.fuel}</dd>
              </dl>
            )}
            <p className="mt-3 text-xs text-muted">
              {v.transmission} · {v.fuel} · {v.bodyType} · {v.condition === "NUEVO" ? "Nuevo" : "Usado"} · ingreso {date(v.stockSince)}
            </p>
          </Card>

          {/* Datos extraídos de Instagram */}
          {(v.instagramUrl || v.originalCaption) && (
            <Card title="Datos extraídos de Instagram" sub="Fuente original: @automotora_stroker">
              <div className="space-y-3">
                {v.instagramUrl && (
                  <div className="flex items-center gap-2">
                    <InstagramIcon className="size-4 text-pink-500" />
                    <a href={v.instagramUrl} target="_blank" rel="noopener noreferrer" className="link text-xs font-semibold text-pink-600 dark:text-pink-400">
                      Ver publicación oficial en Instagram
                    </a>
                  </div>
                )}
                {v.originalCaption && (
                  <div>
                    <span className="text-xs font-bold text-muted block mb-1">Pie de publicación original (Caption):</span>
                    <div className="whitespace-pre-line rounded-lg bg-surface-2 p-3 font-mono text-xs leading-relaxed max-h-52 overflow-y-auto border border-line">
                      {v.originalCaption}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Historial del vehículo */}
          <Card title="Historial del vehículo" sub="Ingreso, precios, estados, reservas y ventas" bodyClass="p-0">
            <ol>
              {history.map((h) => (
                <li key={h.id} className="border-b border-line px-4 py-2 text-sm last:border-0">
                  {h.summary}
                  <div className="text-xs text-muted">{h.actorName} · {dateTime(h.createdAt)}</div>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        {/* Columna Lateral */}
        <div className="space-y-4">
          {showCost && (
            <Card title="Economía de la unidad">
              <dl className="grid grid-cols-2 gap-y-1 text-sm">
                <dt className="text-muted">Precio publicado</dt><dd className="num">{clp(v.price)}</dd>
                <dt className="text-muted">{v.ownership === "PROPIO" ? "Costo de adquisición" : "Monto a liquidar al propietario"}</dt><dd className="num">{clp(v.cost)}</dd>
                <dt className="text-muted">Preparación</dt><dd className="num">{clp(prep)}</dd>
                <dt className="font-medium">Margen estimado</dt><dd className="num font-semibold">{clp(v.price - v.cost - prep)}</dd>
              </dl>
              {can(a, "inventory.edit") && (
                <ActionForm action={prepExpenseAction} resetOnOk className="mt-3 flex flex-wrap gap-2 space-y-0">
                  <input type="hidden" name="id" value={v.id} />
                  <input name="desc" placeholder="Detalle (pulido, mantención…)" className="input h-8 flex-1 text-xs" />
                  <input name="amount" placeholder="Monto" inputMode="numeric" className="input h-8 w-24 text-xs" />
                  <Submit className="btn btn-sm">Agregar gasto</Submit>
                </ActionForm>
              )}
            </Card>
          )}

          {v.consignment && (
            <Card title="Consignación">
              <p className="text-sm">Propietario: {v.consignment.owner.name}</p>
              <p className="text-sm text-muted">Modalidad {v.consignment.modality === "FISICA" ? "física" : "online"} · vence {date(v.consignment.endDate)}</p>
              <Link className="link text-sm" href={`/panel/consignaciones/${v.consignment.id}`}>Ver consignación</Link>
            </Card>
          )}

          <Card title="Reserva">
            {active ? (
              <div className="space-y-2 text-sm">
                <Notice tone="amber">Reservado para <b>{active.contact.name}</b> por {clp(active.amount)} hasta {dateTime(active.expiresAt)}. No se aceptan nuevas reservas.</Notice>
                {can(a, "documents") && <Link className="btn btn-sm" href={`/panel/documentos?nuevo=1&reservation=${active.id}`}><FileSignature className="size-4" />Comprobante de reserva</Link>}
                {can(a, "sales.edit") && <InlineAction action={cancelReservationAction} fields={{ id: active.id }} reasonLabel="Motivo" label="Anular reserva" className="btn btn-sm btn-danger" />}
              </div>
            ) : v.status === "DISPONIBLE" && can(a, "sales.edit") ? (
              <ActionForm action={reserveAction} className="space-y-2">
                <input type="hidden" name="vehicleId" value={v.id} /><input type="hidden" name="key" value={randomUUID()} />
                <Field label="Cliente / oportunidad"><select name="opportunityId" required className="input"><option value="">Selecciona…</option>{opps.map((o) => <option key={o.id} value={o.id}>{o.contact.name}</option>)}</select></Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Abono (CLP)"><input name="amount" inputMode="numeric" defaultValue={300000} className="input" /></Field>
                  <Field label="Vigencia (días)"><input name="days" type="number" min={1} max={30} defaultValue={3} className="input" /></Field>
                </div>
                <Field label="Medio de pago"><select name="method" className="input">{PAYMENT_METHODS.filter((m) => m !== "Parte de pago").map((m) => <option key={m}>{m}</option>)}</select></Field>
                <Submit className="btn btn-dark w-full">Reservar unidad</Submit>
                <p className="text-[11px] text-muted">El abono queda imputado al precio y reduce el saldo al vender.</p>
              </ActionForm>
            ) : <p className="text-sm text-muted">Sin reserva activa.</p>}
            {v.reservations.filter((r) => r !== active).length > 0 && (
              <ul className="mt-3 border-t border-line pt-2 text-xs">
                {v.reservations.filter((r) => r !== active).map((r) => (
                  <li key={r.id} className="flex justify-between py-0.5">
                    <span>{r.contact.name} · {clp(r.amount)}</span>
                    <StatusBadge map={RES_STATUS} value={r.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {v.sales.length > 0 && (
            <Card title="Ventas" bodyClass="p-0">
              <Table>
                <tbody>
                  {v.sales.map((s) => (
                    <tr key={s.id}>
                      <td><Link className="link" href={`/panel/ventas/${s.id}`}>#{s.number}</Link> {s.contact.name}</td>
                      <td>{s.status === "ANULADA" ? <Badge tone="red">Anulada</Badge> : <Badge tone="green">Confirmada</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          )}

          {can(a, "inventory.edit") && !["VENDIDO", "RETIRADO"].includes(v.status) && (
            <Card title="Retirar del inventario">
              <InlineAction action={retireAction} fields={{ id: v.id }} reasonLabel="Motivo del retiro" label="Retirar" className="btn btn-sm btn-danger" confirm />
              <p className="mt-1 text-[11px] text-muted">Despublica la unidad y anula la reserva activa.</p>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
