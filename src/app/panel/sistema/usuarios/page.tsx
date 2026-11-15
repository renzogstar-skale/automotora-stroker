import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { guard } from "@/lib/auth";
import { db } from "@/lib/db";
import { sp } from "@/lib/period";
import { dateTime } from "@/lib/format";
import { ROLE_LABEL } from "@/lib/labels";
import { Badge, Card, Empty, Field, PageHeader, Table } from "@/components/ui";
import { ActionForm, InlineAction, Submit } from "@/components/client/forms";
import { inviteAction, accessAction, deactivateAction, reactivateAction, revokeAction, recoverAction } from "./actions";

export const metadata = { title: "Usuarios" };
type SP = Record<string, string | string[] | undefined>;

const status = (u: { active: boolean; passwordHash: string | null }) =>
  !u.active ? <Badge tone="gray">Desactivada</Badge> : u.passwordHash ? <Badge tone="green">Activa</Badge> : <Badge tone="amber">Invitación pendiente</Badge>;

export default async function UsuariosPage({ searchParams }: { searchParams: Promise<SP> }) {
  const a = await guard("users");
  const s = await searchParams;
  const q = sp(s, "q"), role = sp(s, "role"), branch = sp(s, "branch"), st = sp(s, "estado");
  const where: Prisma.UserWhereInput = {
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } : {}),
    ...(role && role in ROLE_LABEL ? { role: role as Prisma.UserWhereInput["role"] } : {}),
    ...(branch ? { branches: { some: { branchId: branch } } } : {}),
    ...(st === "activa" ? { active: true, passwordHash: { not: null } } : st === "pendiente" ? { active: true, passwordHash: null } : st === "desactivada" ? { active: false } : {}),
  };
  const now = new Date();
  const [users, branches, sellers] = await Promise.all([
    db.user.findMany({
      where, orderBy: [{ active: "desc" }, { name: "asc" }],
      include: { branches: { include: { branch: true } }, seller: { select: { id: true, name: true } }, _count: { select: { sessions: { where: { revokedAt: null, expiresAt: { gt: now } } } } } },
    }),
    db.branch.findMany({ orderBy: { name: "asc" } }),
    db.seller.findMany({ orderBy: { name: "asc" }, include: { branch: true } }),
  ]);
  const editId = sp(s, "id");
  const edit = editId ? await db.user.findUnique({ where: { id: editId }, include: { branches: true, seller: true } }) : null;
  const history = edit ? await db.auditLog.findMany({ where: { entity: "User", entityId: edit.id }, orderBy: { createdAt: "desc" }, take: 12 }) : [];
  const editBranches = edit?.branches.map((b) => b.branchId) ?? [];
  const freeSellers = sellers.filter((x) => !x.userId || x.userId === edit?.id);
  const self = edit?.id === a.id;

  return (
    <>
      <PageHeader title="Usuarios" desc="Cuentas, roles y sucursales. Los permisos se validan en el servidor; desactivar una cuenta cierra sus sesiones y conserva su historial." />
      <form className="card mb-4 flex flex-wrap items-end gap-2 p-3" role="search">
        <Field label="Buscar" className="min-w-56 flex-1"><input name="q" defaultValue={q} placeholder="Nombre o correo" className="input" /></Field>
        <Field label="Rol"><select name="role" defaultValue={role ?? ""} className="input"><option value="">Todos</option>{Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Sucursal"><select name="branch" defaultValue={branch ?? ""} className="input"><option value="">Todas</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
        <Field label="Estado"><select name="estado" defaultValue={st ?? ""} className="input"><option value="">Todos</option><option value="activa">Activa</option><option value="pendiente">Invitación pendiente</option><option value="desactivada">Desactivada</option></select></Field>
        <button className="btn">Filtrar</button>{(q || role || branch || st) && <Link href="?" className="btn">Limpiar</Link>}
      </form>
      <div className="grid gap-4 xl:grid-cols-3">
        <Card bodyClass="p-0" className="xl:col-span-2" title={`${users.length} cuentas`}>
          {users.length === 0 ? <Empty title="Sin resultados" text="Ninguna cuenta coincide con los filtros." /> : (
            <Table><thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Sucursal</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
              {users.map((u) => (
                <tr key={u.id} className={u.active ? "" : "opacity-60"}>
                  <td className="font-medium">{u.name}<div className="text-xs font-normal text-muted">{u.seller ? `Ficha: ${u.seller.name}` : u.role === "VENDEDOR" ? "Sin ficha" : ""}{u.lastSeenAt ? ` · Visto ${dateTime(u.lastSeenAt)}` : ""}</div></td>
                  <td className="text-xs">{u.email}</td>
                  <td>{ROLE_LABEL[u.role]}{u.role === "FOTOGRAFO" && u.canPublish && <div className="text-xs text-muted">Puede publicar</div>}</td>
                  <td className="text-xs">{u.branches.map((b) => b.branch.name).join(", ")}</td>
                  <td>{status(u)}{u._count.sessions > 0 && <div className="text-xs text-muted">{u._count.sessions} sesiones</div>}</td>
                  <td className="whitespace-nowrap text-xs">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Link className="link" href={`?${new URLSearchParams({ ...(q ? { q } : {}), id: u.id })}`}>Editar</Link>
                      {u.id !== a.id && (u.active
                        ? <InlineAction action={deactivateAction} fields={{ id: u.id }} label="Desactivar" confirm />
                        : <InlineAction action={reactivateAction} fields={{ id: u.id }} label="Reactivar" />)}
                      {u.active && <InlineAction action={recoverAction} fields={{ id: u.id }} label={u.passwordHash ? "Recuperar acceso" : "Reenviar invitación"} />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody></Table>
          )}
        </Card>

        <div className="space-y-4">
          <Card title={edit ? `Permisos · ${edit.name}` : "Invitar usuario"} action={edit && <Link href="?" className="link text-xs">Nueva invitación</Link>}>
            <ActionForm key={edit?.id ?? "new"} action={edit ? accessAction : inviteAction} resetOnOk={!edit} className="grid grid-cols-2 gap-2 space-y-0">
              {edit ? <input type="hidden" name="id" value={edit.id} /> : <>
                <Field label="Nombre" className="col-span-2"><input name="name" required minLength={3} className="input" /></Field>
                <Field label="Correo" className="col-span-2"><input name="email" type="email" required className="input" /></Field>
              </>}
              <Field label="Rol" className="col-span-2" hint={self ? "No puedes cambiar tu propio rol." : undefined}>
                <select name="role" defaultValue={edit?.role ?? "VENDEDOR"} disabled={self} className="input">{Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              </Field>
              {self && <input type="hidden" name="role" value={edit.role} />}
              <fieldset className="col-span-2"><legend className="mb-1 text-xs font-medium text-muted">Sucursales</legend>
                {branches.map((b) => <label key={b.id} className="mr-4 inline-flex items-center gap-1.5 text-sm"><input type="checkbox" name="branchIds" value={b.id} defaultChecked={editBranches.includes(b.id)} />{b.name}</label>)}
              </fieldset>
              <Field label="Ficha comercial (vendedor)" className="col-span-2" hint="Vincula la cuenta con la ficha por su identificador estable; obligatoria para el rol Vendedor.">
                <select name="seller" defaultValue={edit?.seller?.id ?? ""} className="input">
                  <option value="">Sin ficha</option><option value="new">Crear ficha nueva</option>
                  {freeSellers.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.branch.name}</option>)}
                </select>
              </Field>
              <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" name="canPublish" defaultChecked={edit?.canPublish ?? false} />Puede publicar en la web (aplica a Fotógrafo)</label>
              <div className="col-span-2 flex justify-end"><Submit>{edit ? "Guardar permisos" : "Enviar invitación"}</Submit></div>
            </ActionForm>
          </Card>

          {edit && (
            <Card title="Sesiones e historial" sub={<>Cuenta {edit.active ? "activa" : "desactivada"} · creada {dateTime(edit.createdAt)}</>}>
              <div className="mb-3"><InlineAction action={revokeAction} fields={{ id: edit.id }} label="Cerrar todas las sesiones" confirm /></div>
              {history.length === 0 ? <p className="text-sm text-muted">Sin cambios registrados.</p> : (
                <ul className="space-y-2 text-sm">{history.map((h) => <li key={h.id}><div>{h.summary}</div><div className="text-xs text-muted">{h.actorName} · {dateTime(h.createdAt)}</div></li>)}</ul>
              )}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
