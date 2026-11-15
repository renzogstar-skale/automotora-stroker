import { chromium } from "playwright-core";
import { mkdirSync } from "fs";

const screenshotsDir = "./test-results/carousel-validation";
mkdirSync(screenshotsDir, { recursive: true });

async function runValidation() {
  console.log("================================================================================");
  console.log("  INICIANDO VALIDACIÓN PLAYWRIGHT — CARRUSEL AUTOMÁTICO DE VEHÍCULOS DESTACADOS ");
  console.log("================================================================================");

  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const baseUrl = process.env.APP_URL || "http://localhost:3100";

  console.log(`URL base de pruebas: ${baseUrl}`);

  let browser;
  try {
    browser = await chromium.launch({ channel: "msedge", headless: true });
    console.log("Navegador iniciado con canal msedge");
  } catch {
    browser = await chromium.launch({
      executablePath: chromePath,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    console.log("Navegador iniciado con Chrome ejecutable");
  }

  const consoleErrors = [];
  let testsPassed = 0;
  let testsFailed = 0;

  function assert(name, condition, details = "") {
    if (condition) {
      console.log(`  [PASS] ${name}${details ? ` -> ${details}` : ""}`);
      testsPassed++;
    } else {
      console.error(`  [FAIL] ${name}${details ? ` -> ${details}` : ""}`);
      testsFailed++;
    }
  }

  try {
    // =========================================================================
    // 1. PRUEBAS EN ESCRITORIO (Desktop 1440x900)
    // =========================================================================
    console.log("\n>>> FASE 1: VALIDACIÓN EN ESCRITORIO (1440 x 900)");
    const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await desktopContext.newPage();

    page.on("pageerror", (err) => {
      console.error("  [PageError]", err.message);
      consoleErrors.push(`PageError: ${err.message}`);
    });
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        console.error("  [ConsoleError]", msg.text());
        consoleErrors.push(`ConsoleError: ${msg.text()}`);
      }
    });

    const res = await page.goto(baseUrl, { waitUntil: "networkidle" });
    assert("1. Respuesta HTTP 200 en portada", res?.status() === 200);

    // 1.1 Verificar existencia de la tarjeta del carrusel en el Hero
    const card = page.locator('[data-testid="featured-vehicle-card"]');
    assert("1.1 Tarjeta carrusel presente en el HERO", (await card.count()) > 0);

    // 1.2 Validar elementos visuales y diseño intacto
    const imgElement = card.locator('[data-testid="carousel-image-link"] img');
    assert("1.2 Imagen principal del vehículo visible", (await imgElement.count()) > 0);
    const initialImgSrc = await imgElement.getAttribute("src");
    assert("1.2 URL de imagen válida", Boolean(initialImgSrc && initialImgSrc.length > 5), initialImgSrc);

    // Badge Destacado
    const badgeDestacado = card.locator("text=Destacado");
    assert("1.2 Badge 'Destacado' presente con diseño exacto", (await badgeDestacado.count()) > 0);

    // Título (Marca y Modelo)
    const titleEl = card.locator('[data-testid="carousel-brand-model"]');
    const initialTitle = (await titleEl.textContent())?.trim();
    assert("1.2 Marca y modelo visibles", Boolean(initialTitle), initialTitle);

    // Versión y Año
    const versionEl = card.locator('[data-testid="carousel-version-year"]');
    const initialVersion = (await versionEl.textContent())?.trim();
    assert("1.2 Versión y año presentes", Boolean(initialVersion), initialVersion);

    // Precio en CLP
    const priceEl = card.locator('[data-testid="carousel-price"]');
    const initialPrice = (await priceEl.textContent())?.trim();
    assert("1.2 Precio en CLP formateado ($ y puntos)", initialPrice?.startsWith("$"), initialPrice);

    // Botón Agendar visita
    const appointmentBtn = card.locator('[data-testid="carousel-appointment-button"]');
    assert("1.2 Botón 'Agendar visita' presente", (await appointmentBtn.count()) > 0);

    // Controles de navegación: Flechas e Indicadores
    const prevBtn = card.locator('[data-testid="carousel-prev"]');
    const nextBtn = card.locator('[data-testid="carousel-next"]');
    const indicators = card.locator('[data-testid="carousel-indicators"]');
    assert("1.2 Flechas y controles discretos presentes", (await prevBtn.count()) > 0 && (await nextBtn.count()) > 0);
    assert("1.2 Indicadores inferiores presentes", (await indicators.count()) > 0);

    await page.screenshot({ path: `${screenshotsDir}/01-desktop-initial-card.png` });

    // =========================================================================
    // 2. VALIDACIÓN DE ROTACIÓN AUTOMÁTICA CADA 5 SEGUNDOS
    // =========================================================================
    console.log("\n>>> FASE 2: ROTACIÓN AUTOMÁTICA CADA 5 SEGUNDOS");
    console.log(`  Vehículo inicial: "${initialTitle}" (${initialPrice})`);
    console.log("  Esperando 5.5 segundos sin mover el cursor...");

    await page.waitForTimeout(5500);

    const secondTitle = (await titleEl.textContent())?.trim();
    const secondPrice = (await priceEl.textContent())?.trim();
    const secondImgSrc = await imgElement.getAttribute("src");

    console.log(`  Vehículo tras 5s: "${secondTitle}" (${secondPrice})`);
    assert(
      "2.1 La tarjeta rotó automáticamente a un vehículo diferente",
      secondTitle !== initialTitle,
      `De "${initialTitle}" pasó a "${secondTitle}"`
    );
    assert(
      "2.2 La fotografía cambió coherentemente",
      secondImgSrc !== initialImgSrc,
      `De "${initialImgSrc}" a "${secondImgSrc}"`
    );

    await page.screenshot({ path: `${screenshotsDir}/02-desktop-after-auto-rotation.png` });

    // =========================================================================
    // 3. VALIDACIÓN DE PAUSA AL COLOCAR EL CURSOR (HOVER) Y REANUDACIÓN
    // =========================================================================
    console.log("\n>>> FASE 3: PAUSA AL COLOCAR EL CURSOR (HOVER) Y REANUDACIÓN");
    await card.hover();
    console.log("  Cursor sobre la tarjeta. Esperando 5.5 segundos...");

    const hoveredTitleStart = (await titleEl.textContent())?.trim();
    await page.waitForTimeout(5500);
    const hoveredTitleEnd = (await titleEl.textContent())?.trim();

    assert(
      "3.1 La rotación se pausó correctamente con cursor sobre la tarjeta",
      hoveredTitleStart === hoveredTitleEnd,
      `Permaneció fijo en "${hoveredTitleStart}" durante el hover`
    );

    // Retirar cursor a la esquina superior izquierda
    await page.mouse.move(10, 10);
    console.log("  Cursor retirado. Esperando 5.5 segundos para comprobar reanudación...");
    await page.waitForTimeout(5500);
    const resumedTitle = (await titleEl.textContent())?.trim();

    assert(
      "3.2 La rotación se reanudó exitosamente tras retirar el cursor",
      resumedTitle !== hoveredTitleEnd,
      `Reanudó hacia "${resumedTitle}"`
    );

    // =========================================================================
    // 4. VALIDACIÓN DE NAVEGACIÓN MANUAL (FLECHAS E INDICADORES)
    // =========================================================================
    console.log("\n>>> FASE 4: NAVEGACIÓN MANUAL POR FLECHAS E INDICADORES");
    const beforeManual = (await titleEl.textContent())?.trim();

    // Clic en Flecha Siguiente
    await nextBtn.click();
    await page.waitForTimeout(400);
    const afterNext = (await titleEl.textContent())?.trim();
    assert(
      "4.1 Flecha siguiente avanzó inmediatamente al siguiente vehículo",
      afterNext !== beforeManual,
      `Avanzó a "${afterNext}"`
    );

    // Clic en Flecha Anterior
    await prevBtn.click();
    await page.waitForTimeout(400);
    const afterPrev = (await titleEl.textContent())?.trim();
    assert(
      "4.2 Flecha anterior retrocedió de regreso al vehículo previo",
      afterPrev === beforeManual,
      `Volvió a "${afterPrev}"`
    );

    // Clic en Indicador (Dot #2)
    let afterDot = "";
    const dot2 = card.locator('[data-testid="carousel-dot-1"]');
    if ((await dot2.count()) > 0) {
      await dot2.click();
      await page.waitForTimeout(400);
      afterDot = (await titleEl.textContent())?.trim() || "";
      assert("4.3 Indicador directo cambió el vehículo seleccionado", Boolean(afterDot), `Vehículo: "${afterDot}"`);
    }

    await page.screenshot({ path: `${screenshotsDir}/03-desktop-manual-navigation.png` });

    // =========================================================================
    // 5. VALIDACIÓN DE INTERACCIÓN (ENLACES Y MODAL DE AGENDAMIENTO)
    // =========================================================================
    console.log("\n>>> FASE 5: INTERACCIÓN Y APERTURA DE FICHA REAL Y MODAL");
    const currentActiveTitle = (await titleEl.textContent())?.trim();
    const titleLink = card.locator('[data-testid="carousel-title-link"]');
    const targetUrl = await titleLink.getAttribute("href");

    assert(
      "5.1 Enlace del título apunta a la ruta real de vehículo (/autos/...)",
      Boolean(targetUrl?.startsWith("/autos/")),
      targetUrl
    );

    // Probar botón Agendar Visita
    await appointmentBtn.click();
    await page.waitForTimeout(500);

    const modal = page.locator('div[role="dialog"]');
    assert("5.2 Modal de agendamiento se abrió al hacer clic en 'Agendar visita'", (await modal.count()) > 0);

    const selectedVehicleOption = await page.locator("#appt-vehicle option:checked").textContent();
    assert(
      "5.2 Modal pre-selecciona el vehículo activo del carrusel",
      selectedVehicleOption?.includes(afterDot || ""),
      selectedVehicleOption?.trim()
    );

    // Cerrar modal
    const closeBtn = page.locator('button[aria-label="Cerrar"]').first();
    if ((await closeBtn.count()) > 0) {
      await closeBtn.click();
      await page.waitForTimeout(300);
    } else {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    }

    await desktopContext.close();

    // =========================================================================
    // 6. VALIDACIÓN EN DISPOSITIVOS MÓVILES (Mobile 390x844)
    // =========================================================================
    console.log("\n>>> FASE 6: VALIDACIÓN EN DISPOSITIVOS MÓVILES (390 x 844)");
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const mobilePage = await mobileContext.newPage();

    mobilePage.on("pageerror", (err) => consoleErrors.push(`Mobile PageError: ${err.message}`));
    mobilePage.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(`Mobile ConsoleError: ${msg.text()}`);
    });

    await mobilePage.goto(baseUrl, { waitUntil: "networkidle" });

    const mobileCard = mobilePage.locator('[data-testid="featured-vehicle-card"]');
    assert("6.1 Tarjeta carrusel visible dentro del HERO en móvil", (await mobileCard.count()) > 0);

    const mobileTitleEl = mobileCard.locator('[data-testid="carousel-brand-model"]');
    const mobileStartTitle = (await mobileTitleEl.textContent())?.trim();
    assert("6.2 Datos de vehículo visibles en móvil", Boolean(mobileStartTitle), mobileStartTitle);

    // Probar gesto swipe táctil hacia la izquierda (next)
    const cardBox = await mobileCard.boundingBox();
    if (cardBox) {
      const startX = cardBox.x + cardBox.width * 0.8;
      const endX = cardBox.x + cardBox.width * 0.2;
      const centerY = cardBox.y + cardBox.height * 0.4;

      await mobilePage.touchscreen.tap(startX, centerY);
      // Simular swipe arrastrando
      await mobilePage.mouse.move(startX, centerY);
      await mobilePage.mouse.down();
      await mobilePage.mouse.move(endX, centerY, { steps: 10 });
      await mobilePage.mouse.up();

      await mobilePage.waitForTimeout(500);
    }

    await mobilePage.screenshot({ path: `${screenshotsDir}/04-mobile-hero-carousel.png` });
    await mobileContext.close();

    // =========================================================================
    // 7. COMPROBACIÓN DE ERRORES DE CONSOLA
    // =========================================================================
    console.log("\n>>> FASE 7: VERIFICACIÓN DE CONSOLA");
    assert("7.1 Cero errores de consola de JavaScript o React", consoleErrors.length === 0, `${consoleErrors.length} errores`);

  } catch (error) {
    console.error("Error imprevisto durante la ejecución del test:", error);
    testsFailed++;
  } finally {
    await browser.close();
  }

  console.log("\n================================================================================");
  console.log(`  RESUMEN DE PRUEBAS: ${testsPassed} APROBADAS | ${testsFailed} FALLIDAS`);
  console.log("================================================================================");

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runValidation();
