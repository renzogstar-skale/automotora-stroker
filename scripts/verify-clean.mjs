import { chromium } from 'playwright-core';

async function testClean() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('https://stroker-kappa.vercel.app/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const hasOldBox = await page.$('img[alt="Automotora Stroker Oficial"]');
  console.log('Old badge box present:', !!hasOldBox);

  const h1 = await page.textContent('h1');
  console.log('H1:', h1.trim());

  await page.screenshot({ path: 'storage/screenshots/17_portada_clean.png', fullPage: false });
  console.log('Screenshot saved to storage/screenshots/17_portada_clean.png');

  await browser.close();
}
testClean().catch(console.error);
