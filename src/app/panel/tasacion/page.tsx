import Link from "next/link";
import { guard } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { sp } from "@/lib/period";
import { clp, date, km, normalizePlate, fmtPlate } from "@/lib/format";
import { demoLookup } from "@/server/appraisal";
import { Badge, Card, Field, Notice, PageHeader, Table } from "@/components/ui";
import { ActionForm, Submit } from "@/components/client/forms";
import { appraiseAction } from "./actions";

export default async function Appraisal({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const a = await guard("appraisal");
  const s = await searchParams;
  const raw = sp(s, "patente");
  const norm = raw ? normalizePlate(raw) : null;
  const found = norm ? demoLookup(norm.plate) : null;
  const result = sp(s, "resultado") ? await db.appraisal.findUnique({ where: { id: sp(s, "resultado") } }) : null;
  const recent = await db.appraisal.findMany({ orderBy: { createdAt: "desc" }, take: 12, include: { consignment: true, vehicle: true } });
  const step = result ? 3 : found ? 2 : 1;
  return (
    <>
      <PageHeader title="Tasación" desc="Patente → Vehículo → Tasación. Sin proveedor conectado, los datos y valores se marcan como demo." />
      <ol className="mb-4 flex gap-2 text-sm">
        {["Patente", "Vehículo", "Tasación"].map((l, i) => (
          <li key={l} className={`rounded-full px-3 py-1 ${step === i + 1 ? "bg-accent text-white" : step > i + 1 ? "bg-accent-soft text-accent" : "bg-surface-2 text-muted"}`}>{i + 1}. {l}</li>
        ))}
      </ol>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="1. Patente">
          <form className="flex gap-2" method="get">
            <input name="patente" defaultValue={raw} placeholder="AA1234, BBBB12, motos AA123 / BBB12" className="input uppercase" required aria-label="Patente" />
            <button className="btn btn-dark">Buscar</button>
          </form>
          {raw && !norm && <p className="mt-2 text-sm text-red-700 dark:text-red-400">Formato no reconocido. Autos: AA1234 o BBBB12. Motos: AA123 o BBB12.</p>}
          {norm && <p className="mt-2 text-sm">Normalizada: <b>{fmtPlate(norm.plate)}</b> · {norm.kind === "MOTO" ? "Moto" : "Auto"}</p>}
        </Card>
        {found && !result && (
          <Card title="2. Confirma el vehículo" action={<Badge tone="violet">Datos demo</Badge>}>
            <ActionForm action={appraiseAction} className="grid gap-3 space-y-0 sm:grid-cols-2">
              <input type="hidden" name="plate" value={found.plate} />
              <Field label="Marca"><input name="brand" defaultValue={found.brand} className="input" required /></Field>
              <Field label="Modelo"><input name="model" defaultValue={found.model} className="input" required /></Field>
              <Field label="Versión"><input name="version" defaultValue={found.version} className="input" /></Field>
              <Field label="Año"><input name="year" type="number" defaultValue={found.year} className="input" required /></Field>
              <Field label="Kilometraje"><input name="km" inputMode="numeric" defaultValue={found.km} className="input" required /></Field>
              <Field label="Condición">
                <select name="condition" defaultValue="BUENO" className="input"><option value="EXCELENTE">Excelente</option><option value="BUENO">Bueno</option><option value="REGULAR">Regular</option></select>
              </Field>
              <details className="sm:col-span-2">
                <summary className="cursor-pointer text-sm text-muted">Ingreso manual de valores</summary>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  <label className="flex items-center gap-2 text-sm sm:col-span-3"><input type="checkbox" name="manual" />Usar valores manuales en vez del modelo referencial</label>
                  <Field label="Mínimo"><input name="min" inputMode="numeric" className="input" /></Field>
                  <Field label="Máximo"><input name="max" inputMode="numeric" className="input" /></Field>
                  <Field label="Fuente"><input name="source" placeholder="Portal, concesionario…" className="input" /></Field>
                </div>
              </details>
              <Field label="Notas" className="sm:col-span-2"><input name="notes" className="input" /></Field>
              <div className="flex justify-end sm:col-span-2"><Submit>Calcular tasación</Submit></div>
            </ActionForm>
          </Card>
        )}
        {result && (
          <Card title={`3. Tasación ${fmtPlate(result.plate)}`} action={result.isDemo ? <Badge tone="violet">Ejemplo demo</Badge> : result.manual ? <Badge tone="blue">Manual</Badge> : null}>
            <p className="text-sm text-muted">{result.brand} {result.model} {result.version} {result.year} · {km(result.km)} · {result.condition.toLowerCase()}</p>
            <div className="my-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-surface-2 p-2"><p className="text-xs text-muted">Mínimo</p><p className="font-semibold tabular-nums">{clp(result.minValue)}</p></div>
              <div className="rounded-lg bg-accent-soft p-2"><p className="text-xs text-muted">Sugerido</p><p className="font-semibold tabular-nums">{clp(result.suggested)}</p></div>
              <div className="rounded-lg bg-surface-2 p-2"><p className="text-xs text-muted">Máximo</p><p className="font-semibold tabular-nums">{clp(result.maxValue)}</p></div>
            </div>
            <p className="text-xs text-muted">Fuente: {result.source} · {date(result.sourceDate)}</p>
            {result.isDemo && <div className="mt-2"><Notice>Valor referencial de demostración. Conecta un proveedor de tasación para valores de mercado.</Notice></div>}
            <div className="mt-3 flex flex-wrap gap-2">
              {can(a, "consignments") && <Link className="btn btn-primary" href={`/panel/consignaciones/nueva?appraisal=${result.id}`}>Crear consignación</Link>}
              {can(a, "sales.edit") && <Link className="btn" href={`/panel/ventas/nueva?appraisal=${result.id}`}>Usar como parte de pago</Link>}
              <Link className="btn btn-ghost" href="/panel/tasacion">Nueva tasación</Link>
            </div>
          </Card>
        )}
      </div>
      <Card title="Tasaciones recientes" className="mt-4" bodyClass="p-0">
        <Table>
          <thead><tr><th>Fecha</th><th>Patente</th><th>Vehículo</th><th className="num">Rango</th><th>Fuente</th><th>Vínculo</th></tr></thead>
          <tbody>
            {recent.map((r) => (
              <tr key={r.id}>
                <td>{date(r.createdAt)}</td>
                <td><Link className="link" href={`/panel/tasacion?resultado=${r.id}`}>{fmtPlate(r.plate)}</Link></td>
                <td>{r.brand} {r.model} {r.year}</td>
                <td className="num">{clp(r.minValue)} – {clp(r.maxValue)}</td>
                <td className="text-xs">{r.source}{r.isDemo && <Badge tone="violet" className="ml-1">demo</Badge>}</td>
                <td className="text-xs">{r.consignment ? <Link className="link" href={`/panel/consignaciones/${r.consignment.id}`}>Consignación</Link> : r.vehicle ? <Link className="link" href={`/panel/inventario/${r.vehicle.id}`}>Parte de pago</Link> : "—"}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
