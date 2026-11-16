// Formatos es-CL: CLP sin decimales, kilómetros y fechas en America/Santiago.
export const TZ = "America/Santiago";
const clpFmt = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const numFmt = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });

export const clp = (n: number | null | undefined) => (n == null ? "—" : clpFmt.format(Math.round(n)));
export const num = (n: number | null | undefined) => (n == null ? "—" : numFmt.format(n));
export const km = (n: number | null | undefined) => {
  if (n == null) return "—";
  if (n <= 0) return "0 km";
  const thousands = n < 1000 ? Math.round(n) : Math.floor(n / 1000);
  return `${numFmt.format(thousands)}.xxx km`;
};
/** Monto abreviado para gráficos ($12,3 M); el valor exacto se muestra en el tooltip. */
export function clpShort(n: number) {
  const a = Math.abs(n);
  if (a >= 1e9) return `$${(n / 1e9).toLocaleString("es-CL", { maximumFractionDigits: 1 })} MM`;
  if (a >= 1e6) return `$${(n / 1e6).toLocaleString("es-CL", { maximumFractionDigits: 1 })} M`;
  if (a >= 1e3) return `$${(n / 1e3).toLocaleString("es-CL", { maximumFractionDigits: 0 })} mil`;
  return clp(n);
}
/** Tasa con numerador/denominador; sin denominador devuelve «Sin datos». */
export function rate(numr: number, den: number) {
  if (!den) return { text: "Sin datos", value: null as number | null, detail: `${numr} / ${den}` };
  const v = numr / den;
  return { text: `${(v * 100).toLocaleString("es-CL", { maximumFractionDigits: 1 })}%`, value: v, detail: `${num(numr)} / ${num(den)}` };
}
export const pct = (v: number | null) => (v == null ? "Sin datos" : `${(v * 100).toLocaleString("es-CL", { maximumFractionDigits: 1 })}%`);

const dtf = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("es-CL", { timeZone: TZ, ...o });
export const date = (d: Date | string | null | undefined) => (d ? dtf({ day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(d)) : "—");
export const dateTime = (d: Date | string | null | undefined) =>
  d ? dtf({ day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(d)) : "—";
export const time = (d: Date | string) => dtf({ hour: "2-digit", minute: "2-digit" }).format(new Date(d));
export const dayLabel = (d: Date | string) => dtf({ weekday: "short", day: "numeric", month: "short" }).format(new Date(d));
export const monthLabel = (d: Date) => dtf({ month: "short", year: "2-digit" }).format(d);

/** Partes de fecha en hora de Santiago. */
export function sclParts(d: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(d).map((x) => [x.type, x.value]),
  );
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, min: +p.minute };
}
/** Instante UTC que corresponde a y-m-d hh:mm en hora de Santiago (maneja horario de verano). */
export function sclDate(y: number, m: number, d: number, h = 0, min = 0) {
  const guess = Date.UTC(y, m - 1, d, h, min);
  const p = sclParts(new Date(guess));
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min);
  return new Date(guess - (asUtc - guess));
}
export const startOfDay = (d = new Date()) => { const p = sclParts(d); return sclDate(p.y, p.m, p.d); };
export const addDays = (d: Date, n: number) => { const p = sclParts(d); return sclDate(p.y, p.m, p.d + n, p.h, p.min); };
export const startOfMonth = (d = new Date(), offset = 0) => { const p = sclParts(d); return sclDate(p.y, p.m + offset, 1); };
export const ymd = (d: Date) => { const p = sclParts(d); return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`; };
export const parseYmd = (s: string, h = 0, min = 0) => { const [y, m, d] = s.split("-").map(Number); return sclDate(y, m, d, h, min); };
export const toLocalInput = (d: Date) => { const p = sclParts(d); return `${ymd(d)}T${String(p.h).padStart(2, "0")}:${String(p.min).padStart(2, "0")}`; };
export const fromLocalInput = (s: string) => { const [a, b = "00:00"] = s.split("T"); const [h, mi] = b.split(":").map(Number); return parseYmd(a, h, mi); };
/** Hora actual de la solicitud (componentes de servidor: se renderizan una vez por request). */
export const nowMs = () => Date.now();
export const daysBetween = (a: Date, b = new Date()) => Math.max(0, Math.floor((b.getTime() - new Date(a).getTime()) / 864e5));
export function ago(d: Date | string) {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 3600) return `hace ${Math.max(1, Math.round(s / 60))} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  return `hace ${Math.round(s / 86400)} d`;
}

/** Patentes chilenas: autos AA1234 / BBBB12, motos AA123 / BBB12 (formato nuevo). */
export function normalizePlate(raw: string) {
  const p = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (/^[A-Z]{4}\d{2}$/.test(p) || /^[A-Z]{2}\d{4}$/.test(p)) return { plate: p, kind: "AUTO" as const };
  if (/^[A-Z]{3}\d{2}$/.test(p) || /^[A-Z]{2}\d{3}$/.test(p)) return { plate: p, kind: "MOTO" as const };
  return null;
}
export const fmtPlate = (p: string) => (p.length === 6 ? `${p.slice(0, 2)}·${p.slice(2, 4)}·${p.slice(4)}` : p);

export function validRut(rut: string) {
  const c = rut.replace(/[^0-9kK]/g, "").toUpperCase();
  if (c.length < 2) return false;
  const body = c.slice(0, -1), dv = c.slice(-1);
  let s = 0, m = 2;
  for (let i = body.length - 1; i >= 0; i--) { s += +body[i] * m; m = m === 7 ? 2 : m + 1; }
  const r = 11 - (s % 11);
  return dv === (r === 11 ? "0" : r === 10 ? "K" : String(r));
}
export const normPhone = (p?: string | null) => {
  if (!p) return null;
  const d = p.replace(/\D/g, "");
  if (d.length === 9) return `+56${d}`;
  if (d.length === 11 && d.startsWith("56")) return `+${d}`;
  return d ? `+${d}` : null;
};
