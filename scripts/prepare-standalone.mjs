// Next's standalone output omits public/ and .next/static; copy them in so server.js can serve them.
import { cpSync, existsSync } from "node:fs";

const out = ".next/standalone";
if (!existsSync(`${out}/server.js`)) {
  console.error(`${out}/server.js not found — run \`next build\` first.`);
  process.exit(1);
}
cpSync("public", `${out}/public`, { recursive: true });
cpSync(".next/static", `${out}/.next/static`, { recursive: true });
console.log("standalone ready");
