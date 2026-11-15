import { readFileSync } from "fs";

const raw = JSON.parse(readFileSync("./storage/instagram_raw_posts.json", "utf8"));

raw.forEach((p, idx) => {
  const cap = p.caption || "";
  const firstLine = cap.split("\n").filter(l => l.trim().length > 0)[0] || "";
  console.log(`[${idx + 1}] ${p.url}`);
  console.log(`     First Line: ${firstLine}`);
  const hasVendido = /vendid[oa]|sold|ya se fue|entregad[oa]/i.test(cap);
  const hasReservado = /reservad[oa]/i.test(cap);
  const hasDisponible = /disponible|oportunidad|nuevo ingreso|se vende/i.test(cap);
  const hasConsignacion = /consignaci[oó]n/i.test(cap);
  console.log(`     Keywords: Vendido=${hasVendido}, Reservado=${hasReservado}, Disponible=${hasDisponible}, Consignación=${hasConsignacion}`);
});
