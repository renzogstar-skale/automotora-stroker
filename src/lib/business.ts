/**
 * Datos comerciales confirmados de la vitrina pública (única fuente). Antofagasta es la única sede confirmada:
 * las sucursales de la base de datos se usan para la gestión interna y no se presentan como locales al público.
 */
export const BUSINESS = {
  name: "Automotora Stroker",
  showroom: "Showroom Antofagasta",
  city: "Antofagasta",
  address: "Av. Jaime Guzmán 4050, Club Pádel Llacolén, Antofagasta",
  phone: "+56 9 7132 5262",
  tel: "tel:+56971325262",
  whatsapp: "56971325262",
  mapsUrl: "https://www.google.com/search?kgmid=%2Fg%2F11zd3t8786",
  hours: "Lun–Vie 09:30–19:00 · Sáb 10:00–14:00",
} as const;

export const waUrl = (text?: string) => `https://wa.me/${BUSINESS.whatsapp}${text ? `?text=${encodeURIComponent(text)}` : ""}`;

/** Inventario cargado desde la semilla de demostración. Poner NEXT_PUBLIC_DEMO_INVENTORY=0 al publicar unidades reales. */
export const DEMO_INVENTORY = process.env.NEXT_PUBLIC_DEMO_INVENTORY !== "0";
