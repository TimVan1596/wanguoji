import { describe, expect, it, vi } from "vitest";
import { FactionLifetimeStore, getLifetimeAbsoluteWorldShare } from "./FactionLifetimeRecord";
import FactionSnapshots from "./FactionSnapshots";
import { calculateTerritoryMetrics } from "./TerritoryMetrics";
import worldRandom from "./WorldRandom";
const team = (name = "initial") => ({ name, status: "ACTIVE", users: { size: 10 }, cities: [{ loyalty: 80 }], blocks: { children: { size: 3 } } });
describe("permanent faction lifetime observations", () => {
  it("creates separate initial/rebel records and never resets them on founding or restoration", () => {
    const store = new FactionLifetimeStore(); const a = team(); store.observeWorld(0, [a], 100);
    const rebel = team("rebel"); store.observeWorld(100, [a, rebel], 100);
    expect(store.get("initial")!.peakPopulation.month).toBe(0); expect(store.get("rebel")!.peakPopulation.month).toBe(100);
    a.users.size = 2; a.status = "EXILED"; store.observeWorld(120, [a, rebel], 100);
    a.status = "ACTIVE"; store.observeWorld(140, [a, rebel], 100);
    expect(store.get(a.name)!.peakPopulation).toEqual({ value: 10, month: 0, source: "MONTHLY" });
    expect(store.get(a.name)!.terminal).toBeUndefined();
  });
  it("retains independent dates and earliest equal peaks", () => {
    const store = new FactionLifetimeStore(), a = team(); store.observeWorld(0, [a], 100);
    a.users.size = 20; store.observeWorld(1, [a], 100);
    a.blocks.children.size = 8; store.observeWorld(2, [a], 100);
    a.cities.push({ loyalty: 80 }); store.observeWorld(3, [a], 100); store.observeWorld(4, [a], 100);
    expect(store.get(a.name)).toMatchObject({ peakPopulation: { value: 20, month: 1 }, peakTerritoryBlocks: { value: 8, month: 2 }, peakCityCount: { value: 2, month: 3 } });
  });
  it("survives 5000 years and the snapshot's 500-entry rolling window without a map/history scan", () => {
    const store = new FactionLifetimeStore(), a = team(); a.users.size = 99;
    Object.defineProperty(a.blocks.children, "entries", { get: () => { throw new Error("must not scan cells"); } });
    store.observeWorld(0, [a], 100); FactionSnapshots.reset(); FactionSnapshots.observe(0, [a] as any, 100);
    a.users.size = 2;
    for (let month = 1; month <= 60000; month++) {
      store.observeWorld(month, [a], 100); FactionSnapshots.observe(month, [a] as any, 100);
    }
    expect(FactionSnapshots.get(a.name)).toHaveLength(500);
    expect(FactionSnapshots.get(a.name).every(s => s.population === 2)).toBe(true);
    expect(store.get(a.name)!.peakPopulation).toMatchObject({ value: 99, month: 0 });
    expect(store.exportState().records).toHaveLength(1);
  });
  it("distinguishes a fraction of .318 from TerritoryMetrics' 31.8 percent", () => {
    const store = new FactionLifetimeStore(), a = team(); a.blocks.children.size = 318;
    store.observeWorld(0, [a], 1000);
    expect(getLifetimeAbsoluteWorldShare(store.get(a.name)!, 1000)).toBe(0.318);
    expect(calculateTerritoryMetrics([a] as any, 1000).byFactionId.get(a.name)!.absoluteWorldShare).toBe(31.8);
    FactionSnapshots.reset(); FactionSnapshots.observe(0, [a] as any, 1000);
    expect(FactionSnapshots.get(a.name)[0].absoluteTerritoryShare).toBe(0.318);
  });
  it.each(["EXTINCT", "MERGED", "SUBMITTED"])("captures %s before transfer, freezes once and restores exactly", () => {
    const store = new FactionLifetimeStore(), a = team(); store.observeWorld(0, [a], 100);
    a.users.size = 25; a.blocks.children.size = 10; store.prepareTerminal(a, 20);
    a.users.size = 0; a.blocks.children.size = 0; a.cities = []; a.status = "EXTINCT";
    store.freeze(a, 20); const frozen = store.get(a.name); store.freeze(a, 20); store.observeWorld(30, [a], 100);
    expect(store.get(a.name)).toBe(frozen); expect(frozen!.terminal).toEqual({ month: 20, population: 25, territoryBlocks: 10, cityCount: 1 });
    expect(frozen!.peakPopulation).toMatchObject({ value: 25, month: 20, source: "PRE_TERMINAL" });
    const restored = new FactionLifetimeStore(); restored.importState(store.exportState());
    expect(restored.exportState()).toEqual(store.exportState());
    restored.reset(100); expect(restored.exportState().records).toEqual([]);
  });
  it("is independent of debug, leaves RNG untouched and only reads cardinality", () => {
    const a = team(); const read = vi.fn(() => 4); Object.defineProperty(a.blocks.children, "size", { get: read });
    const rng = worldRandom.exportState();
    const run = () => { const store = new FactionLifetimeStore(); for (let month = 0; month < 120; month++) store.observeWorld(month, [a], 100); return store.exportState(); };
    expect(run()).toEqual(run()); expect(read).toHaveBeenCalledTimes(240);
    expect(worldRandom.exportState()).toEqual(rng);
  });
});
