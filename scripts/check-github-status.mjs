import https from "node:https";

const options = {
  hostname: "api.github.com",
  path: "/repos/renzogstar-skale/automotora-stroker/commits/fca499a/check-runs",
  headers: { "User-Agent": "NodeJS" },
};

https.get(options, (res) => {
  let data = "";
  res.on("data", (chunk) => (data += chunk));
  res.on("end", () => {
    try {
      const parsed = JSON.parse(data);
      console.log("Check runs count:", parsed.total_count);
      parsed.check_runs?.forEach((c) => {
        console.log("-", c.name, ":", c.status, c.conclusion);
      });
    } catch (e) {
      console.log("Response:", data);
    }
  });
});
