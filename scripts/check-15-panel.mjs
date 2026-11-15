import { chromium } from 'playwright-core';

async function checkVehicles() {
  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('https://stroker-kappa.vercel.app/login', { waitUntil: 'networkidle' });
  await page.fill("input[name='email']", 'dueno@stroker.demo');
  await page.fill("input[name='password']", 'Stroker2026!');
  await page.click("button[type='submit']");
  await page.waitForTimeout(2000);

  const officialVehicles = [
    { name: 'Volkswagen Saveiro', q: 'Saveiro', code: 'STK-DC4NFFPM' },
    { name: 'Porsche Panamera', q: 'Panamera', code: 'STK-DCKBVVKX' },
    { name: 'Chevrolet Silverado', q: 'Silverado', code: 'STK-DEIHI4EG' },
    { name: 'Geely Azkarra', q: 'Azkarra', code: 'STK-DFU6Q3IM' },
    { name: 'Honda Fat Cat', q: 'Fat Cat', code: 'STK-DFPV8SPM' },
    { name: 'Volkswagen Amarok', q: 'Amarok', code: 'STK-DFPVQFNM' },
    { name: 'Jeep Wrangler', q: 'Wrangler', code: 'STK-DFNAAEDO' },
    { name: 'Ford Explorer', q: 'Explorer', code: 'STK-DFHL4SMP' },
    { name: 'Chery Tiggo 7 Pro', q: 'Tiggo', code: 'STK-DFXQA9ZG' },
    { name: 'Peugeot Partner', q: 'Partner', code: 'STK-DFC1YDAE' },
    { name: 'Triumph Bonneville', q: 'Bonneville', code: 'STK-DFCXUHBE' },
    { name: 'BMW M4', q: 'M4', code: 'STK-DFCTSRHK' },
    { name: 'Coleman Lantern', q: 'Coleman', code: 'STK-DC14EX4X' },
    { name: 'Can-Am Maverick', q: 'Maverick', code: 'STK-DQNFCCJD' },
    { name: 'Can-Am Renegade', q: 'Renegade', code: 'STK-DQM5T1CK' },
  ];

  console.log('=== VERIFICANDO CADA UNO DE LOS 15 VEHÍCULOS EN PANEL /panel/inventario ===');
  let successCount = 0;
  for (const v of officialVehicles) {
    await page.goto(`https://stroker-kappa.vercel.app/panel/inventario?q=${encodeURIComponent(v.q)}`, { waitUntil: 'networkidle' });
    const text = await page.innerText('body');
    const hasName = text.includes(v.name) || text.includes(v.q);
    const hasCode = text.includes(v.code);
    const ok = hasName || hasCode;
    if (ok) successCount++;
    console.log(`[${ok ? 'OK' : 'FAIL'}] ${v.name} (${v.code}): ${ok ? 'ENCONTRADO' : 'NO ENCONTRADO'}`);
  }

  console.log(`\nRESULTADO FINAL: ${successCount} de ${officialVehicles.length} vehículos verificados en https://stroker-kappa.vercel.app/panel/inventario`);

  // Verify Instagram sync page as well
  await page.goto('https://stroker-kappa.vercel.app/panel/inventario/instagram-sync', { waitUntil: 'networkidle' });
  const syncText = await page.innerText('body');
  console.log('\nPágina /panel/inventario/instagram-sync cargada:', syncText.includes('Sincronización con Instagram') || syncText.includes('Instagram'));

  await browser.close();
}

checkVehicles().catch(console.error);
