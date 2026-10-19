import {expect,it} from "vitest";
import {createRequire} from "node:module";
import {readFileSync} from "node:fs";
const require=createRequire(import.meta.url);
const {patchMilitaryRegistry}=require("../../scripts/testing/prepare-military-balance.cjs");
it("keeps experimental source isolated and preserves promotion rules, RNG calls, and production capacity",()=>{
  const source=readFileSync(new URL("../Politics/MilitaryCommandRegistry.ts",import.meta.url),"utf8"),candidate=patchMilitaryRegistry(source);
  expect(source).toContain("MAX_FORMATION_UNITS = 12");expect(source).not.toContain("replenishOfficeFormations");
  expect(candidate).toContain(".slice(0, 2)");expect(candidate).toContain('office==="SHANGJIANGJUN"?6:office==="JIANGJUN"?4:2');
  expect(candidate.match(/worldRandom.next\(\)/g)?.length).toBe(source.match(/worldRandom.next\(\)/g)?.length);
  expect(()=>patchMilitaryRegistry("a different baseline")).toThrow("Baseline changed");
  expect(readFileSync(new URL("../Politics/MilitaryCommandRegistry.ts",import.meta.url),"utf8")).toBe(source);
});
