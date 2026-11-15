import { chromium } from 'playwright-core';
import fs from 'fs';

async function verifyLive() {
  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('1. Checking Public Vitrina: https://stroker-kappa.vercel.app/');
  await page.goto('https://stroker-kappa.vercel.app/', { waitUntil: 'networkidle' });
  const homeText = await page.innerText('body');
  console.log('Home has Saveiro:', homeText.includes('Saveiro'));
  console.log('Home has Panamera:', homeText.includes('Panamera'));
  console.log('Home has M4:', homeText.includes('BMW M4'));

  console.log('2. Logging into admin panel via https://stroker-kappa.vercel.app/login...');
  await page.goto('https://stroker-kappa.vercel.app/login', { waitUntil: 'networkidle' });
  await page.fill("input[name='email']", 'dueno@stroker.demo');
  await page.fill("input[name='password']", 'Stroker2026!');
  await page.click("button[type='submit']");
  await page.waitForTimeout(2000);

  console.log('3. Checking https://stroker-kappa.vercel.app/panel/inventario...');
  await page.goto('https://stroker-kappa.vercel.app/panel/inventario', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const panelUrl = page.url();
  console.log('Current URL:', panelUrl);
  const panelText = await page.innerText('body');

  const vehiclesToCheck = [
    'Volkswagen Saveiro',
    'Porsche Panamera',
    'Chevrolet Silverado',
    'Geely Azkarra',
    'Honda Fat Cat',
    'Volkswagen Amarok',
    'Jeep Wrangler',
    'Ford Explorer',
    'Chery Tiggo 7 Pro',
    'Peugeot Partner',
    'Triumph Bonneville',
    'BMW M4',
    'Coleman Lantern',
    'Can-Am Maverick',
    'Can-Am Renegade'
  ];

  console.log('--- REVISIÓN DE VEHÍCULOS EN PANEL DE INVENTARIO EN VERCEL ---');
  let foundCount = 0;
  for (const v of vehiclesToCheck) {
    const found = panelText.includes(v);
    if (found) foundCount++;
    console.log(`- ${v}: ${found ? 'PRESENTE' : 'NO ENCONTRADO'}`);
  }
  console.log(`Total encontrados: ${foundCount}/${vehiclesToCheck.length}`);

  // Take screenshot of production panel
  fs.mkdirSync('storage/screenshots', { recursive: true });
  await page.screenshot({ path: 'storage/screenshots/vercel_production_panel_inventario.png', fullPage: true });
  console.log('Captura guardada en storage/screenshots/vercel_production_panel_inventario.png');

  // Also check indicators
  console.log('Indicadores en Panel:');
  console.log('Total Vehículos presente:', panelText.includes('Total Vehículos'));
  console.log('Disponibles presente:', panelText.includes('Disponibles'));
  console.log('Vendidos presente:', panelText.includes('Vendidos'));
  console.log('Reservados presente:', panelText.includes('Reservados'));

  await browser.close();
}

verifyLive().catch(err => {
  console.error('Error verifying live:', err);
  process.exit(1);
});
