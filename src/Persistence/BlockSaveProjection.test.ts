import { describe, expect, it } from "vitest";
import { canonicalBlockHitPoints } from "../Components/BlockHitPoints";
import { createEmptyWorldSaveV1, diffCanonicalWorldSave } from "./WorldSaveSchema";
import { validateWorldSave } from "./WorldSaveValidator";
import { createBlockSaveProjection } from "./BlockSaveProjection";

describe("canonical Block HP authority", () => {
  it("uses city defense for center and fortified cells, and preserves standalone block HP", () => {
    const city = { id: "city-qin-1", defense: 7 };
    const runtimeBlocks = [
      { hp: 6, city, isHome: true, isCityCenter: true, team: { name: "qin" } },
      { hp: 2, city, isHome: true, isCityCenter: false, team: { name: "qin" } },
      { hp: 0, isHome: false, isCityCenter: false, team: { name: "qin" } },
      { hp: 3, isHome: true, isCityCenter: false, team: { name: "qin" } },
      { hp: 0, isHome: false, isCityCenter: false },
    ];

    const saved = runtimeBlocks.map((block, index) => createBlockSaveProjection(block, index, 0));
    expect(saved.map((block) => block.homeHitPoints)).toEqual([7, 7, 0, 3, 0]);
    expect(saved.map((block) => block.cityId)).toEqual(["city-qin-1", "city-qin-1", undefined, undefined, undefined]);
  });

  it("survives export projection → JSON → hydration HP normalization → immediate export projection", () => {
    const city = { id: "city-qin-1", defense: 7 };
    const runtimeBlocks = [
      { hp: 6, city, isHome: true, isCityCenter: true, team: { name: "qin" } },
      { hp: 1, city, isHome: true, isCityCenter: false, team: { name: "qin" } },
      { hp: 3, isHome: true, isCityCenter: false, team: { name: "qin" } },
    ];
    const first = runtimeBlocks.map((block, index) => createBlockSaveProjection(block, index, 0));
    const parsed = JSON.parse(JSON.stringify(first)) as typeof first;
    const restoredRuntime = parsed.map((block) => ({
      ...block,
      hp: canonicalBlockHitPoints(block.homeHitPoints, block.cityId ? city.defense : undefined),
      city: block.cityId ? city : undefined,
      team: block.ownerFactionId ? { name: block.ownerFactionId } : undefined,
    }));
    const second = restoredRuntime.map((block, index) => createBlockSaveProjection(block, index, 0));

    expect(second).toEqual(parsed);
    expect(first[0].homeHitPoints).toBe(7); // Stale runtime projection was not persisted as truth.
    expect(second[0].homeHitPoints).toBe(7);
    expect(second[1].homeHitPoints).toBe(7);
    expect(second[2].homeHitPoints).toBe(3);
  });

  it("round-trips city and non-city HP inside a WorldSaveV1 DTO canonically", () => {
    const save = createEmptyWorldSaveV1();
    save.factions = [{
      factionId: "qin", displayName: "秦", color: 1, colorHistory: [{ color: 1, startMonth: 0, reason: "FOUNDING" }], factionType: "KINGDOM", status: "ACTIVE",
      firstFoundedMonth: 0, currentActiveSinceMonth: 0, restorationMonths: [], cumulativeActiveMonths: 0,
      identityStage: "STATE", sovereigntyRank: "KING", sovereigntyHistory: [], nameHistory: [],
      origin: {}, homeGridX: 0, homeGridY: 0,
    }];
    save.cities = [{
      cityId: "city-qin-1", name: "咸阳", founderFactionId: "qin", ownerFactionId: "qin",
      centerGridX: 0, centerGridY: 0, foundedMonth: 0, isCapital: true,
      defense: 7, maxDefense: 10, loyalty: 80, devastation: 0, captureCount: 0,
    }];
    save.blocks = [
      createBlockSaveProjection({ hp: 6, city: { id: "city-qin-1", defense: 7 }, isHome: true, isCityCenter: true, team: { name: "qin" } }, 0, 0),
      createBlockSaveProjection({ hp: 1, city: { id: "city-qin-1", defense: 7 }, isHome: true, isCityCenter: false, team: { name: "qin" } }, 1, 0),
      createBlockSaveProjection({ hp: 3, isHome: true, isCityCenter: false, team: { name: "qin" } }, 2, 0),
    ];
    const parsed = JSON.parse(JSON.stringify(save)) as typeof save;
    expect(validateWorldSave(parsed)).toEqual({ valid: true, errors: [] });
    const cityById = new Map(parsed.cities.map((city) => [city.cityId, city]));
    const hydratedExport = {
      ...parsed,
      blocks: parsed.blocks.map((block) => {
        const city = block.cityId ? cityById.get(block.cityId) : undefined;
        const runtimeBlock = {
          ...block,
          hp: canonicalBlockHitPoints(block.homeHitPoints, city?.defense),
          city: city ? { id: city.cityId, defense: city.defense } : undefined,
          team: block.ownerFactionId ? { name: block.ownerFactionId } : undefined,
          isCityCenter: Boolean(block.isCityCenter),
        };
        return createBlockSaveProjection(runtimeBlock, block.gridX, block.gridY);
      }),
    };
    const immediateExport = JSON.parse(JSON.stringify(hydratedExport)) as typeof parsed;

    expect(validateWorldSave(immediateExport)).toEqual({ valid: true, errors: [] });
    const diff = diffCanonicalWorldSave(parsed, immediateExport);
    expect(diff).toMatchObject({ matched: true, differenceCount: 0 });
  });
});
