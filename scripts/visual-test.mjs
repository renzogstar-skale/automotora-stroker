import { chromium } from "playwright-core";
import { db } from "../src/lib/db.ts";
import { randomToken, sha256 } from "../src/lib/crypto.ts";
import { mkdirSync } from "fs";

const screenshotsDir = "./test-results/screenshots";
mkdirSync(screenshotsDir, { recursive: true });

async function run() {
  console.log("=== INICIANDO PRUEBAS VISUALES CON PLAYWRIGHT ===");

  // 1. Crear sesión de prueba para dueno@stroker.demo
  const u = await db.user.findUniqueOrThrow({ where: { email: "dueno@stroker.demo" } });
  const token = randomToken();
  await db.session.create({
    data: {
      userId: u.id,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + 864e5),
    },
  });

  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
  });

  const viewports = [
    { name: "desktop", width: 1440, height: 900 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "mobile", width: 390, height: 844 },
  ];

  const routes = [
    { name: "vitrina", path: "/", auth: false },
    { name: "login", path: "/login", auth: false },
    { name: "panel_dashboard", path: "/panel", auth: true },
    { name: "panel_inventario", path: "/panel/inventario", auth: true },
    { name: "panel_crm", path: "/panel/crm", auth: true },
  ];

  let errors = [];

  for (const vp of viewports) {
    console.log(`\n--- Probando viewport: ${vp.name} (${vp.width}x${vp.height}) ---`);
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
    });

    if (token) {
      await context.addCookies([
        {
          name: "stk_session",
          value: token,
          domain: "localhost",
          path: "/",
        },
      ]);
    }

    const page = await context.newPage();

    for (const r of routes) {
      const url = `http://localhost:3000${r.path}`;
      const res = await page.goto(url, { waitUntil: "networkidle" });
      const status = res?.status();

      // Verificar desbordamiento horizontal
      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return {
          scrollWidth: doc.scrollWidth,
          clientWidth: doc.clientWidth,
          hasOverflow: doc.scrollWidth > doc.clientWidth,
        };
      });

      console.log(
        `[${vp.name}] ${r.name} (${r.path}): Status ${status} | Overflow: ${overflow.hasOverflow ? "FALLÓ (desborde: " + (overflow.scrollWidth - overflow.clientWidth) + "px)" : "OK (0px)"}`
      );

      if (overflow.hasOverflow) {
        errors.push(`Desbordamiento horizontal en [${vp.name}] ruta ${r.path}`);
      }

      // Guardar captura de pantalla
      const shotPath = `${screenshotsDir}/${vp.name}_${r.name}.png`;
      await page.screenshot({ path: shotPath, fullPage: false });
    }

    await context.close();
  }

  await browser.close();
  await db.$disconnect();

  console.log("\n=== RESULTADO PRUEBAS VISUALES ===");
  if (errors.length === 0) {
    console.log("✔ TODAS LAS PRUEBAS VISUALES PASARON EXITOSAMENTE (Sin desbordamientos en escritorio, tablet ni móvil).");
  } else {
    console.error("✖ Errores detectados:\n" + errors.join("\n"));
    process.exit(1);
  }
}

run().catch((e) => {
  console.error("Error durante las pruebas:", e);
  process.exit(1);
});
