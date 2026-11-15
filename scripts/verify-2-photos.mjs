import { chromium } from "playwright-core";

async function verify() {
  const browser = await chromium.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  console.log("1. Verificando /autos...");
  await page.goto("https://stroker-kappa.vercel.app/autos", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  const badge2Photos = await page.$$eval("span", (els) =>
    els.filter((e) => e.textContent.includes("2 fotos")).length
  );
  console.log('Tarjetas con indicador "2 fotos":', badge2Photos);

  await page.screenshot({ path: "storage/screenshots/20_catalogo_2_fotos.png", fullPage: false });
  console.log("Captura 20_catalogo_2_fotos.png guardada");

  console.log("2. Verificando ficha individual (/autos/porsche-panamera-2018)...");
  await page.goto("https://stroker-kappa.vercel.app/autos/porsche-panamera-2018", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  const counterText = await page.$$eval("div", (els) => {
    const match = els.find((e) => e.textContent.includes("fotos") && e.textContent.includes("/"));
    return match ? match.textContent.trim() : "no encontrado";
  });
  console.log("Indicador de fotos en galería:", counterText);

  const thumbsCount = await page.$$eval(".flex.gap-2\\.5 img", (els) => els.length);
  console.log("Cantidad de miniaturas en galería:", thumbsCount);

  await page.screenshot({ path: "storage/screenshots/21_ficha_2_fotos.png", fullPage: false });
  console.log("Captura 21_ficha_2_fotos.png guardada");

  await browser.close();
}

verify().catch(console.error);
