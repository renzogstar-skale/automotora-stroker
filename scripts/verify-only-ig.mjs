import { chromium } from 'playwright-core';
import fs from 'fs';

async function verifyOnlyIG() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('1. Iniciar sesión en https://stroker-kappa.vercel.app/login');
  await page.goto('https://stroker-kappa.vercel.app/login', { waitUntil: 'networkidle' });
  await page.fill("input[name='email']", 'dueno@stroker.demo');
  await page.fill("input[name='password']", 'Stroker2026!');
  await page.click("button[type='submit']");
  await page.waitForTimeout(2000);

  console.log('2. Navegar a https://stroker-kappa.vercel.app/panel/inventario');
  await page.goto('https://stroker-kappa.vercel.app/panel/inventario', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  const text = await page.innerText('body');

  // Check stats counter
  console.log('--- INDICADORES DEL PANEL ---');
  const totalVehiclesMatch = text.match(/TOTAL VEHÍCULOS\s*(\d+)/i) || text.match(/Total Vehículos\s*(\d+)/i);
  const disponiblesMatch = text.match(/DISPONIBLES\s*(\d+)/i) || text.match(/Disponibles\s*(\d+)/i);
  const vendidosMatch = text.match(/VENDIDOS\s*(\d+)/i) || text.match(/Vendidos\s*(\d+)/i);
  const reservadosMatch = text.match(/RESERVADOS\s*(\d+)/i) || text.match(/Reservados\s*(\d+)/i);

  console.log('Total Vehículos:', totalVehiclesMatch ? totalVehiclesMatch[1] : 'N/A');
  console.log('Disponibles:', disponiblesMatch ? disponiblesMatch[1] : 'N/A');
  console.log('Vendidos:', vendidosMatch ? vendidosMatch[1] : 'N/A');
  console.log('Reservados:', reservadosMatch ? reservadosMatch[1] : 'N/A');

  // Check table rows
  const rows = await page.$$eval('table tbody tr', trs => {
    return trs.map(tr => {
      const text = tr.innerText;
      const hasIG = text.includes('IG');
      return { text: text.split('\n').slice(0, 3).join(' | '), hasIG };
    });
  });

  console.log(`\nFilas de vehículos en tabla (${rows.length}):`);
  let nonIgCount = 0;
  for (const r of rows) {
    if (!r.hasIG) nonIgCount++;
    console.log(`- [${r.hasIG ? 'IG' : 'SIN IG'}] ${r.text}`);
  }

  console.log(`\nTotal vehículos en tabla: ${rows.length}`);
  console.log(`Total sin badge IG: ${nonIgCount}`);

  // Take screenshot
  fs.mkdirSync('storage/screenshots', { recursive: true });
  await page.screenshot({ path: 'storage/screenshots/18_panel_only_ig.png', fullPage: false });
  console.log('Captura guardada en storage/screenshots/18_panel_only_ig.png');

  // Also check public catalog
  console.log('\n3. Verificando catálogo público: https://stroker-kappa.vercel.app/autos');
  await page.goto('https://stroker-kappa.vercel.app/autos', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const catalogText = await page.innerText('body');
  const catalogCountMatch = catalogText.match(/(\d+)\s*unidades?\s*con estos filtros/i);
  console.log('Unidades en catálogo público:', catalogCountMatch ? catalogCountMatch[1] : 'N/A');
  await page.screenshot({ path: 'storage/screenshots/19_autos_only_ig.png', fullPage: false });
  console.log('Captura guardada en storage/screenshots/19_autos_only_ig.png');

  await browser.close();
}

verifyOnlyIG().catch(err => {
  console.error('Error during verification:', err);
  process.exit(1);
});
