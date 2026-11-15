import https from "node:https";

function fetchApp() {
  return new Promise((resolve) => {
    https.get("https://stroker-kappa.vercel.app/", (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        const hasSaveiro = data.includes("Saveiro");
        const hasPanamera = data.includes("Panamera");
        const hasSilverado = data.includes("Silverado");
        const hasStrokerStock = data.includes("STK-");
        resolve({
          status: res.statusCode,
          hasSaveiro,
          hasPanamera,
          hasSilverado,
          hasStrokerStock,
        });
      });
    }).on("error", () => resolve({ error: true }));
  });
}

async function main() {
  console.log("Esperando despliegue de Vercel en https://stroker-kappa.vercel.app/...");
  for (let i = 1; i <= 24; i++) {
    const res = await fetchApp();
    console.log(`Intento ${i} (después de ${i * 5}s):`, res);
    if (res.hasSaveiro || res.hasPanamera || res.hasSilverado) {
      console.log("¡DESPLIEGUE EN VERCEL COMPLETADO Y CONFIRMADO!");
      process.exit(0);
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  console.log("Tiempo de espera agotado.");
  process.exit(1);
}

main();
