import { readFileSync } from "fs";

const raw = JSON.parse(readFileSync("./storage/instagram_raw_posts.json", "utf8"));
raw.forEach((p, idx) => {
  console.log(`[${idx + 1}] ${p.url}:`);
  console.log(`  ogImage: ${p.ogImage ? "YES" : "NO"}`);
  console.log(`  pageImages count: ${p.pageImages?.length || 0}`);
  if (p.pageImages?.length) {
    p.pageImages.slice(0, 3).forEach((img, i) => console.log(`    img ${i + 1}: ${img.src?.slice(0, 80)}... [${img.width}x${img.height}]`));
  }
});
