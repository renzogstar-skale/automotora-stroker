import { readFileSync } from "fs";

const raw = JSON.parse(readFileSync("./storage/instagram_raw_posts.json", "utf8"));
for (let i of [5, 6, 7, 8]) {
  console.log(`=== POST ${i + 1} ===`);
  console.log(raw[i].caption.slice(0, 400));
}
