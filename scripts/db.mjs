// Postgres local embebido para desarrollo (sin Docker). Uso: npm run db
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";

const dir = "./.pgdata";
const pg = new EmbeddedPostgres({
  databaseDir: dir, user: "stroker", password: "stroker", port: 5433, persistent: true,
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
});
if (!existsSync(dir)) await pg.initialise();
await pg.start();
try { await pg.createDatabase("stroker"); } catch { /* ya existe */ }
console.log("Postgres listo en postgresql://stroker:stroker@localhost:5433/stroker");
const stop = async () => { await pg.stop(); process.exit(0); };
process.on("SIGINT", stop); process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);
