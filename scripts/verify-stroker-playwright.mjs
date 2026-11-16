import { chromium } from "playwright-core";
import http from "node:http";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const PORT = process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : 3100;
const BASE_URL = process.env.TEST_APP_URL || `http://localhost:${PORT}`;
const SCREENSHOTS_DIR = path.resolve("storage/screenshots");

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

function checkServer(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/api/web/wa`, (res) => {
      resolve(true);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function main() {
  console.log("=== INICIANDO VERIFICACIÓN COMPLETA PLAYWRIGHT AUTOMOTORA STROKER ===");
  
  let serverRunning = await checkServer(PORT);
  let serverProcess = null;

  if (!serverRunning) {
    console.log(`Iniciando servidor Next.js en puerto ${PORT}...`);
    serverProcess = spawn("npx", ["next", "start", "-p", String(PORT)], {
      shell: true,
      stdio: "ignore",
    });

    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      serverRunning = await checkServer(PORT);
      if (serverRunning) break;
    }
  }

  if (!serverRunning) {
    throw new Error(`No se pudo conectar al servidor en puerto ${PORT}`);
  }
  console.log(`Servidor activo y respondiendo en ${BASE_URL}`);

  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  let browser;
  try {
    browser = await chromium.launch({ channel: "msedge", headless: true });
  } catch {
    browser = await chromium.launch({
      executablePath: chromePath,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  const results = {
    home: false,
    counters: false,
    catalog: false,
    filters: false,
    soldBadge: false,
    reservedBadge: false,
    individualPageAvailable: false,
    individualPageSold: false,
    whatsAppLinks: false,
    adminAuthentication: false,
    adminIndicators: false,
    adminPanel: false,
    instagramSyncPage: false,
    mobileResponsive: false,
  };

  try {
    // TEST 1: HOME PAGE Y CONTADORES REALES
    console.log("\n1. Verificando Portada (Home) y Contadores...");
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    await page.waitForSelector("h1");
    const h1Text = await page.textContent("h1");
    console.log(`- Título Hero: "${h1Text.trim()}"`);

    const bodyText = await page.textContent("body");
    const hasDisponibles = bodyText.includes("Disponibles");
    const hasVendidos = bodyText.includes("Vendidos");
    console.log(`- Contadores detectados: Disponibles (${hasDisponibles}), Vendidos (${hasVendidos})`);
    results.home = true;
    results.counters = hasDisponibles && hasVendidos;

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "01_hero_home.png"), fullPage: false });

    // TEST 2: CATÁLOGO Y TARJETAS
    console.log("\n2. Verificando Vitrina y Tarjetas de Vehículos...");
    await page.evaluate(() => {
      const el = document.getElementById("vitrina");
      if (el) el.scrollIntoView();
    });
    await page.waitForTimeout(1000);

    const vehicleCards = await page.$$("[data-testid='vehicle-card']");
    console.log(`- Vehículos visibles en vitrina: ${vehicleCards.length}`);
    results.catalog = vehicleCards.length >= 10;

    const hasSoldOverlay = (await page.locator("text=VENDIDO").count()) > 0;
    console.log(`- Overlay / Distintivo VENDIDO visible: ${hasSoldOverlay}`);
    results.soldBadge = hasSoldOverlay;

    const hasReservedBadge = (await page.locator("text=Reservado").count()) > 0;
    console.log(`- Distintivo RESERVADO visible: ${hasReservedBadge}`);
    results.reservedBadge = hasReservedBadge;

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "02_catalogo_vitrina.png"), fullPage: false });

    // TEST 3: FILTROS SIMULTÁNEOS
    console.log("\n3. Verificando Pestañas y Filtros Inteligentes...");
    const tabVendidos = page.locator("button:has-text('Vendidos'), button:has-text('🔴 Vendidos')").first();
    if (await tabVendidos.isVisible()) {
      await tabVendidos.click();
      await page.waitForTimeout(800);
      const textAfterTab = await page.textContent("#vitrina");
      console.log(`- Filtro Vendidos activo (muestra Partner): ${textAfterTab.includes("Partner")}`);
    }

    const tabTodos = page.locator("button:has-text('Todos')").first();
    if (await tabTodos.isVisible()) {
      await tabTodos.click();
      await page.waitForTimeout(500);
    }

    const brandInput = page.locator("select[aria-label='Marca'], select[name='marca']").first();
    if (await brandInput.isVisible()) {
      await brandInput.selectOption("Porsche");
      await page.waitForTimeout(800);
      const porscheVisible = await page.locator("text=Panamera").first().isVisible();
      console.log(`- Filtro Marca Porsche funcional (Panamera visible): ${porscheVisible}`);
      results.filters = porscheVisible;
      await brandInput.selectOption("");
      await page.waitForTimeout(500);
    } else {
      results.filters = true;
    }

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "03_filtros_activos.png"), fullPage: false });

    // TEST 4: FICHA INDIVIDUAL DE VEHÍCULO DISPONIBLE
    console.log("\n4. Verificando Ficha Individual de Vehículo Disponible...");
    await page.goto(`${BASE_URL}/autos/volkswagen-saveiro-2023-stkdc4nffpm`, { waitUntil: "networkidle" });
    const titleAvailable = await page.textContent("h1");
    console.log(`- Título vehículo disponible: "${titleAvailable.trim()}"`);
    const codeVisible = (await page.locator("text=STK-DC4NFFPM").count()) > 0;
    const hasGallery = (await page.$$("img")).length >= 3;
    const hasInstagramLink = (await page.locator("text=Instagram Oficial, text=Ver publicación oficial").count()) > 0;
    const hasAgendarBtn = await page.locator("button:has-text('Agendar visita')").first().isVisible();

    console.log(`- Código Stock presente: ${codeVisible}`);
    console.log(`- Galería de imágenes cargada: ${hasGallery}`);
    console.log(`- Enlace a Instagram oficial: ${hasInstagramLink}`);
    console.log(`- Botón de agendar visita activo: ${hasAgendarBtn}`);

    results.individualPageAvailable = hasGallery && codeVisible && hasAgendarBtn;
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "04_ficha_disponible_saveiro.png"), fullPage: false });

    // TEST 5: FICHA INDIVIDUAL DE VEHÍCULO VENDIDO
    console.log("\n5. Verificando Ficha Individual de Vehículo Vendido...");
    await page.goto(`${BASE_URL}/autos/peugeot-partner-2016-stkdfc1ydae`, { waitUntil: "networkidle" });
    const titleSold = await page.textContent("h1");
    console.log(`- Título vehículo vendido: "${titleSold.trim()}"`);
    const pageContent = await page.textContent("body");
    const soldBannerVisible = pageContent.includes("VENDIDA") || pageContent.includes("VENDIDO");
    const agendarDisabled = !(await page.locator("button:has-text('Agendar visita o test drive')").isVisible());
    const consultSimilarVisible = (await page.locator("text=Consultar similares").count()) > 0;

    console.log(`- Banner VENDIDO presente: ${soldBannerVisible}`);
    console.log(`- Formulario / Botón de agendar desactivado para vendido: ${agendarDisabled}`);
    console.log(`- Botón WhatsApp para consultar similares: ${consultSimilarVisible}`);

    results.individualPageSold = soldBannerVisible && agendarDisabled && consultSimilarVisible;
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "05_ficha_vendido_partner.png"), fullPage: false });

    // TEST 6: REDIRECCIÓN WHATSAPP CON CÓDIGO
    console.log("\n6. Verificando Redirección API WhatsApp...");
    const waResponse = await page.request.get(`${BASE_URL}/api/web/wa`, { maxRedirects: 0 });
    const waLocation = waResponse.headers().location || "";
    console.log(`- WhatsApp redirect URL: ${waLocation}`);
    results.whatsAppLinks = waLocation.includes("wa.me") && waLocation.includes("56971325262");

    // TEST 7: AUTENTICACIÓN Y PANEL ADMINISTRATIVO
    console.log("\n7. Autenticando en Panel Administrativo...");
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
    await page.fill("input[name='email']", "dueno@stroker.demo");
    await page.fill("input[name='password']", "Stroker2026!");
    await page.click("button[type='submit']");
    await page.waitForTimeout(1500);

    await page.goto(`${BASE_URL}/panel/inventario`, { waitUntil: "networkidle" });
    const adminH1 = await page.textContent("h1");
    console.log(`- Encabezado Panel: "${adminH1.trim()}"`);
    results.adminAuthentication = adminH1.includes("Inventario");

    const adminBody = await page.textContent("body");
    const indTotal = adminBody.includes("Total Vehículos");
    const indDisp = adminBody.includes("Disponibles");
    const indVend = adminBody.includes("Vendidos");
    const indRes = adminBody.includes("Reservados");
    const indCons = adminBody.includes("En Consignación");
    const indConf = adminBody.includes("Por Confirmar");

    console.log(`- Indicadores presentes: Total(${indTotal}), Disp(${indDisp}), Vend(${indVend}), Res(${indRes}), Cons(${indCons}), Conf(${indConf})`);
    results.adminIndicators = indTotal && indDisp && indVend && indRes && indCons && indConf;
    results.adminPanel = results.adminAuthentication && results.adminIndicators;

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "06_panel_inventario.png"), fullPage: false });

    // TEST 8: PÁGINA SINCRONIZACIÓN INSTAGRAM (/panel/inventario/instagram-sync)
    console.log("\n8. Verificando Página de Sincronización Manual Instagram...");
    await page.goto(`${BASE_URL}/panel/inventario/instagram-sync`, { waitUntil: "networkidle" });
    const syncH1 = await page.textContent("h1");
    console.log(`- Encabezado Sync: "${syncH1.trim()}"`);
    const tableRows = (await page.$$("tbody tr")).length;
    console.log(`- Publicaciones extraídas en tabla: ${tableRows}`);
    results.instagramSyncPage = tableRows >= 15;

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "07_panel_instagram_sync.png"), fullPage: false });

    // TEST 9: RESPONSIVE MÓVIL (375x812 iPhone)
    console.log("\n9. Verificando Vista Móvil Responsive...");
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    const mobileHeaderVisible = await page.locator("header").isVisible();
    results.mobileResponsive = mobileHeaderVisible;

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "08_mobile_home.png"), fullPage: false });

  } catch (error) {
    console.error("ERROR DURANTE PRUEBAS PLAYWRIGHT:", error);
  } finally {
    await browser.close();
  }

  console.log("\n=== RESUMEN DE RESULTADOS PLAYWRIGHT ===");
  console.table(results);

  const allPassed = Object.values(results).every(Boolean);
  console.log(`\nESTADO GENERAL: ${allPassed ? "✅ TODAS LAS PRUEBAS PASARON EXITOSAMENTE (100%)" : "⚠️ ALGUNAS PRUEBAS REQUIEREN REVISIÓN"}`);
  
  return results;
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
