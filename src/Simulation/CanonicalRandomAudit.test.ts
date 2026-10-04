import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = join(process.cwd(), "src");
const presentationOrSetupAllowlist = new Set([
  "Scenarios/index.ts", // User-directed random setup action; the resulting scenario is part of the initial configuration.
  "Live/Douyu/douyu-live-ws/ws.ts",
]);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts") && !name.endsWith(".test.tsx") ? [path] : [];
  });
}

describe("canonical randomness audit", () => {
  it("keeps unseeded random APIs out of canonical source paths", () => {
    const violations = sourceFiles(sourceRoot).flatMap((file) => {
      const relativePath = relative(sourceRoot, file).replaceAll("\\", "/");
      if (presentationOrSetupAllowlist.has(relativePath) || relativePath === "Simulation/WorldRandom.ts") return [];
      const contents = readFileSync(file, "utf8");
      return /Math\.random\s*\(|Phaser\.Math\.Between\s*\(|Phaser\.Math\.RND|GetRandom\s*\(/.test(contents)
        ? [`${relativePath} contains an unseeded random API`]
        : [];
    });
    expect(violations).toEqual([]);
  });
});
