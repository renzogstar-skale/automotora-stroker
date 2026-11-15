import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { getSetting } from "@/server/settings";

export const metadata: Metadata = {
  title: { default: "Automotora Stroker · Special Cars for Special People", template: "%s · Stroker" },
  description: "Special Cars for Special People. Compra, venta y consignación de autos, camionetas y motocicletas en Antofagasta. Despachos a todo Chile.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = (await cookies()).get("theme")?.value;
  const { accent } = await getSetting("theme");
  const safe = /^#[0-9a-fA-F]{6}$/.test(accent) ? accent : "#c8102e";
  return (
    <html lang="es-CL" className={theme === "dark" ? "dark" : undefined} suppressHydrationWarning>
      <head><style>{`:root{--accent:${safe}}`}</style></head>
      <body>{children}</body>
    </html>
  );
}
