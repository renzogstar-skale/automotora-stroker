import { normalizePlate } from "@/lib/format";

/** Proveedor de tasación de demostración: sin credenciales, todos los resultados se marcan como demo. */
const DEMO_CATALOG = [
  ["Toyota", "RAV4", "2.0 XLE", 2020], ["Hyundai", "Tucson", "2.0 GL", 2019], ["Kia", "Sportage", "2.0 EX", 2021],
  ["Chevrolet", "Sail", "1.5 LT", 2018], ["Suzuki", "Swift", "1.2 GLX", 2022], ["Nissan", "Navara", "2.3 LE 4x4", 2020],
  ["Mazda", "CX-5", "2.5 R", 2019], ["Peugeot", "2008", "1.2 Allure", 2021], ["Honda", "CB 190R", "Std", 2022],
] as const;
const BASE_NEW: Record<string, number> = {
  Toyota: 27e6, Hyundai: 22e6, Kia: 22e6, Chevrolet: 12e6, Suzuki: 12.5e6, Nissan: 28e6, Mazda: 25e6, Peugeot: 18e6, Honda: 3.2e6,
};

export function demoLookup(raw: string) {
  const n = normalizePlate(raw);
  if (!n) return null;
  const h = [...n.plate].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const pool = DEMO_CATALOG.filter((x) => (n.kind === "MOTO") === (x[0] === "Honda"));
  const [brand, model, version, year] = pool[h % pool.length];
  return { ...n, brand, model, version, year, km: 15000 + (h % 9) * 9000, source: "Registro demo (sin proveedor conectado)", isDemo: true };
}

const COND: Record<string, number> = { EXCELENTE: 1.04, BUENO: 1, REGULAR: 0.88 };
export function valuate(i: { brand: string; year: number; km: number; condition: string }) {
  const age = Math.max(0, new Date().getFullYear() - i.year);
  const base = BASE_NEW[i.brand] ?? 16e6;
  const kmAdj = 1 - Math.min(0.25, Math.max(0, i.km - age * 15000) / 400000);
  const v = base * Math.pow(0.88, age) * kmAdj * (COND[i.condition] ?? 1);
  const r = (x: number) => Math.round(x / 50000) * 50000;
  return { min: r(v * 0.94), max: r(v * 1.06), suggested: r(v), source: "Modelo referencial Stroker (demo)", sourceDate: new Date() };
}
