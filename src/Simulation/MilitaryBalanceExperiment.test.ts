import {expect,it} from "vitest";
import {createRequire} from "node:module";
import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
const require=createRequire(import.meta.url);
const {patchMilitaryRegistry}=require("../../scripts/testing/prepare-military-balance.cjs");
it("keeps experimental source isolated and preserves promotion rules, RNG calls, and production capacity",()=>{
  const live=readFileSync(new URL("../Politics/MilitaryCommandRegistry.ts",import.meta.url),"utf8");
  // The withdrawn 2/4/6 experiment belongs to its recorded 12-body baseline.
  const source=execFileSync('git',['show','45268ea1a8496413c86a1d80a84200588a66d9f8:src/Politics/MilitaryCommandRegistry.ts'],{encoding:'utf8'}),candidate=patchMilitaryRegistry(source);
  expect(live).toContain("MAX_FORMATION_UNITS = 4");
  expect(source).toContain("MAX_FORMATION_UNITS = 12");expect(source).not.toContain("replenishOfficeFormations");
  expect(candidate).toContain(".slice(0, 2)");expect(candidate).toContain('office==="SHANGJIANGJUN"?6:office==="JIANGJUN"?4:2');
  expect(candidate.match(/worldRandom.next\(\)/g)?.length).toBe(source.match(/worldRandom.next\(\)/g)?.length);
  expect(()=>patchMilitaryRegistry("a different baseline")).toThrow("Baseline changed");
  expect(readFileSync(new URL("../Politics/MilitaryCommandRegistry.ts",import.meta.url),"utf8")).toBe(live);
});
