import fs from "node:fs";
import path from "node:path";

const assetsDir = path.resolve("dist/assets");
const jsFiles = fs.readdirSync(assetsDir).filter((file) => file.endsWith(".js"));
const maps = new Set(fs.readdirSync(assetsDir).filter((file) => file.endsWith(".js.map")));
const missing = jsFiles.filter((file) => !maps.has(`${file}.map`));
if (jsFiles.length === 0 || missing.length > 0) {
  throw new Error(`Desktop debug build must emit source maps. JS=${jsFiles.length}; missing maps=${missing.join(", ") || "none"}`);
}
for (const file of maps) {
  const map = JSON.parse(fs.readFileSync(path.join(assetsDir, file), "utf8"));
  if (!Array.isArray(map.sources) || map.sources.length === 0) throw new Error(`Empty source map: ${file}`);
}
console.info(`[Wanguoji] verified ${maps.size} desktop debug source maps`);
