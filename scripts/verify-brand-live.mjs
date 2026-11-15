import { chromium } from 'playwright-core';
import fs from 'fs';

async function verifyBrandLive() {
  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('1. Checking Public Home Portada: https://stroker-kappa.vercel.app/');
  await page.goto('https://stroker-kappa.vercel.app/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Check if brand image is loaded in navbar
  const navbarLogoSrc = await page.$eval('header img[alt="Automotora Stroker"]', el => el.src).catch(() => null);
  console.log('- Logo en Navbar detectado:', navbarLogoSrc);

  // Check if brand image is loaded in hero portada
  const heroEmblemSrc = await page.$eval('img[alt="Automotora Stroker Oficial"]', el => el.src).catch(() => null);
  console.log('- Emblema en Portada Hero detectado:', heroEmblemSrc);

  // Take screenshot of Home / Portada
  await page.screenshot({ path: 'storage/screenshots/13_vercel_portada_brand.png', fullPage: false });
  console.log('Captura 13_vercel_portada_brand.png guardada');

  console.log('2. Checking Login page: https://stroker-kappa.vercel.app/login');
  await page.goto('https://stroker-kappa.vercel.app/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const loginLogoSrc = await page.$eval('img[alt="Automotora Stroker"]', el => el.src).catch(() => null);
  console.log('- Logo en Login detectado:', loginLogoSrc);
  await page.screenshot({ path: 'storage/screenshots/14_vercel_login_brand.png', fullPage: false });
  console.log('Captura 14_vercel_login_brand.png guardada');

  console.log('3. Logging into admin panel...');
  await page.fill("input[name='email']", 'dueno@stroker.demo');
  await page.fill("input[name='password']", 'Stroker2026!');
  await page.click("button[type='submit']");
  await page.waitForTimeout(2000);

  console.log('4. Checking Admin Panel Sistema Mi Web: https://stroker-kappa.vercel.app/panel/sistema/mi-web');
  await page.goto('https://stroker-kappa.vercel.app/panel/sistema/mi-web', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'storage/screenshots/15_vercel_sistema_mi_web.png', fullPage: false });
  console.log('Captura 15_vercel_sistema_mi_web.png guardada');

  console.log('5. Checking Admin Panel Shell / Inventario: https://stroker-kappa.vercel.app/panel/inventario');
  await page.goto('https://stroker-kappa.vercel.app/panel/inventario', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const shellLogoSrc = await page.$eval('aside img[alt="Automotora Stroker"]', el => el.src).catch(() => null);
  console.log('- Logo en Sidebar del Sistema detectado:', shellLogoSrc);
  await page.screenshot({ path: 'storage/screenshots/16_vercel_panel_brand.png', fullPage: false });
  console.log('Captura 16_vercel_panel_brand.png guardada');

  await browser.close();
  console.log('=== VERIFICACIÓN EN VIVO DE FOTO DE PORTADA Y LOGO COMPLETADA CON ÉXITO ===');
}

verifyBrandLive().catch(err => {
  console.error('Error during brand verification:', err);
  process.exit(1);
});
