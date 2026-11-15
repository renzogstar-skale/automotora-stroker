export default function Loading() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Cargando">
      <div className="h-7 w-48 rounded bg-line" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <div key={i} className="h-20 rounded-xl bg-line/70" />)}</div>
      <div className="h-64 rounded-xl bg-line/60" />
    </div>
  );
}
