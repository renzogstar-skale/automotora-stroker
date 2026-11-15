import { readFileSync } from "fs";

const raw = JSON.parse(readFileSync("./storage/instagram_raw_posts.json", "utf8"));

console.log(`Analyzing ${raw.length} raw scraped publications:\n`);

raw.forEach((p, idx) => {
  console.log(`=== [${idx + 1}] URL: ${p.url} ===`);
  console.log(`OG Title: ${p.ogTitle}`);
  console.log(`Caption preview:\n${p.caption.slice(0, 300)}...`);
  console.log(`OG Image: ${p.ogImage ? "YES" : "NO"} | OG Video: ${p.ogVideo ? "YES" : "NO"}`);
  console.log("------------------------------------------------------------------------\n");
});
