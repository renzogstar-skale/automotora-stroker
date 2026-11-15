import { chromium } from "playwright-core";

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--disable-blink-features=AutomationControlled"]
  });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 900 },
    locale: "es-CL"
  });
  const page = await context.newPage();
  try {
    const postUrl = "https://www.instagram.com/automotora_stroker/p/Dfu6Q3ImH5-/";
    await page.goto(postUrl, { waitUntil: "networkidle", timeout: 20000 });
    
    const photos = new Set();
    const collectVisible = async () => {
      const urls = await page.$$eval('article img, div[role="dialog"] img, main img', els => 
        els.map(e => e.src).filter(s => s && s.includes('cdninstagram.com') && !s.includes('s150x150') && !s.includes('profile_pic'))
      );
      for (const u of urls) photos.add(u);
    };

    await collectVisible();
    console.log("Initial photos:", photos.size);

    for (let step = 0; step < 10; step++) {
      const nextBtn = await page.$('button[aria-label="Siguiente"], button[aria-label="Next"], article button svg[aria-label="Siguiente"]');
      if (!nextBtn) {
        console.log("No more next button found at step", step);
        break;
      }
      // Click the parent button if svg was found
      const btnToClick = await page.$('button[aria-label="Siguiente"], button[aria-label="Next"]');
      if (btnToClick) {
        await btnToClick.click().catch(() => {});
      } else {
        await nextBtn.click().catch(() => {});
      }
      await page.waitForTimeout(1000);
      await collectVisible();
      console.log(`Step ${step + 1} photos:`, photos.size);
    }

    console.log("Total photos collected from carousel:", photos.size);
    console.log("Collected photo URLs:", Array.from(photos));

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await browser.close();
  }
}

main();
