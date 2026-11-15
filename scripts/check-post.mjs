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
    const postUrl = "https://www.instagram.com/p/Dfu6Q3ImH5-/";
    console.log(`Navigating to ${postUrl} ...`);
    await page.goto(postUrl, { waitUntil: "networkidle", timeout: 25000 });
    
    const title = await page.title();
    console.log("Post Title:", title);

    // Look for caption element / h1 / meta description
    const metaDesc = await page.$eval('meta[name="description"]', el => el.content).catch(() => null);
    const ogDesc = await page.$eval('meta[property="og:description"]', el => el.content).catch(() => null);
    const ogTitle = await page.$eval('meta[property="og:title"]', el => el.content).catch(() => null);
    console.log("meta description:", metaDesc);
    console.log("og:description:", ogDesc);
    console.log("og:title:", ogTitle);

    // Get article text
    const articleText = await page.$eval('article', el => el.innerText).catch(() => null);
    console.log("Article text:\n", articleText);

    // Get all image sources inside article
    const images = await page.$$eval('article img', els => els.map(e => ({ src: e.src, alt: e.alt })));
    console.log("Article images count:", images.length);
    console.log("Article images:", JSON.stringify(images, null, 2));

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await browser.close();
  }
}

main();
