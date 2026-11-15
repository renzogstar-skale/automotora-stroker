import { randomUUID } from "node:crypto";
import { PublicForm } from "../public-form";
import { Shell, loadSite, trackView } from "../site";

export const dynamic = "force-dynamic";
export const metadata = { title: "Consigna tu auto" };

export default async function Consign({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await loadSite(await searchParams);
  if (!ctx.preview) await trackView("VIEW", "/consignar");
  const year = new Date().getFullYear();
  return (
    <Shell {...ctx}>
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <h1 className="text-3xl font-bold tracking-tight">Consigna tu auto con nosotros</h1>
          <p className="mt-3 text-muted">Nos encargamos de la tasación, las fotos, la publicación, las visitas y los trámites. Puedes dejarlo en sucursal (consignación física) o mantenerlo contigo mientras lo publicamos (online).</p>
          <ol className="mt-6 space-y-3 text-sm">
            {["Envíanos los datos de tu auto.", "Te llamamos para coordinar la tasación.", "Firmamos el mandato y publicamos.", "Al venderse, te liquidamos el monto acordado."].map((t, i) => <li key={t} className="flex gap-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-white">{i + 1}</span>{t}</li>)}
          </ol>
        </div>
        <div className="card p-5 lg:col-span-3">
          <PublicForm kind="CONSIGNACION" token={randomUUID()} submit="Enviar datos de mi auto" fields={[
            { name: "name", label: "Nombre", required: true }, { name: "phone", label: "Teléfono", type: "tel", required: true },
            { name: "email", label: "Correo", type: "email", full: true },
            { name: "brand", label: "Marca", required: true }, { name: "model", label: "Modelo", required: true },
            { name: "year", label: "Año", type: "number", required: true, placeholder: String(year - 5) }, { name: "km", label: "Kilometraje", type: "number", required: true },
            { name: "expected", label: "Precio esperado (CLP)", type: "number" },
            { name: "branchId", label: "Sucursal", required: true, options: ctx.site.branches.filter((b) => b.visible).map((b) => [b.id, b.name] as [string, string]) },
            { name: "message", label: "Comentarios", type: "textarea" },
          ]} />
        </div>
      </div>
    </Shell>
  );
}
