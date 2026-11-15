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
    console.log("Loading profile page...");
    await page.goto("https://www.instagram.com/automotora_stroker/", { waitUntil: "networkidle", timeout: 25000 });
    
    let allPosts = new Map();

    const collectPosts = async () => {
      const items = await page.$$eval("a[href*='/p/'], a[href*='/reel/']", els =>
        els.map(el => {
          const img = el.querySelector("img");
          return {
            url: el.href,
            imgSrc: img ? img.src : null,
            alt: img ? img.alt : null
          };
        })
      );
      for (const item of items) {
        if (!allPosts.has(item.url)) {
          allPosts.set(item.url, item);
        }
      }
    };

    await collectPosts();
    console.log(`Initial posts found: ${allPosts.size}`);

    // Try scrolling down to see if more posts load or if Instagram shows login dialog
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollBy(0, 1500));
      await page.waitForTimeout(2000);
      await collectPosts();
      console.log(`After scroll ${i + 1}: ${allPosts.size} posts`);
      // Check if login dialog popped up
      const loginModal = await page.$('div[role="dialog"]');
      if (loginModal) {
        const text = await loginModal.innerText();
        console.log("Dialog popped up:", text.slice(0, 200).replace(/\n/g, ' '));
        // Check if there is a close button
        const closeBtn = await page.$('div[role="dialog"] svg[aria-label="Cerrar"], div[role="dialog"] button');
        if (closeBtn) {
          console.log("Attempting to dismiss modal...");
          await closeBtn.click().catch(() => {});
        }
      }
    }

    console.log(`\nTotal unique posts collected from profile: ${allPosts.size}`);
    const postsArray = Array.from(allPosts.values());
    console.log("Posts summary:\n", JSON.stringify(postsArray, null, 2));

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await browser.close();
  }
}

main();
