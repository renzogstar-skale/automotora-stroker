import https from "node:https";

https.get("https://stroker-kappa.vercel.app/", (res) => {
  let data = "";
  res.on("data", (chunk) => (data += chunk));
  res.on("end", () => {
    const titleMatch = data.match(/<title>([^<]+)<\/title>/);
    console.log("Title:", titleMatch?.[1]);
    const brands = [...data.matchAll(/data-brand="([^"]+)"/g)].map((m) => m[1]);
    console.log("Brands found in page:", Array.from(new Set(brands)));
    const cards = [...data.matchAll(/<h3>([^<]+)<\/h3>/gi)].map((m) => m[1]);
    console.log("Headings (h3):", cards.slice(0, 10));
    const isSaveiro = data.includes("Saveiro");
    const isPanamera = data.includes("Panamera");
    console.log("Contains Saveiro:", isSaveiro, "Contains Panamera:", isPanamera);
  });
});
