// Auditoría pública con Playwright: rutas × viewports → consola, requests fallidos, imágenes rotas,
// scroll horizontal, contenido sensible y capturas. Uso: node scripts/audit-public.mjs [base] [etiqueta]
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.argv[2] || "http://localhost:3100";
const TAG = process.argv[3] || "antes";
const OUT = `./test-results/audit/${TAG}`;
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = { desktop: [1440, 900], tablet: [768, 1024], iphone: [390, 844], android: [360, 800] };
const SENSITIVE = [/Stroker2026!/, /@stroker\.demo/, /Santiago y Viña/i, /120 puntos/i, /certificada/i, /3 meses en motor/i, /Seminuevo Garantizado/i];

const browser = await chromium.launch({ executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", headless: true });

// Descubre una ficha real desde el catálogo.
const probe = await browser.newPage();
await probe.goto(`${BASE}/autos`, { waitUntil: "domcontentloaded" });
const slug = await probe.$eval('a[href^="/autos/"]', (a) => a.getAttribute("href")).catch(() => null);
await probe.close();

const ROUTES = ["/", "/autos", slug, "/autos/no-existe-xyz", "/consignar", "/login", "/recuperar", "/panel", "/ruta-inexistente"].filter(Boolean);
const findings = [];

for (const [vp, [width, height]] of Object.entries(VIEWPORTS)) {
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: width < 768, hasTouch: width < 768 });
  for (const route of ROUTES) {
    const page = await ctx.newPage();
    const issues = [];
    page.on("console", (m) => { if (m.type() === "error") issues.push({ type: "console", msg: m.text().slice(0, 300) }); });
    page.on("pageerror", (e) => issues.push({ type: "pageerror", msg: e.message.slice(0, 300) }));
    page.on("response", (r) => { if (r.status() >= 400 && !r.url().includes("/_next/webpack-hmr")) issues.push({ type: "http", msg: `${r.status()} ${r.url()}` }); });
    page.on("requestfailed", (r) => { if (!/_rsc|webpack-hmr/.test(r.url())) issues.push({ type: "reqfailed", msg: `${r.failure()?.errorText} ${r.url()}` }); });
    const res = await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 90_000 }).catch((e) => { issues.push({ type: "nav", msg: e.message }); return null; });
    await page.waitForTimeout(400);
    const dom = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      brokenImgs: [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.currentSrc || i.src),
      smallTargets: [...document.querySelectorAll("a,button,[role=button],select,input")].filter((el) => {
        const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.height < 32 || r.width < 32) && getComputedStyle(el).visibility !== "hidden";
      }).length,
      noAlt: [...document.images].filter((i) => !i.hasAttribute("alt")).length,
      h1: document.querySelectorAll("h1").length,
      text: document.body.innerText,
    }));
    if (dom.overflow > 1) issues.push({ type: "overflow", msg: `scroll horizontal ${dom.overflow}px` });
    for (const src of dom.brokenImgs) issues.push({ type: "img", msg: `imagen rota ${src}` });
    if (dom.noAlt) issues.push({ type: "a11y", msg: `${dom.noAlt} imágenes sin alt` });
    if (dom.h1 !== 1) issues.push({ type: "a11y", msg: `${dom.h1} elementos h1` });
    if (width < 768 && dom.smallTargets) issues.push({ type: "touch", msg: `${dom.smallTargets} controles < 32px` });
    for (const re of SENSITIVE) if (re.test(dom.text)) issues.push({ type: "contenido", msg: `texto sensible/no verificado: ${re}` });
    const name = `${vp}_${route.replace(/[^a-z0-9]+/gi, "_") || "home"}`;
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: vp === "desktop" || vp === "iphone" }).catch(() => {});
    findings.push({ viewport: vp, route, status: res?.status() ?? null, finalUrl: page.url().replace(BASE, ""), issues });
    await page.close();
  }
  await ctx.close();
}
await browser.close();

writeFileSync(`${OUT}/report.json`, JSON.stringify(findings, null, 2));
const total = findings.reduce((n, f) => n + f.issues.length, 0);
for (const f of findings) {
  console.log(`[${f.viewport}] ${f.route} → ${f.status} ${f.finalUrl !== f.route ? `(${f.finalUrl})` : ""}`);
  for (const i of [...new Map(f.issues.map((i) => [i.type + i.msg, i])).values()]) console.log(`   - ${i.type}: ${i.msg}`);
}
console.log(`\nTotal hallazgos: ${total} · capturas en ${OUT}`);
