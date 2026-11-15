import { readFileSync } from "fs";

const raw = JSON.parse(readFileSync("./storage/instagram_raw_posts.json", "utf8"));
console.log("=== POST 10 ===");
console.log(raw[9].caption);
