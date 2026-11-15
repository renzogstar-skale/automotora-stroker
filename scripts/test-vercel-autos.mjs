import https from "node:https";

https.get("https://stroker-kappa.vercel.app/autos", (res) => {
  let data = "";
  res.on("data", (chunk) => (data += chunk));
  res.on("end", () => {
    console.log("Status /autos:", res.statusCode);
    const cars = [...data.matchAll(/class="font-semibold[^"]*"[^>]*>([^<]+)/g)].map((m) => m[1]);
    console.log("Cars found in /autos:", cars);
  });
});
