import { chromium } from "playwright-core";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import path from "path";

const POST_URLS = [
  "https://www.instagram.com/automotora_stroker/p/Dc4NffpmJhh/",
  "https://www.instagram.com/automotora_stroker/p/Dc_kbVVkX19/",
  "https://www.instagram.com/automotora_stroker/p/DeIHI4eGMRk/",
  "https://www.instagram.com/automotora_stroker/p/Dfu6Q3ImH5-/",
  "https://www.instagram.com/automotora_stroker/p/Dfpv8SpmCFm/",
  "https://www.instagram.com/automotora_stroker/p/DfpvQfNmHvK/",
  "https://www.instagram.com/automotora_stroker/p/DfnAAeDoGDE/",
  "https://www.instagram.com/automotora_stroker/p/Dfh_l4SmP7s/",
  "https://www.instagram.com/automotora_stroker/p/DfXqA9zGFbM/",
  "https://www.instagram.com/automotora_stroker/p/DfC1yDaEVrV/",
  "https://www.instagram.com/automotora_stroker/p/DfCxuHbEUkq/",
  "https://www.instagram.com/automotora_stroker/p/DfCtSRhkffk/",
  "https://www.instagram.com/automotora_stroker/reel/DexG0fntLyM/",
  "https://www.instagram.com/automotora_stroker/reel/Dc14EX4xux5/",
  "https://www.instagram.com/automotora_stroker/reel/DVJKnRjkV-h/",
  "https://www.instagram.com/automotora_stroker/reel/DVJKgsvEYt6/",
  "https://www.instagram.com/automotora_stroker/reel/DQnfCCJDJb3/",
  "https://www.instagram.com/automotora_stroker/reel/DQm5t1Ckd29/",
  "https://www.instagram.com/automotora_stroker/reel/CvlQBFrtPi7/",
  "https://www.instagram.com/automotora_stroker/reel/CoKVUE4Awku/"
];

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

  const results = [];

  for (let i = 0; i < POST_URLS.length; i++) {
    const url = POST_URLS[i];
    console.log(`[${i + 1}/${POST_URLS.length}] Fetching ${url} ...`);
    const page = await context.newPage();
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 20000 });
      
      const ogTitle = await page.$eval('meta[property="og:title"]', el => el.content).catch(() => null);
      const ogDesc = await page.$eval('meta[property="og:description"]', el => el.content).catch(() => null);
      const metaDesc = await page.$eval('meta[name="description"]', el => el.content).catch(() => null);
      const ogImage = await page.$eval('meta[property="og:image"]', el => el.content).catch(() => null);
      const ogVideo = await page.$eval('meta[property="og:video"]', el => el.content).catch(() => null);

      // Collect all images on page with cdninstagram
      const pageImages = await page.$$eval('img', els => 
        els.map(e => ({ src: e.src, alt: e.alt, width: e.naturalWidth || e.width, height: e.naturalHeight || e.height }))
           .filter(e => e.src.includes('cdninstagram.com') || e.src.includes('fbcdn.net'))
      );

      // Collect scripts with potential high-res photos
      const html = await page.content();
      const rawImageMatches = [...html.matchAll(/https:\/\/[^"'\s\\]+cdninstagram\.com[^"'\s\\]+/g)]
        .map(m => m[0].replace(/\\u0026/g, "&"))
        .filter(u => u.includes(".jpg") || u.includes(".heic") || u.includes(".png") || u.includes(".webp"));
      
      const uniqueMedia = [...new Set([ogImage, ...pageImages.map(p => p.src), ...rawImageMatches].filter(Boolean))];

      // Extract caption from ogTitle or ogDesc
      let caption = "";
      if (ogDesc && ogDesc.includes(' - automotora_stroker')) {
        const parts = ogDesc.split(' - automotora_stroker');
        caption = parts.slice(1).join(' - automotora_stroker').replace(/^[^\"]*\"/, '').replace(/\"[^\"]*$/, '');
      } else if (ogTitle && ogTitle.includes(' en Instagram: "')) {
        caption = ogTitle.split(' en Instagram: "')[1]?.replace(/\"$/, '') || ogTitle;
      } else {
        caption = ogDesc || metaDesc || ogTitle || "";
      }

      results.push({
        url,
        ogTitle,
        ogDesc,
        metaDesc,
        caption,
        ogImage,
        ogVideo,
        pageImages,
        uniqueMediaCount: uniqueMedia.length,
        mediaCandidates: uniqueMedia.slice(0, 10)
      });
      console.log(`  -> Caption length: ${caption.length}, media found: ${uniqueMedia.length}`);
    } catch (err) {
      console.error(`  -> Error fetching ${url}:`, err.message);
      results.push({ url, error: err.message });
    } finally {
      await page.close();
    }
  }

  await browser.close();

  mkdirSync("./storage", { recursive: true });
  writeFileSync("./storage/instagram_raw_posts.json", JSON.stringify(results, null, 2), "utf8");
  console.log(`Done! Scraped ${results.length} publications. Saved to storage/instagram_raw_posts.json`);
}

main();
