import Link from "next/link";
import { SearchX } from "lucide-react";

/** Registro inexistente o fuera de las sucursales del usuario: no revela cuál de los dos casos es. */
export default function PanelNotFound() {
  return (
    <div className="card mx-auto mt-10 max-w-md p-6 text-center">
      <SearchX className="mx-auto size-8 text-accent" />
      <h1 className="mt-2 text-lg font-semibold">Registro no encontrado</h1>
      <p className="mt-1 text-sm text-muted">No existe o no pertenece a tus sucursales.</p>
      <Link href="/panel" className="btn mt-4">Volver al inicio</Link>
    </div>
  );
}
