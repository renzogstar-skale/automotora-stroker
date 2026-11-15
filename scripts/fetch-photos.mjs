// Descarga fotos de demostración (Wikimedia Commons, licencias libres) a public/demo. Se ejecuta una vez.
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
const MODELS = ["Toyota RAV4","Toyota Hilux","Toyota Yaris","Hyundai Tucson","Hyundai Accent","Kia Sportage","Kia Rio","Chevrolet Sail","Chevrolet Tracker","Suzuki Swift","Suzuki Vitara","Nissan Navara","Nissan Kicks","Mazda CX-5","Mazda3","Peugeot 2008","Peugeot 208","Volkswagen Tiguan","Subaru Forester","Ford Ranger","MG ZS","Chery Tiggo 7","Mitsubishi L200","Honda CR-V","Jeep Compass","Renault Duster","Honda CB190R"];
const UA = { "User-Agent": "StrokerDemo/1.0 (demo seed)" };
mkdirSync("public/demo", { recursive: true });
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
const manifest = {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (const m of MODELS) {
  if (existsSync(`public/demo/${slug(m)}-1.jpg`)) continue;
  await sleep(7000);
  const q = encodeURIComponent(`${m} filetype:bitmap`);
  const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${q}&gsrnamespace=6&gsrlimit=15&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=960&format=json`;
  try {
    const j = await (await fetch(url, { headers: UA })).json();
    const pages = Object.values(j.query?.pages ?? {}).sort((a, b) => a.index - b.index);
    const ok = pages.filter((p) => { const i = p.imageinfo?.[0]; return i && i.mime === "image/jpeg" && i.width > i.height * 1.15 && !/interior|engine|dashboard|logo|badge|motor|wheel/i.test(p.title); });
    manifest[m] = [];
    for (const p of ok.slice(0, 3)) {
      const file = `public/demo/${slug(m)}-${manifest[m].length + 1}.jpg`;
      if (!existsSync(file)) {
        await sleep(800);
        const r = await fetch(p.imageinfo[0].thumburl, { headers: UA });
        if (!r.ok) continue;
        writeFileSync(file, Buffer.from(await r.arrayBuffer()));
      }
      manifest[m].push(file.replace("public", ""));
    }
    console.log(m, manifest[m].length);
  } catch (e) { console.log(m, "error", e.message); }
}

