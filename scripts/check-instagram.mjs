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
    console.log("Navigating to https://www.instagram.com/automotora_stroker/ ...");
    await page.goto("https://www.instagram.com/automotora_stroker/", { waitUntil: "networkidle", timeout: 25000 });
    
    // Find all links to posts / reels
    const links = await page.$$eval("a", els => 
      els.map(e => ({ href: e.href, text: e.innerText, ariaLabel: e.getAttribute("aria-label") }))
         .filter(e => e.href.includes("/p/") || e.href.includes("/reel/"))
    );
    console.log(`Found ${links.length} post/reel links:`);
    console.log(JSON.stringify(links.slice(0, 10), null, 2));

    // Check images
    const images = await page.$$eval("article img, main img", els =>
      els.map(e => ({ src: e.src, alt: e.alt }))
    );
    console.log(`Found ${images.length} images in main/article:`);
    console.log(JSON.stringify(images.slice(0, 5), null, 2));

  } catch (err) {
    console.error("Navigation error:", err.message);
  } finally {
    await browser.close();
  }
}

main();
