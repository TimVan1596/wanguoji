import { readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

const source = resolve(process.cwd(), "public/music");
const output = resolve(process.cwd(), "dist/music");
const fileNames = (directory) => readdirSync(directory)
  .filter((name) => statSync(resolve(directory, name)).isFile())
  .sort();

const sourceFiles = fileNames(source);
const outputFiles = fileNames(output);
if (sourceFiles.join("\n") !== outputFiles.join("\n")) {
  throw new Error(`Music build assets differ from public/music. Source=[${sourceFiles.join(", ")}], dist=[${outputFiles.join(", ")}]`);
}

console.log(`[Wanguoji] music assets verified: ${outputFiles.length} bundled files`);
