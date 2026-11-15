import { randomUUID } from "node:crypto";
import { PublicForm } from "../public-form";
import { MapPin } from "lucide-react";
import { BUSINESS } from "@/lib/business";
import { Shell, loadSite, trackView } from "../site";

export const dynamic = "force-dynamic";
export const metadata = { title: "Consigna tu auto" };

export default async function Consign({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await loadSite(await searchParams);
  if (!ctx.preview) await trackView("VIEW", "/consignar");
  const year = new Date().getFullYear();
  const intakeBranch = (ctx.site.branches.find((b) => b.visible) ?? ctx.site.branches[0])?.id;
  return (
    <Shell {...ctx}>
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <h1 className="text-3xl font-bold tracking-tight">Consigna tu auto con nosotros</h1>
          <p className="mt-3 text-muted">Nos encargamos de la tasación, las fotos, la publicación, las visitas y los trámites. Puedes dejarlo en nuestro showroom de Antofagasta (consignación física) o mantenerlo contigo mientras lo publicamos (online).</p>
          <ol className="mt-6 space-y-3 text-sm">
            {["Envíanos los datos de tu auto.", "Te llamamos para coordinar la tasación.", "Firmamos el mandato y publicamos.", "Al venderse, te liquidamos el monto acordado."].map((t, i) => <li key={t} className="flex gap-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-white">{i + 1}</span>{t}</li>)}
          </ol>
        </div>
        <div className="card p-5 lg:col-span-3">
          <p className="mb-4 flex items-start gap-2 rounded-lg bg-surface-2 p-3 text-xs text-muted"><MapPin className="mt-0.5 size-4 shrink-0 text-accent" /><span><strong className="text-ink">{BUSINESS.showroom}</strong> · {BUSINESS.address}</span></p>
          {/* La sucursal interna solo enruta el lead en el CRM; al público se muestra la sede confirmada. */}
          <PublicForm kind="CONSIGNACION" token={randomUUID()} submit="Enviar datos de mi auto" hidden={intakeBranch ? { branchId: intakeBranch } : undefined} fields={[
            { name: "name", label: "Nombre", required: true }, { name: "phone", label: "Teléfono", type: "tel", required: true },
            { name: "email", label: "Correo", type: "email", full: true },
            { name: "brand", label: "Marca", required: true }, { name: "model", label: "Modelo", required: true },
            { name: "year", label: "Año", type: "number", required: true, placeholder: String(year - 5) }, { name: "km", label: "Kilometraje", type: "number", required: true },
            { name: "expected", label: "Precio esperado (CLP)", type: "number" },
            { name: "message", label: "Comentarios", type: "textarea" },
          ]} />
        </div>
      </div>
    </Shell>
  );
}
