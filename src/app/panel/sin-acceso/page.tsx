import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export default function NoAccess() {
  return (
    <div className="card mx-auto mt-10 max-w-md p-6 text-center">
      <ShieldAlert className="mx-auto size-8 text-accent" />
      <h1 className="mt-2 text-lg font-semibold">Acceso restringido</h1>
      <p className="mt-1 text-sm text-muted">Tu rol no tiene permiso para ver esta sección. Si lo necesitas, pide a un administrador que ajuste tu acceso.</p>
      <Link href="/panel" className="btn mt-4">Volver al inicio</Link>
    </div>
  );
}
