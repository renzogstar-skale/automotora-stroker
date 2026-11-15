import { readFileSync } from "fs";

const raw = JSON.parse(readFileSync("./storage/instagram_raw_posts.json", "utf8"));

for (let i = 3; i < 12; i++) {
  const p = raw[i];
  console.log(`=== [${i + 1}] URL: ${p.url} ===`);
  console.log(`OG Title: ${p.ogTitle}`);
  console.log(`Caption:\n${p.caption}\n`);
}
