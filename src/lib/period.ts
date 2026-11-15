import { monthLabel, parseYmd, sclParts, startOfMonth, ymd, addDays } from "./format";

export type Period = { key: string; from: Date; to: Date; label: string; months: Date[]; prev: { from: Date; to: Date } };
type SP = Record<string, string | string[] | undefined>;
export const sp = (s: SP, k: string) => (Array.isArray(s[k]) ? (s[k] as string[])[0] : (s[k] as string | undefined)) || undefined;

/** Filtro de período común a todo el proyecto (fin exclusivo). Por defecto: mes actual o 6 meses según la vista. */
export function parsePeriod(s: SP, def = "month"): Period {
  const key = sp(s, "period") ?? def;
  const now = new Date();
  const ref = sp(s, "ref"); // AAAA-MM
  const base = ref ? parseYmd(`${ref}-01`) : now;
  let from: Date, to: Date, label: string;
  const p = sclParts(base);
  if (key === "6m") { from = startOfMonth(now, -5); to = startOfMonth(now, 1); label = "Últimos 6 meses"; }
  else if (key === "quarter") { const q = Math.floor((p.m - 1) / 3); from = parseYmd(`${p.y}-${String(q * 3 + 1).padStart(2, "0")}-01`); to = startOfMonth(from, 3); label = `T${q + 1} ${p.y}`; }
  else if (key === "year") { from = parseYmd(`${p.y}-01-01`); to = parseYmd(`${p.y + 1}-01-01`); label = `Año ${p.y}`; }
  else if (key === "custom" && sp(s, "from") && sp(s, "to")) { from = parseYmd(sp(s, "from")!); to = addDays(parseYmd(sp(s, "to")!), 1); label = `${sp(s, "from")} a ${sp(s, "to")}`; }
  else { from = startOfMonth(base); to = startOfMonth(base, 1); label = new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric", timeZone: "America/Santiago" }).format(addDays(from, 1)); }
  const months: Date[] = [];
  for (let m = startOfMonth(from); m < to; m = startOfMonth(m, 1)) months.push(m);
  const span = to.getTime() - from.getTime();
  return { key, from, to, label, months, prev: { from: new Date(from.getTime() - span), to: from } };
}
export const monthKey = (d: Date) => ymd(d).slice(0, 7);
export const monthName = (d: Date) => monthLabel(addDays(d, 1));
/** Conserva filtros activos al navegar a otra vista o detalle. */
export function qs(s: SP, extra: Record<string, string | undefined> = {}, keep = ["period", "ref", "from", "to", "branch"]) {
  const u = new URLSearchParams();
  for (const k of keep) { const v = sp(s, k); if (v) u.set(k, v); }
  for (const [k, v] of Object.entries(extra)) { if (v) u.set(k, v); else u.delete(k); }
  const str = u.toString();
  return str ? `?${str}` : "";
}
