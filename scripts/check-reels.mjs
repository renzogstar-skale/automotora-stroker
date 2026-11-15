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
    console.log("Navigating to reels...");
    await page.goto("https://www.instagram.com/automotora_stroker/reels/", { waitUntil: "networkidle", timeout: 25000 });
    const reels = await page.$$eval("a[href*='/reel/'], a[href*='/p/']", els =>
      els.map(el => ({ url: el.href, imgSrc: el.querySelector("img")?.src, alt: el.querySelector("img")?.alt }))
    );
    console.log(`Reels tab found ${reels.length} items:`, reels);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await browser.close();
  }
}

main();
