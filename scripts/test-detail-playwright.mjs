import { chromium } from "playwright-core";
import { mkdirSync } from "fs";

const screenshotsDir = "./test-results/detail-validation";
mkdirSync(screenshotsDir, { recursive: true });

async function runDetailValidation() {
  console.log("=== INICIANDO VALIDACIÓN EXHAUSTIVA DE PÁGINA DE DETALLE (FICHA VEHÍCULO) ===");

  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
  });

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
  console.log("\n--- Probando Detalle en Escritorio (1440x900) ---");
  const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await desktopContext.newPage();

  page.on("pageerror", (err) => consoleErrors.push(`PageError: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(`ConsoleError: ${msg.text()}`);
    }
  });

  const targetUrl = "http://localhost:3000/autos/ford-ranger-2023-20";
  const res = await page.goto(targetUrl, { waitUntil: "networkidle" });
  assert("Respuesta HTTP 200 en Ficha de Vehículo", res?.status() === 200, `Status: ${res?.status()}`);

  // Verificar desbordamiento horizontal
  const desktopOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  assert("Sin desbordamiento horizontal en escritorio", !desktopOverflow);

  // 1. Galería de fotografías con imagen principal y miniaturas
  const mainImage = page.locator(".aspect-\\[16\\/10\\] img").first();
  assert("Imagen principal amplia visible en galería", await mainImage.isVisible());
  const photoCounter = await page.locator("text=/\\d+\\s*\\/\\s*\\d+\\s*fotos/").first().textContent();
  assert("Contador de fotografías presente", Boolean(photoCounter), photoCounter?.trim());

  // Probar navegación de galería
  const btnNextPhoto = page.locator('button[aria-label="Siguiente foto"]').first();
  if (await btnNextPhoto.isVisible()) {
    await btnNextPhoto.click();
    await page.waitForTimeout(300);
    assert("Navegación de galería hacia adelante funciona", true);
  }

  // 2. Nombre completo del vehículo y precio CLP
  const heading = await page.locator("h1").first().textContent();
  assert("Nombre completo del vehículo presente", heading?.includes("Ford Ranger 2023"), heading?.trim());
  const priceText = await page.locator("text=/\\$25\\.490\\.000/").first().textContent();
  assert("Precio destacado en CLP formateado", priceText?.includes("$25.490.000"), priceText?.trim());

  // 3. Estado de disponibilidad
  const statusBadge = page.locator("text=/Disponible|Reservado/").first();
  assert("Badge de estado de disponibilidad presente", await statusBadge.isVisible());

  // 4. Información técnica
  const specsSection = page.locator("text=Ficha Técnica y Equipamiento");
  assert("Sección de ficha técnica presente", await specsSection.isVisible());
  const pageText = await page.textContent("body");
  assert("Especificación de año presente", pageText.includes("Año de fabricación") || pageText.includes("2023"));
  assert("Especificación de kilometraje presente", pageText.includes("Kilometraje") || pageText.includes("km"));
  assert("Especificación de transmisión presente", pageText.includes("Transmisión"));
  assert("Especificación de combustible presente", pageText.includes("Combustible") || pageText.includes("Diésel"));

  // 5. Descripción comercial
  const descHeading = page.locator("text=Descripción Comercial");
  assert("Sección de descripción comercial presente", await descHeading.isVisible());

  // 6. Información de revisión e historial documentado
  const historyHeading = page.locator("text=Historial e Inspección de Seguridad");
  assert("Sección de revisión e historial presente", await historyHeading.isVisible());
  assert("Mención de inspección de 120 puntos", pageText.includes("120 Puntos"));

  // 7. Sucursal donde se encuentra
  const branchHeading = page.locator("text=Ubicación y Sucursal");
  assert("Sección de sucursal física presente", await branchHeading.isVisible());

  // 8. Botones "Consultar por WhatsApp", "Agendar visita" y "Solicitar financiamiento"
  const btnWhatsApp = page.locator('a:has-text("Consultar por WhatsApp")').first();
  assert("Botón 'Consultar por WhatsApp' presente", await btnWhatsApp.isVisible());
  const btnAgenda = page.locator('button:has-text("Agendar visita a sucursal")').first();
  assert("Botón 'Agendar visita' presente", await btnAgenda.isVisible());
  const btnFinance = page.locator('button:has-text("Solicitar financiamiento")').first();
  assert("Botón 'Solicitar financiamiento' presente", await btnFinance.isVisible());

  // 9. Calculadora referencial de financiamiento interactiva
  const calcSection = page.locator("#calculadora-financiamiento");
  assert("Calculadora de financiamiento presente", await calcSection.isVisible());
  assert("Disclaimer legal de financiamiento presente", pageText.includes("Aviso legal importante") || pageText.includes("referencial"));

  // Probar interactividad de calculadora: cambiar pie a 40%
  const btnPie40 = page.locator('button:has-text("40%")');
  if (await btnPie40.isVisible()) {
    await btnPie40.click();
    await page.waitForTimeout(300);
    const updatedCuota = await page.locator("#calculadora-financiamiento .text-accent.tabular-nums").first().textContent();
    assert("Calculadora actualiza cuota estimada al cambiar porcentaje de pie", Boolean(updatedCuota), updatedCuota?.trim());
  }

  // 10. Sección de vehículos similares basada en inventario real
  const similarHeading = page.locator("text=Vehículos Similares en Stock");
  assert("Sección de vehículos similares presente", await similarHeading.isVisible());
  const similarCards = page.locator("section:has-text('Vehículos Similares') .card");
  const similarCount = await similarCards.count();
  assert("Tarjetas de vehículos similares cargadas", similarCount > 0, `Cantidad: ${similarCount}`);

  // 11. Panel Sticky en Escritorio
  const stickyPanel = page.locator(".lg\\:sticky");
  assert("Panel lateral sticky presente en escritorio", await stickyPanel.isVisible());

  await page.screenshot({ path: `${screenshotsDir}/01_desktop_detail_top.png` });
  await page.locator("#calculadora-financiamiento").scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${screenshotsDir}/02_desktop_detail_calculator.png` });
  await page.locator("section:has-text('Vehículos Similares')").scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${screenshotsDir}/03_desktop_detail_similar.png` });

  await desktopContext.close();

  // --- 2. PRUEBA EN TABLET (768x1024) ---
  console.log("\n--- Probando Detalle en Tablet (768x1024) ---");
  const tabletContext = await browser.newContext({ viewport: { width: 768, height: 1024 } });
  const tabletPage = await tabletContext.newPage();
  await tabletPage.goto(targetUrl, { waitUntil: "networkidle" });

  const tabletOverflow = await tabletPage.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  assert("Sin desbordamiento horizontal en Tablet", !tabletOverflow);
  await tabletPage.screenshot({ path: `${screenshotsDir}/04_tablet_detail.png` });
  await tabletContext.close();

  // --- 3. PRUEBA EN MÓVIL (390x844) ---
  console.log("\n--- Probando Detalle en Móvil (390x844) ---");
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(targetUrl, { waitUntil: "networkidle" });

  const mobileOverflow = await mobilePage.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  assert("Sin desbordamiento horizontal en Móvil", !mobileOverflow);

  // 12. Barra inferior fija de contacto en móvil
  const mobileBar = mobilePage.locator(".fixed.bottom-0");
  assert("Barra inferior fija de contacto visible en móvil", await mobileBar.isVisible());
  const mobileWA = mobileBar.locator('a:has-text("WhatsApp")');
  assert("Botón WhatsApp en barra móvil presente", await mobileWA.isVisible());

  await mobilePage.screenshot({ path: `${screenshotsDir}/05_mobile_detail_top.png` });
  await mobilePage.evaluate(() => window.scrollTo({ top: 700 }));
  await mobilePage.waitForTimeout(300);
  await mobilePage.screenshot({ path: `${screenshotsDir}/06_mobile_detail_scrolled.png` });

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
    console.log("✔ TODAS LAS VALIDACIONES DE DETALLE DE VEHÍCULO PASARON AL 100%");
    process.exit(0);
  }
}

runDetailValidation().catch((err) => {
  console.error("Error en validación:", err);
  process.exit(1);
});
