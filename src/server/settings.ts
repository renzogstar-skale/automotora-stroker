import { db } from "@/lib/db";

export type BranchWeb = { visible: boolean; address: string; phone: string; whatsapp: string; hours: string };
export type WebConfig = {
  logoText: string; logoImage: string; accent: string; secondary: string; heroTitle: string; heroSubtitle: string; heroImage: string; aboutText: string;
  phone: string; email: string; whatsapp: string; featuredIds: string[]; showBranches: boolean;
  address?: string; locationUrl?: string; tagline?: string; taglineTranslation?: string;
  /** Datos públicos por sucursal; al publicar se copian a la tabla Branch. */
  branches: Record<string, BranchWeb>;
};

export const DEFAULTS = {
  company: { name: "Automotora Stroker SpA", rut: "77.123.456-7", address: "Av. Jaime Guzmán 4050, Club Pádel Llacolén, Antofagasta, Chile", phone: "+56 9 7132 5262", email: "contacto@stroker.cl" },
  theme: { accent: "#c8102e" },
  notices: { noContactHours: 24, followUpGraceHours: 2, staleStockDays: 90, noPhotoDays: 3, reservationWarnHours: 24 },
  team: { inactivityHours: 24, overdueFollowUpsMax: 5, overdueTasksMax: 3, reportDueHour: 19, followUpAfterApptHours: 24 },
  rules: { reservationDays: 3, reservationMin: 200000, defaultGoal: 5, appointmentMinutes: 60, cancelReasonRequired: true },
  finance: { initialBalance: 25000000, initialBalanceDate: "2026-04-01" },
  web: {
    status: "PUBLICADO", domain: "autos.stroker.cl", domainStatus: "PENDIENTE_DNS", publishedAt: null as string | null,
    draft: null as WebConfig | null,
    published: {
      logoText: "Stroker", logoImage: "", accent: "#c8102e", secondary: "#1f2328", branches: {},
      heroTitle: "Special Cars for Special People",
      heroSubtitle: "Compra, venta y consignación de autos, camionetas y motocicletas en Antofagasta. Conoce nuestro catálogo, consulta por financiamiento a medida y coordina el despacho a cualquier región de Chile.",
      heroImage: "/demo/hero.jpg",
      aboutText: "En Automotora Stroker nos dedicamos a la compra, venta y consignación de autos, camionetas y motocicletas. Si estás buscando tu próximo vehículo o quieres vender el que ya tienes, contáctanos para conocer las opciones disponibles. Atendemos en Antofagasta y coordinamos despachos a todo Chile.",
      phone: "+56 9 7132 5262", email: "contacto@stroker.cl", whatsapp: "+56 9 7132 5262",
      address: "Av. Jaime Guzmán 4050, Club Pádel Llacolén, Antofagasta, Chile",
      locationUrl: "https://www.google.com/search?kgmid=%2Fg%2F11zd3t8786",
      tagline: "Special Cars for Special People",
      taglineTranslation: "Autos especiales para gente especial",
      featuredIds: [] as string[], showBranches: true,
    } as WebConfig,
  },
};
type Defaults = typeof DEFAULTS;

export async function getSetting<K extends keyof Defaults>(key: K): Promise<Defaults[K]> {
  const row = await db.setting.findUnique({ where: { key } });
  return { ...DEFAULTS[key], ...((row?.value as object) ?? {}) } as Defaults[K];
}
export async function setSetting<K extends keyof Defaults>(key: K, value: Partial<Defaults[K]>) {
  const cur = await getSetting(key);
  const next = JSON.parse(JSON.stringify({ ...cur, ...value }));
  await db.setting.upsert({ where: { key }, create: { key, value: next }, update: { value: next } });
}
