"use client";
export default function PanelError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card mx-auto mt-10 max-w-md p-6 text-center">
      <h1 className="text-lg font-semibold">No pudimos cargar esta vista</h1>
      <p className="mt-1 text-sm text-muted">{error.message?.length < 160 ? error.message : "Error inesperado."}</p>
      <button onClick={reset} className="btn btn-primary mt-4">Reintentar</button>
    </div>
  );
}
