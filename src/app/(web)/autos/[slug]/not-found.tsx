import Link from "next/link";
import { loadSite, Shell } from "../../site";

/** Unidad vendida, retirada o inexistente: responde 404 (no indexable) con salida al catálogo. */
export default async function VehicleNotFound() {
  const ctx = await loadSite({});
  return (
    <Shell {...ctx}>
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Este vehículo ya no está disponible</h1>
        <p className="mt-2 text-muted">
          Puede haberse vendido o retirado de la venta. Revisa otras unidades similares en nuestro inventario.
        </p>
        <Link href={ctx.href("/autos")} className="btn btn-primary mt-6">
          Ver autos disponibles
        </Link>
      </div>
    </Shell>
  );
}
