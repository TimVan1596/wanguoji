import { describe, expect, it } from "vitest";
import { validateWorldSave } from "./WorldSaveValidator";
import { createEmptyWorldSaveV12, diffCanonicalWorldSave } from "./WorldSaveSchema";
import { setFixtureLifetimeRecords } from "./testing/FactionLifetimeFixture";
import { FactionLifetimeStore } from "../Simulation/FactionLifetimeRecord";
function fixture() {
  const save = createEmptyWorldSaveV12(); save.world.worldMonth = 100; save.world.clock.worldMonth = 100;
  save.world.map = { widthCells: 10, heightCells: 10, blockSize: 32 };
  save.factions = [{ factionId: "a", displayName: "甲", color: 1, colorHistory: [{ color: 1, startMonth: 0, reason: "FOUNDING" }], factionType: "KINGDOM", status: "ACTIVE",
    firstFoundedMonth: 0, currentActiveSinceMonth: 0, cumulativeActiveMonths: 0, restorationMonths: [], identityStage: "STATE", sovereigntyRank: "KING", sovereigntyHistory: [],
    nameHistory: [], origin: {}, homeGridX: 0, homeGridY: 0 }];
  setFixtureLifetimeRecords(save); return save;
}
describe("WorldSave V12 permanent faction lifetime precheck", () => {
  it("requires permanent records, rejects V11, round-trips exact peaks and includes the canonical diff subsystem", () => {
    const save = fixture(); expect(validateWorldSave(save)).toEqual({ valid: true, errors: [] });
    expect(validateWorldSave({ ...save, saveSchemaVersion: 11 }).errors).toContain("unsupported saveSchemaVersion");
    const loaded = JSON.parse(JSON.stringify(save)); const store = new FactionLifetimeStore(); store.importState(loaded.factionLifetime);
    expect(store.exportState()).toEqual(save.factionLifetime); expect(diffCanonicalWorldSave(save, loaded).matched).toBe(true);
    loaded.factionLifetime.records[0].peakPopulation.value = 20;
    expect(diffCanonicalWorldSave(save, loaded).subsystemCounts.factionLifetime).toBe(1);
    delete loaded.factionLifetime; expect(validateWorldSave(loaded).valid).toBe(false);
  });
  it.each([
    (s: ReturnType<typeof fixture>) => { s.factionLifetime.records[0].factionId = "missing"; },
    (s: ReturnType<typeof fixture>) => { s.factionLifetime.records.push(structuredClone(s.factionLifetime.records[0])); },
    (s: ReturnType<typeof fixture>) => { s.factionLifetime.records = []; },
    (s: ReturnType<typeof fixture>) => { s.factionLifetime.records[0].peakPopulation.value = -1; },
    (s: ReturnType<typeof fixture>) => { s.factionLifetime.records[0].peakPopulation.value = NaN; },
    (s: ReturnType<typeof fixture>) => { s.factionLifetime.records[0].peakPopulation.month = 101; },
    (s: ReturnType<typeof fixture>) => { s.factionLifetime.records[0].peakPopulation.month = 0.5; },
    (s: ReturnType<typeof fixture>) => { s.factionLifetime.records[0].peakTerritoryBlocks.value = 101; },
    (s: ReturnType<typeof fixture>) => { s.factionLifetime.totalWorldBlocks = 99; },
    (s: ReturnType<typeof fixture>) => { s.factionLifetime.records[0].peakPopulation.source = "UNKNOWN" as any; },
    (s: ReturnType<typeof fixture>) => { s.factionLifetime.records[0].terminal = { month: 100, population: 0, territoryBlocks: 0, cityCount: 0 }; },
  ])("rejects malformed permanent evidence (%#)", change => {
    const save = fixture(); change(save); expect(validateWorldSave(save).valid).toBe(false);
  });
  it("checks terminal/frozen months and values, never allowing post-terminal peak growth", () => {
    const save = fixture(); Object.assign(save.factions[0], { status: "EXTINCT", terminationReason: "EXTINCT", extinctionMonth: 80 });
    setFixtureLifetimeRecords(save); expect(validateWorldSave(save).valid).toBe(true);
    save.factionLifetime.records[0].peakCityCount.month = 81; expect(validateWorldSave(save).valid).toBe(false);
    save.factionLifetime.records[0].peakCityCount.month = 80;
    save.factionLifetime.records[0].terminal!.population = 1; expect(validateWorldSave(save).valid).toBe(false);
    save.factionLifetime.records[0].terminal!.population = 0;
    save.factionLifetime.records[0].terminal!.month = 79; expect(validateWorldSave(save).valid).toBe(false);
  });
});
