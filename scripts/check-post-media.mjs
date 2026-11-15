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
    await page.goto(postUrl, { waitUntil: "networkidle", timeout: 25000 });
    
    // Check og:image
    const ogImages = await page.$$eval('meta[property="og:image"]', els => els.map(e => e.content));
    console.log("og:images:", ogImages);

    // Check all img tags on page
    const allImgs = await page.$$eval('img', els => els.map(e => ({ src: e.src, alt: e.alt, width: e.width, height: e.height })));
    console.log("all img tags:", allImgs.filter(i => i.src.includes("cdninstagram.com") || i.src.includes("fbcdn.net")));

    // Check for JSON-LD scripts
    const ldJsons = await page.$$eval('script[type="application/ld+json"]', els => els.map(e => e.innerText));
    console.log("JSON-LD scripts:", ldJsons);

    // Check script tags containing shared data or relay
    const scriptSnippets = await page.$$eval('script', els => 
      els.map(e => e.innerText)
         .filter(t => t.includes("display_url") || t.includes("edge_sidecar_to_children") || t.includes("graphql") || t.includes("xdt_shortcode_media"))
    );
    console.log("Matching scripts count:", scriptSnippets.length);
    if (scriptSnippets.length > 0) {
      console.log("Script snippet preview:", scriptSnippets[0].slice(0, 500));
    }

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await browser.close();
  }
}

main();
