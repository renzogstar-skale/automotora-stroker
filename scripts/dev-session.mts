// Crea una sesión para pruebas locales: npx tsx scripts/dev-session.ts correo@stroker.demo
import { db } from "../src/lib/db";
import { randomToken, sha256 } from "../src/lib/crypto";
const email = process.argv[2] ?? "dueno@stroker.demo";
const u = await db.user.findUniqueOrThrow({ where: { email } });
const t = randomToken();
await db.session.create({ data: { userId: u.id, tokenHash: sha256(t), expiresAt: new Date(Date.now() + 864e5) } });
console.log(t);
await db.$disconnect();
