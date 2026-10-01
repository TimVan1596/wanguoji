import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const distDirectory = path.resolve(scriptDirectory, "../dist");
const htmlPath = path.join(distDirectory, "index.html");

if (!existsSync(htmlPath)) {
  throw new Error(`Desktop renderer build is missing: ${htmlPath}`);
}

const html = readFileSync(htmlPath, "utf8");
const assetUrls = [...html.matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)=["']([^"']+)["'][^>]*>/gi)]
  .map((match) => match[1]);
const localUrls = assetUrls.filter((url) => !/^(?:[a-z]+:|\/\/|#)/i.test(url));
const rootAbsoluteAssets = assetUrls.filter((url) => /^\/(?:assets|favicon)/i.test(url));
if (rootAbsoluteAssets.length) {
  throw new Error(`Desktop renderer contains root-absolute assets: ${rootAbsoluteAssets.join(", ")}`);
}

const javascript = localUrls.filter((url) => /\.js(?:[?#].*)?$/i.test(url));
const stylesheets = localUrls.filter((url) => /\.css(?:[?#].*)?$/i.test(url));
if (!javascript.length || !stylesheets.length) {
  throw new Error("Desktop renderer HTML must reference a local JavaScript bundle and stylesheet.");
}

for (const url of localUrls) {
  const relativePath = decodeURIComponent(url.split(/[?#]/, 1)[0]);
  if (!existsSync(path.resolve(distDirectory, relativePath))) {
    throw new Error(`Desktop renderer asset does not exist: ${url}`);
  }
}

console.log(`[Wanguoji Desktop] renderer assets verified: ${javascript.length} JS, ${stylesheets.length} CSS`);
