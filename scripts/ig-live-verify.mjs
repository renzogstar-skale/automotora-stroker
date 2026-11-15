// Re-verifica en vivo (sin login) cada publicación registrada y la cobertura del perfil @automotora_stroker.
// Uso: node scripts/ig-live-verify.mjs  → escribe storage/ig-live-verify.json
import { chromium } from "playwright-core";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

const posts = JSON.parse(readFileSync("prisma/seed/instagram-posts.json", "utf8"));
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const ctx = await b.newContext({ locale: "es-CL", viewport: { width: 1280, height: 900 } });
const out = { checkedAt: new Date().toISOString(), profile: {}, posts: [], errors: [] };

// 1. Perfil: total de publicaciones y shortcodes visibles en la grilla
const p = await ctx.newPage();
try {
  await p.goto("https://www.instagram.com/automotora_stroker/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForTimeout(6000);
  for (let i = 0; i < 8; i++) { await p.mouse.wheel(0, 4000); await p.waitForTimeout(1500); }
  out.profile = await p.evaluate(() => ({
    desc: document.querySelector('meta[property="og:description"]')?.content,
    loginWall: !!document.querySelector('input[name="username"]') || /accounts\/login/.test(location.href),
    shortcodes: [...new Set([...document.querySelectorAll('a[href*="/p/"],a[href*="/reel/"]')].map((a) => a.getAttribute("href").match(/\/(?:p|reel)\/([^/]+)/)?.[1]).filter(Boolean))],
  }));
} catch (e) { out.errors.push({ where: "profile", error: String(e) }); }
await p.close();

// 2. Cada publicación: descripción vigente + imagen de portada
mkdirSync("public/inventory/stroker/ig", { recursive: true });
for (const post of posts) {
  const sc = post.url.match(/\/(?:p|reel)\/([^/]+)/)[1];
  const pg = await ctx.newPage();
  try {
    await pg.goto(post.url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await pg.waitForTimeout(3500);
    const m = await pg.evaluate(() => ({
      title: document.querySelector('meta[property="og:title"]')?.content || "",
      desc: document.querySelector('meta[property="og:description"]')?.content || "",
      img: document.querySelector('meta[property="og:image"]')?.content || "",
    }));
    const caption = (m.title.match(/en Instagram: "([\s\S]*)"$/) || [])[1] || "";
    const date = (m.desc.match(/ el ([A-Za-z]+ \d+, \d{4})/) || [])[1] || null;
    const flags = { vendido: /vendid/i.test(caption), reservado: /reservad/i.test(caption) };
    let cover = null;
    const file = `public/inventory/stroker/ig/${sc}.jpg`;
    if (m.img) {
      const r = await ctx.request.get(m.img);
      if (r.ok()) { writeFileSync(file, await r.body()); cover = `/inventory/stroker/ig/${sc}.jpg`; }
    } else if (existsSync(file)) cover = `/inventory/stroker/ig/${sc}.jpg`;
    const changed = caption.trim() && post.caption && caption.trim().slice(0, 200) !== post.caption.trim().slice(0, 200);
    out.posts.push({ sc, url: post.url, date, ok: !!m.title, captionLen: caption.length, captionChanged: !!changed, flags, cover, head: caption.slice(0, 90) });
  } catch (e) { out.errors.push({ where: sc, error: String(e) }); }
  await pg.close();
}
await b.close();
writeFileSync("storage/ig-live-verify.json", JSON.stringify(out, null, 2));
console.log("perfil:", out.profile.desc, "| grilla visible:", out.profile.shortcodes?.length, "| loginWall:", out.profile.loginWall);
const known = new Set(posts.map((x) => x.url.match(/\/(?:p|reel)\/([^/]+)/)[1]));
console.log("en grilla y NO registrados:", (out.profile.shortcodes || []).filter((s) => !known.has(s)));
for (const x of out.posts) console.log(x.sc, x.date, x.ok ? "OK" : "FAIL", x.flags.vendido ? "VENDIDO" : "", x.flags.reservado ? "RESERVADO" : "", x.captionChanged ? "CAPTION-CAMBIÓ" : "", x.cover ? "img" : "sin-img");
console.log("errores:", out.errors.length, out.errors);
