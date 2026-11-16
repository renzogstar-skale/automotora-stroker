import { chromium } from "playwright-core";
import { mkdirSync } from "fs";

const screenshotsDir = "./test-results/catalog-validation";
mkdirSync(screenshotsDir, { recursive: true });

async function runComprehensiveValidation() {
  console.log("=== INICIANDO VALIDACIÓN EXHAUSTIVA DE VITRINA Y TARJETAS PREMIUM ===");

  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const baseUrl = process.env.APP_URL || "http://localhost:3100";
  console.log(`URL base de pruebas: ${baseUrl}`);

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

  const consoleErrors = [];
  let testsPassed = 0;
  let testsFailed = 0;

  function assert(name, condition, details = "") {
    if (condition) {
      console.log(`[PASS] ${name}${details ? ` -> ${details}` : ""}`);
      testsPassed++;
    } else {
      console.error(`[FAIL] ${name}${details ? ` -> ${details}` : ""}`);
      testsFailed++;
    }
  }

  // --- 1. PRUEBA EN ESCRITORIO (1440x900) ---
  console.log("\n--- Probando Escritorio (1440x900) ---");
  const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await desktopContext.newPage();

  page.on("pageerror", (err) => consoleErrors.push(`PageError: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(`ConsoleError: ${msg.text()}`);
    }
  });

  const res = await page.goto(baseUrl, { waitUntil: "networkidle" });
  assert("Respuesta HTTP 200 en Home", res?.status() === 200);

  // Scroll directo a la vitrina
  await page.locator("#vitrina").scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);

  // 1.1 Verificar Cuadrícula en Escritorio: 3 columnas (lg:grid-cols-3)
  const gridClasses = await page.locator("#vitrina-grid").getAttribute("class");
  assert(
    "Cuadrícula configurada con 3 columnas en escritorio (lg:grid-cols-3)",
    gridClasses?.includes("lg:grid-cols-3")
  );

  // 1.2 Verificar Elementos Obligatorios en CADA Tarjeta
  const cards = page.locator("#vitrina-grid .group.relative.rounded-2xl");
  const cardCount = await cards.count();
  assert("Tarjetas de vehículos renderizadas", cardCount > 0, `Cantidad: ${cardCount}`);

  const firstCard = cards.first();

  // Imagen amplia con proporción uniforme (aspect-[16/10])
  const imgContainer = firstCard.locator(".aspect-\\[16\\/10\\]");
  assert("Tarjeta posee contenedor de imagen con proporción uniforme 16:10", (await imgContainer.count()) > 0);
  const imgElement = imgContainer.locator("img");
  assert("Imagen visible dentro del contenedor", (await imgElement.count()) > 0);

  // Estado: Disponible, Reservado o Vendido
  const statusBadge = firstCard.locator("text=/Disponible|Reservado|Vendido/");
  assert("Badge de estado (Disponible, Reservado o Vendido) presente", (await statusBadge.count()) > 0);

  // Marca, modelo, versión y año
  const titleText = await firstCard.locator("h3").textContent();
  assert("Marca y modelo presentes en el título", Boolean(titleText?.trim()), titleText?.trim());
  const versionText = await firstCard.locator("p.text-xs.text-muted").first().textContent();
  assert("Versión y año presentes en subtítulo", Boolean(versionText?.includes("·")), versionText?.trim());

  // Precio destacado en pesos chilenos
  const priceText = await firstCard.locator("span.text-2xl.font-black").textContent();
  assert("Precio en CLP con símbolo $ y puntos", priceText?.startsWith("$"), priceText?.trim());

  // Kilometraje
  const kmText = await firstCard.locator("text=/km/i").first().textContent();
  assert("Kilometraje especificado con unidad km", Boolean(kmText), kmText?.trim());

  // Transmisión
  const transText = await firstCard.locator("text=/Automática|Manual/i").first().textContent();
  assert("Transmisión identificada (Automática o Manual)", Boolean(transText), transText?.trim());

  // Combustible
  const fuelText = await firstCard.locator("text=/Bencina|Diésel/i").first().textContent();
  assert("Tipo de combustible identificado (Bencina o Diésel)", Boolean(fuelText), fuelText?.trim());

  // Sucursal
  const branchText = await firstCard.locator("text=/Stroker/i").first().textContent();
  assert("Sucursal física indicada", Boolean(branchText), branchText?.trim());

  // Botón "Ver detalles"
  const btnDetalles = firstCard.locator('a:has-text("Ver detalles")');
  assert("Botón 'Ver detalles' presente con enlace", (await btnDetalles.count()) > 0);
  const hrefDetalles = await btnDetalles.getAttribute("href");
  assert("Enlace de detalles apunta a ficha de vehículo", hrefDetalles?.startsWith("/autos/") || hrefDetalles?.startsWith("/panel/inventario/"));

  // Botón para consultar por WhatsApp
  const btnWhatsApp = firstCard.locator('a:has-text("WhatsApp")');
  assert("Botón 'WhatsApp' presente", (await btnWhatsApp.count()) > 0);
  const hrefWA = await btnWhatsApp.getAttribute("href");
  assert("Enlace de WhatsApp apunta a endpoint de redirección", hrefWA?.includes("/api/web/wa"));

  // Icono de favoritos interactivo
  const btnHeart = firstCard.locator('button[aria-label*="favoritos"]');
  assert("Botón de favoritos presente en la tarjeta", (await btnHeart.count()) > 0);
  // Probar clic en favorito
  await btnHeart.click();
  await page.waitForTimeout(300);
  const isFilled = await btnHeart.locator("svg.fill-white").count();
  assert("Icono de favoritos se activa y rellena al hacer clic", isFilled > 0);

  // Captura del estado inicial del catálogo
  await page.screenshot({ path: `${screenshotsDir}/01_desktop_catalog_initial.png` });

  // --- 2. PROBAR FILTROS COMPLETOS ---
  console.log("\n--- Probando Filtros Completos ---");

  // Filtro por Transmisión: 'Automática'
  const selTransmision = page.locator('#vitrina select[aria-label="Filtrar por transmisión"]');
  assert("Filtro por Transmisión disponible", (await selTransmision.count()) > 0);
  await selTransmision.selectOption("Automática");
  await page.waitForTimeout(400);

  const transCount = await cards.count();
  assert("Filtro por transmisión devuelve resultados", transCount > 0, `Unidades automáticas: ${transCount}`);

  // Filtro por Kilometraje: 'Hasta 50.000 km'
  const selKm = page.locator('#vitrina select[aria-label="Filtrar por kilometraje"]');
  assert("Filtro por Kilometraje disponible", (await selKm.count()) > 0);
  await selKm.selectOption("50000");
  await page.waitForTimeout(400);

  const kmFilteredCount = await cards.count();
  assert("Filtro por kilometraje aplicado", kmFilteredCount > 0, `Unidades <= 50.000 km: ${kmFilteredCount}`);

  // Filtro por Sucursal: 'Stroker Santiago'
  const selSucursal = page.locator('#vitrina select[aria-label="Filtrar por sucursal"]');
  assert("Filtro por Sucursal disponible", (await selSucursal.count()) > 0);
  await selSucursal.selectOption({ index: 1 }); // Primer sucursal
  await page.waitForTimeout(400);

  await page.screenshot({ path: `${screenshotsDir}/02_desktop_filters_applied.png` });

  // --- 3. PROBAR ORDENAMIENTO ---
  console.log("\n--- Probando Ordenamiento ---");
  const selOrden = page.locator('#vitrina select[aria-label="Ordenar vehículos"]');
  assert("Selector de ordenamiento disponible", (await selOrden.count()) > 0);

  // Ordenar por 'Menor precio'
  await selOrden.selectOption("precio-asc");
  await page.waitForTimeout(400);

  // Validar orden de precios
  const priceElements = page.locator("#vitrina span.text-2xl.font-black");
  const pricesExtracted = [];
  const pCount = await priceElements.count();
  for (let i = 0; i < pCount; i++) {
    const raw = await priceElements.nth(i).textContent();
    const clean = parseInt(raw?.replace(/\D/g, "") || "0", 10);
    pricesExtracted.push(clean);
  }

  let isAscending = true;
  for (let i = 0; i < pricesExtracted.length - 1; i++) {
    if (pricesExtracted[i] > pricesExtracted[i + 1]) {
      isAscending = false;
      break;
    }
  }
  assert("Ordenamiento por 'Menor precio' ordena correctamente de menor a mayor", isAscending, `Precios: ${pricesExtracted.join(", ")}`);

  // Ordenar por 'Año: más nuevo'
  await selOrden.selectOption("anio-desc");
  await page.waitForTimeout(400);

  await page.screenshot({ path: `${screenshotsDir}/03_desktop_sorted.png` });

  // --- 4. PROBAR ESTADO VACÍO (EMPTY STATE) ---
  console.log("\n--- Probando Estado Vacío ---");
  // Aplicar combinación imposible (ej. Precio máximo muy bajo con año muy alto)
  const selPrecio = page.locator('#vitrina select[aria-label="Filtrar por precio máximo"]');
  await selPrecio.selectOption("8000000"); // Hasta 8 millones
  const selAnio = page.locator('#vitrina select[aria-label="Filtrar por año"]');
  await selAnio.selectOption("2024"); // 2024
  await page.waitForTimeout(400);

  const emptyStateVisible = await page.locator("text=No se encontraron vehículos").isVisible();
  assert("Estado vacío refinado se muestra cuando no hay coincidencias", emptyStateVisible);
  await page.screenshot({ path: `${screenshotsDir}/04_desktop_empty_state.png` });

  // Botón restablecer desde el estado vacío
  const btnRestablecer = page.locator('button:has-text("Restablecer todos los filtros")');
  assert("Botón para restablecer filtros visible en estado vacío", (await btnRestablecer.count()) > 0);
  await btnRestablecer.click();
  await page.waitForTimeout(400);

  const allRestoredCount = await cards.count();
  assert("Inventario completo restaurado con éxito", allRestoredCount >= 15, `Restauradas: ${allRestoredCount}`);

  await desktopContext.close();

  // --- 5. RESPONSIVE: TABLET (768x1024) ---
  console.log("\n--- Probando Tablet (768x1024) ---");
  const tabletContext = await browser.newContext({ viewport: { width: 768, height: 1024 } });
  const tabletPage = await tabletContext.newPage();
  await tabletPage.goto(baseUrl, { waitUntil: "networkidle" });
  await tabletPage.locator("#vitrina").scrollIntoViewIfNeeded();
  await tabletPage.waitForTimeout(400);

  const tabletOverflow = await tabletPage.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  assert("Sin desbordamiento horizontal en Tablet", !tabletOverflow);

  await tabletPage.screenshot({ path: `${screenshotsDir}/05_tablet_grid.png` });
  await tabletContext.close();

  // --- 6. RESPONSIVE: MÓVIL (390x844) ---
  console.log("\n--- Probando Móvil (390x844) ---");
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(baseUrl, { waitUntil: "networkidle" });
  await mobilePage.locator("#vitrina").scrollIntoViewIfNeeded();
  await mobilePage.waitForTimeout(400);

  const mobileOverflow = await mobilePage.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  assert("Sin desbordamiento horizontal en Móvil", !mobileOverflow);

  // Probar botón de favoritos en móvil
  const mobileHeart = mobilePage.locator('#vitrina button[aria-label*="favoritos"]').first();
  await mobileHeart.click();
  await mobilePage.waitForTimeout(300);

  // Probar botón WhatsApp en móvil
  const mobileWA = mobilePage.locator('#vitrina a:has-text("WhatsApp")').first();
  assert("Botón WhatsApp visible y táctil en móvil", await mobileWA.isVisible());

  // Probar botón Ver detalles en móvil
  const mobileDetalles = mobilePage.locator('#vitrina a:has-text("Ver detalles")').first();
  assert("Botón Ver detalles visible y táctil en móvil", await mobileDetalles.isVisible());

  await mobilePage.screenshot({ path: `${screenshotsDir}/06_mobile_cards.png` });
  await mobileContext.close();

  await browser.close();

  console.log("\n==========================================");
  console.log(`TOTAL DE PRUEBAS PASADAS: ${testsPassed}`);
  console.log(`TOTAL DE PRUEBAS FALLADAS: ${testsFailed}`);
  console.log(`ERRORES EN CONSOLA DEL NAVEGADOR: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    console.log("Errores:", consoleErrors);
  }
  console.log("==========================================");

  if (testsFailed > 0 || consoleErrors.length > 0) {
    process.exit(1);
  } else {
    console.log("✔ TODAS LAS PRUEBAS DE LA VITRINA PASARON AL 100%");
    process.exit(0);
  }
}

runComprehensiveValidation().catch((err) => {
  console.error("Error en validación:", err);
  process.exit(1);
});
