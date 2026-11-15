import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import path from "path";

const raw = JSON.parse(readFileSync("./storage/instagram_raw_posts.json", "utf8"));
mkdirSync("./public/inventory/instagram", { recursive: true });

async function downloadFile(url, destPath) {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36"
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    writeFileSync(destPath, buffer);
    return true;
  } catch (err) {
    console.error(`Failed to download ${url}: ${err.message}`);
    return false;
  }
}

async function testFirst() {
  const p = raw[0];
  console.log("Post 1 URL:", p.url);
  console.log("Post 1 ogImage:", p.ogImage);
  if (p.ogImage) {
    const dest = "./public/inventory/instagram/test-og.jpg";
    const ok = await downloadFile(p.ogImage, dest);
    console.log("Download success:", ok, "File exists:", existsSync(dest));
  }
}

testFirst();
