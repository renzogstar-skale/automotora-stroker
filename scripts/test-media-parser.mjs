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
    
    const html = await page.content();
    // Search for display_url or carousel children in html
    const matches = [...html.matchAll(/"display_url":"(https:[^"]+)"/g)].map(m => m[1].replace(/\\u0026/g, "&"));
    console.log("Display URLs found in page source:", matches.length);
    console.log("Display URLs:", [...new Set(matches)]);

    // Check for video_url
    const videoMatches = [...html.matchAll(/"video_url":"(https:[^"]+)"/g)].map(m => m[1].replace(/\\u0026/g, "&"));
    console.log("Video URLs found:", videoMatches.length);
    console.log("Video URLs:", [...new Set(videoMatches)]);

    // Check taken_at_timestamp
    const timeMatches = [...html.matchAll(/"taken_at_timestamp":([0-9]+)/g)].map(m => m[1]);
    console.log("Timestamps found:", timeMatches);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await browser.close();
  }
}

main();
