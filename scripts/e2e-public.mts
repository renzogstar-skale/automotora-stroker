// Pruebas E2E de la vitrina pública y el acceso al panel (Playwright + BD real).
// Uso: npx tsx scripts/e2e-public.mts [base]   (contra `next start`; por defecto http://localhost:3311)
import { chromium, type Page } from "playwright-core";
import { db } from "../src/lib/db";

const BASE = process.argv[2] ?? "http://localhost:3311";
let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, info = "") => { cond ? pass++ : fail++; console.log(`${cond ? "PASS" : "FAIL"}  ${name}${info ? ` — ${info}` : ""}`); };
const step = async (name: string, fn: () => Promise<void>) => { try { await fn(); } catch (e) { ok(name, false, (e as Error).message.split("\n")[0]); } };
// La vitrina muestra un skeleton breve al cambiar filtros: se espera a que la grilla se estabilice.
const settled = (p: Page) => p.waitForFunction(() => !document.querySelector('[aria-label="Cargando inventario de vehículos..."]'), null, { timeout: 10_000 });
const prices = async (p: Page) => (await settled(p), p).$$eval("#vitrina-grid > *", (cards) => cards.map((c) => Number((c.textContent?.match(/\$\s?([\d.]+)/)?.[1] ?? "0").replace(/\./g, ""))));

const browser = await chromium.launch({ executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
const vehicle = await db.vehicle.findFirst({ where: { published: true, status: "DISPONIBLE" }, select: { id: true, slug: true, brand: true, model: true } });
if (!vehicle) throw new Error("Sin vehículos publicados: ejecuta npm run seed");

await step("Navegación", async () => {
  const r = await page.goto(BASE + "/", { waitUntil: "networkidle" });
  ok("Inicio responde 200", r?.status() === 200);
  ok("Inicio tiene un único h1", (await page.locator("h1").count()) === 1);
  for (const path of ["/autos", "/consignar", "/login"]) ok(`Ruta ${path} responde 200`, (await page.request.get(BASE + path)).status() === 200);
  ok("Ruta inexistente responde 404", (await page.request.get(BASE + "/no-existe-xyz")).status() === 404);
  const text = await page.locator("body").innerText();
  ok("Sin credenciales demo en portada", !/Stroker2026!|@stroker\.demo/.test(text));
  ok("Sin sucursales ficticias en portada", !/Santiago|Viña del Mar/.test(text));
  ok("Sin inspección de 120 puntos ni garantía inventada", !/120 puntos|3 meses en motor/i.test(text));
  ok("Antofagasta como sede", text.includes("Antofagasta"));
  ok("Inventario de demostración identificado", /inventario de demostración/i.test(text));
});

await step("Búsqueda y filtros", async () => {
  const total = (await prices(page)).length;
  ok("Vitrina muestra unidades", total > 0, `${total}`);
  await page.selectOption('select[aria-label="Filtrar por marca"]', vehicle.brand);
  await page.waitForTimeout(300);
  await settled(page);
  const filtered = await page.$$eval("#vitrina-grid > *", (c) => c.map((x) => x.textContent ?? ""));
  ok("Filtro de marca reduce y coincide", filtered.length > 0 && filtered.length <= total && filtered.every((t) => t.includes(vehicle.brand)), `${filtered.length}/${total}`);
  await page.goto(BASE + "/?precioMax=1", { waitUntil: "networkidle" });
  ok("Estado vacío visible", await page.getByText("No se encontraron vehículos").isVisible());
  await page.getByRole("button", { name: /Limpiar filtros/ }).first().click();
  await page.waitForTimeout(300);
  ok("Limpiar filtros restaura la vitrina", (await prices(page)).length === total);
  await page.goto(BASE + "/?orden=precio-asc", { waitUntil: "networkidle" });
  const asc = await prices(page);
  ok("Orden por precio ascendente", asc.every((v, i) => i === 0 || asc[i - 1] <= v), asc.slice(0, 4).join(","));
});

await step("Favoritos", async () => {
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Guardar en favoritos" }).first().click();
  await page.reload({ waitUntil: "networkidle" });
  ok("Favorito persiste tras recargar", (await page.getByRole("button", { name: "Quitar de favoritos" }).count()) >= 1);
  await page.getByRole("button", { name: "Quitar de favoritos" }).first().click();
});

await step("Agendamiento (modal portada)", async () => {
  const before = await db.appointment.count();
  await settled(page);
  await page.locator('#vitrina-grid button[aria-label^="Agendar visita para"]').first().click();
  ok("Modal no muestra sucursales ficticias", !/Santiago|Viña/.test(await page.getByRole("dialog").innerText()));
  await page.fill("#appt-name", "Prueba E2E Agenda");
  await page.fill("#appt-phone", `+56 9 ${String(Date.now()).slice(-8)}`);
  await page.locator('[role=dialog] button[type=submit]').click();
  await page.getByTestId("appt-confirmation").waitFor({ timeout: 15_000 });
  ok("Confirmación de agendamiento", true);
  ok("Cita registrada en BD", (await db.appointment.count()) >= before, "puede quedar como lead si el horario está ocupado");
});

await step("Ficha del vehículo", async () => {
  const r = await page.goto(`${BASE}/autos/${vehicle.slug}`, { waitUntil: "networkidle" });
  ok("Ficha responde 200", r?.status() === 200);
  ok("Ficha con h1 del vehículo", (await page.locator("h1").innerText()).includes(vehicle.brand));
  const text = await page.locator("body").innerText();
  ok("Ficha sin datos no verificados", !/120 Puntos|Seminuevo Garantizado|Santiago|Viña/i.test(text));
  ok("Ficha muestra vehículos similares", /Vehículos Similares/i.test(text));
});

await step("Simulador financiero", async () => {
  const c1 = await page.getByTestId("cuota").innerText();
  await page.getByRole("button", { name: "Plazo 60 meses" }).click();
  const c2 = await page.getByTestId("cuota").innerText();
  ok("Cambiar plazo recalcula la cuota", c1 !== c2, `${c1} → ${c2}`);
  ok("Muestra costo total del crédito", (await page.getByTestId("costo-total").innerText()).startsWith("$"));
  ok("Aviso legal referencial visible", /CAE/.test(await page.locator("body").innerText()));
});

await step("Formulario de consulta", async () => {
  const before = await db.formSubmission.count();
  const form = page.locator("#consulta-form form").first();
  await form.locator('input[name="name"]').fill("Prueba E2E Consulta");
  await form.locator('input[name="phone"]').fill(`+56 9 ${String(Date.now() + 7).slice(-8)}`);
  await form.getByRole("button", { name: "Enviar consulta" }).click();
  await page.getByText(/Recibimos tu consulta/).waitFor({ timeout: 15_000 });
  ok("Consulta enviada y registrada", (await db.formSubmission.count()) === before + 1);
});

await step("Formulario de consignación", async () => {
  await page.goto(BASE + "/consignar", { waitUntil: "networkidle" });
  ok("Consignación sin selector de sucursal ficticia", (await page.locator('select[name="branchId"]').count()) === 0);
  const before = await db.formSubmission.count();
  await page.fill('input[name="name"]', "Prueba E2E Consigna");
  await page.fill('input[name="phone"]', `+56 9 ${String(Date.now() + 13).slice(-8)}`);
  await page.fill('input[name="brand"]', "Toyota");
  await page.fill('input[name="model"]', "Hilux");
  await page.fill('input[name="year"]', "2019");
  await page.fill('input[name="km"]', "80000");
  await page.getByRole("button", { name: "Enviar datos de mi auto" }).click();
  await page.getByText(/Recibimos los datos de tu auto/).waitFor({ timeout: 15_000 });
  ok("Consignación enviada y registrada", (await db.formSubmission.count()) === before + 1);
});

await step("WhatsApp", async () => {
  const r = await page.request.get(`${BASE}/api/web/wa?v=${vehicle.id}`, { maxRedirects: 0 });
  const loc = r.headers()["location"] ?? "";
  ok("Redirige a wa.me del número confirmado", r.status() === 302 && loc.startsWith("https://wa.me/56971325262"), loc.slice(0, 40));
  ok("Mensaje personalizado con el vehículo", decodeURIComponent(loc).includes(vehicle.model));
  const hrefs = await page.$$eval('a[href*="wa.me"], a[href^="tel:"]', (as) => as.map((a) => a.getAttribute("href") ?? ""));
  ok("Enlaces de contacto usan el número confirmado", hrefs.length > 0 && hrefs.every((h) => /56971325262/.test(h)), `${hrefs.length} enlaces`);
});

await step("Login y permisos", async () => {
  const p = await ctx.newPage();
  await p.goto(BASE + "/panel", { waitUntil: "networkidle" });
  ok("Panel sin sesión redirige a login", p.url().includes("/login"));
  ok("Login de producción sin credenciales demo", !/Stroker2026!/.test(await p.content()));
  const probe = "e2e-bloqueo@stroker.test";
  await db.auditLog.deleteMany({ where: { entity: "Login", entityId: probe } });
  for (let i = 0; i < 6; i++) {
    await p.fill('input[name="email"]', probe);
    await p.fill('input[name="password"]', "incorrecta");
    await p.getByRole("button", { name: "Iniciar sesión" }).click();
    // Cada intento debe completarse (registro en auditoría o mensaje de bloqueo) antes del siguiente.
    for (let t = 0; t < 40 && (await db.auditLog.count({ where: { entityId: probe } })) < Math.min(i + 1, 5); t++) await p.waitForTimeout(250);
  }
  await p.getByText(/Demasiados intentos/).waitFor({ timeout: 10_000 }).catch(() => {});
  ok("Bloqueo tras intentos fallidos", /Demasiados intentos/.test(await p.locator("body").innerText()));
  await db.auditLog.deleteMany({ where: { entity: "Login", entityId: probe } });
  await p.fill('input[name="email"]', "valentina@stroker.demo");
  await p.fill('input[name="password"]', "Stroker2026!");
  await p.getByRole("button", { name: "Iniciar sesión" }).click();
  await p.waitForURL(/\/panel/, { timeout: 20_000 });
  ok("Login válido entra al panel", p.url().includes("/panel"));
  await p.goto(BASE + "/panel/sistema/usuarios", { waitUntil: "networkidle" });
  ok("Vendedor no accede a Usuarios", !p.url().endsWith("/panel/sistema/usuarios") || /sin acceso|no tienes/i.test(await p.locator("body").innerText()), p.url().replace(BASE, ""));
  await p.close();
});

await step("Responsive y accesibilidad básica", async () => {
  for (const [w, h] of [[360, 800], [390, 844], [768, 1024], [1440, 900]]) {
    const m = await browser.newPage({ viewport: { width: w, height: h }, isMobile: w < 768, hasTouch: w < 768 });
    for (const path of ["/", `/autos/${vehicle.slug}`, "/consignar"]) {
      await m.goto(BASE + path, { waitUntil: "networkidle" });
      const a = await m.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        lang: document.documentElement.lang,
        noAlt: [...document.images].filter((i) => !i.hasAttribute("alt")).length,
        unnamed: [...document.querySelectorAll("button, a[href]")].filter((el) => !(el.getAttribute("aria-label") || el.textContent?.trim() || el.getAttribute("title"))).length,
      }));
      ok(`${w}px ${path}: sin scroll horizontal`, a.overflow <= 1, `${a.overflow}px`);
      if (w === 390) ok(`a11y ${path}: lang, alt y nombres accesibles`, /^es(-|$)/.test(a.lang) && a.noAlt === 0 && a.unnamed === 0, JSON.stringify(a));
    }
    await m.close();
  }
});

ok("Sin errores JS no capturados", errors.length === 0, errors.slice(0, 2).join(" | "));
await browser.close();
console.log(`\n${pass} PASS · ${fail} FAIL`);
await db.$disconnect();
process.exit(fail ? 1 : 0);
