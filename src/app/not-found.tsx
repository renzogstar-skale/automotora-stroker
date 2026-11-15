import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-2xl font-bold">Página no encontrada</h1>
      <p className="mt-2 text-muted">La dirección no existe o ya no está disponible.</p>
      <Link href="/autos" className="btn btn-primary mt-6">Ver autos disponibles</Link>
    </div>
  );
}
