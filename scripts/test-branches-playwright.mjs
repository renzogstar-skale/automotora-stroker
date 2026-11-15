import { chromium } from "playwright-core";
import { mkdirSync } from "fs";

const screenshotsDir = "./test-results/branches-validation";
mkdirSync(screenshotsDir, { recursive: true });

async function runBranchesValidation() {
  console.log("=== INICIANDO VALIDACIÓN EXHAUSTIVA DE SECCIÓN SUCURSALES ===");

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
  console.log("\n--- Probando Sucursales en Escritorio (1440x900) ---");
  const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await desktopContext.newPage();

  page.on("pageerror", (err) => consoleErrors.push(`PageError: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(`ConsoleError: ${msg.text()}`);
    }
  });

  const res = await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  assert("Respuesta HTTP 200 en Home", res?.status() === 200);

  // Scroll a la sección de sucursales
  await page.locator("#sucursales").scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);

  // 1.1 Verificar presencia de sucursales existentes: Santiago y Viña del Mar
  const sucursalesHeading = await page.locator("#sucursales h2").textContent();
  assert("Título de sección 'Nuestras Sucursales' presente", sucursalesHeading?.includes("Nuestras Sucursales"));

  const branchCards = page.locator("#sucursales .card.card-hover");
  const branchCount = await branchCards.count();
  assert("2 sucursales existentes renderizadas", branchCount === 2, `Cantidad: ${branchCount}`);

  const pageText = await page.textContent("#sucursales");
  assert("Sucursal Santiago presente", pageText.includes("Stroker Santiago") && pageText.includes("Providencia"));
  assert("Sucursal Viña del Mar presente", pageText.includes("Stroker Viña del Mar") && pageText.includes("Av. Libertad"));

  // 1.2 Verificar Elementos de Cada Sucursal
  for (let i = 0; i < branchCount; i++) {
    const card = branchCards.nth(i);
    const cardText = await card.textContent();

    // Fotografía real de exhibición
    const img = card.locator("img");
    assert(`Sucursal [${i + 1}] cuenta con fotografía de exhibición`, (await img.count()) > 0);

    // Dirección y horario
    assert(`Sucursal [${i + 1}] especifica dirección física`, cardText.includes("Dirección") || cardText.includes("Av."));
    assert(`Sucursal [${i + 1}] especifica horarios de atención`, cardText.includes("09:30") && cardText.includes("19:00"));

    // Teléfono y WhatsApp
    assert(`Sucursal [${i + 1}] especifica teléfono`, cardText.includes("+56"));
    const waLink = card.locator('a[href*="wa.me"]');
    assert(`Sucursal [${i + 1}] posee enlace de WhatsApp`, (await waLink.count()) > 0);

    // Botón "Cómo llegar" conectado a Google Maps
    const btnMaps = card.locator('a:has-text("Cómo llegar")');
    assert(`Sucursal [${i + 1}] tiene botón 'Cómo llegar'`, (await btnMaps.count()) > 0);
    const hrefMaps = await btnMaps.getAttribute("href");
    assert(
      `Sucursal [${i + 1}] botón 'Cómo llegar' conectado a Google Maps`,
      hrefMaps?.includes("google.com/maps/search")
    );

    // Botón "Ver vehículos de esta sucursal"
    const btnVerVehiculos = card.locator('button:has-text("Ver vehículos")');
    assert(`Sucursal [${i + 1}] tiene botón 'Ver vehículos'`, (await btnVerVehiculos.count()) > 0);

    // Botón "Agendar visita"
    const btnAgendar = card.locator('button:has-text("Agendar visita")');
    assert(`Sucursal [${i + 1}] tiene botón 'Agendar visita'`, (await btnAgendar.count()) > 0);
  }

  // 1.3 Probar Botón "Ver vehículos de esta sucursal"
  console.log("\n--- Probando clic en 'Ver vehículos de esta sucursal' ---");
  const btnFilterBranch = branchCards.first().locator('button:has-text("Ver vehículos")');
  await btnFilterBranch.click();
  await page.waitForTimeout(600);

  // Verificar que la vitrina quedó filtrada
  const activeFilterPill = page.locator("#vitrina").getByText("Sucursal seleccionada");
  assert("Al hacer clic en 'Ver vehículos', la vitrina se filtra por esa sucursal", (await activeFilterPill.count()) > 0);

  // 1.4 Probar Botón "Agendar visita" desde la sucursal
  console.log("\n--- Probando clic en 'Agendar visita' desde la sucursal ---");
  await page.locator("#sucursales").scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);

  const btnAgendaBranch = branchCards.first().locator('button:has-text("Agendar visita")');
  await btnAgendaBranch.click();
  await page.waitForTimeout(400);

  const modalOpen = await page.locator('div[role="dialog"]').isVisible();
  assert("Modal de agendamiento se abre al hacer clic en 'Agendar visita' de la sucursal", modalOpen);

  // Cerrar modal
  const btnCloseModal = page.locator('button[aria-label="Cerrar modal"]');
  await btnCloseModal.click();
  await page.waitForTimeout(300);

  // 1.5 Verificar Sección de Confianza Comercial Verificable
  console.log("\n--- Verificando Sección de Confianza Comercial ---");
  assert("Pilar 'Revisión Técnica 120 Puntos' presente", pageText.includes("120 Puntos") && pageText.includes("Inspección mecánica"));
  assert("Pilar 'Documentación Verificada' presente", pageText.includes("Documentación") && pageText.includes("Registro Civil"));
  assert("Pilar 'Garantía Legal Ley 19.496' presente", pageText.includes("Ley 19.496") && pageText.includes("3 meses"));
  assert("Pilar 'Testimonios Verificables' presente sin inventar reseñas", pageText.includes("Testimonios Verificables") && pageText.includes("No inventamos"));

  await page.screenshot({ path: `${screenshotsDir}/01_desktop_branches.png` });
  await desktopContext.close();

  // --- 2. PRUEBA EN TABLET (768x1024) ---
  console.log("\n--- Probando Sucursales en Tablet (768x1024) ---");
  const tabletContext = await browser.newContext({ viewport: { width: 768, height: 1024 } });
  const tabletPage = await tabletContext.newPage();
  await tabletPage.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await tabletPage.locator("#sucursales").scrollIntoViewIfNeeded();
  await tabletPage.waitForTimeout(400);

  const tabletOverflow = await tabletPage.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  assert("Sin desbordamiento horizontal en Tablet", !tabletOverflow);

  await tabletPage.screenshot({ path: `${screenshotsDir}/02_tablet_branches.png` });
  await tabletContext.close();

  // --- 3. PRUEBA EN MÓVIL (390x844 - iPhone) ---
  console.log("\n--- Probando Sucursales en Móvil (390x844) ---");
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await mobilePage.locator("#sucursales").scrollIntoViewIfNeeded();
  await mobilePage.waitForTimeout(400);

  const mobileOverflow = await mobilePage.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  assert("Sin desbordamiento horizontal en Móvil", !mobileOverflow);

  // Verificar disposición vertical en móvil
  const mobileCards = mobilePage.locator("#sucursales .card.card-hover");
  const firstCardBox = await mobileCards.first().boundingBox();
  const secondCardBox = await mobileCards.nth(1).boundingBox();
  assert(
    "Tarjetas de sucursales apiladas verticalmente en móvil",
    secondCardBox && firstCardBox && secondCardBox.y > firstCardBox.y
  );

  // Probar botón táctil Cómo llegar en móvil
  const mobileMapsBtn = mobileCards.first().locator('a:has-text("Cómo llegar")');
  assert("Botón 'Cómo llegar' táctil y visible en móvil", await mobileMapsBtn.isVisible());

  await mobilePage.screenshot({ path: `${screenshotsDir}/03_mobile_branches.png` });
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
    console.log("✔ TODAS LAS VALIDACIONES DE SUCURSALES PASARON AL 100%");
    process.exit(0);
  }
}

runBranchesValidation().catch((err) => {
  console.error("Error en validación:", err);
  process.exit(1);
});
