import type { WorldSaveV12 } from "../WorldSaveSchema";
/** Explicit V12 observations for persistence fixtures; never used by production validation/hydration. */
export function setFixtureLifetimeRecords(save: WorldSaveV12) {
  if (!save.world.map.widthCells && save.blocks.length) save.world.map.widthCells = Math.max(...save.blocks.map(b => b.gridX)) + 1;
  if (!save.world.map.heightCells && save.blocks.length) save.world.map.heightCells = Math.max(...save.blocks.map(b => b.gridY)) + 1;
  const peak = (value: number, month: number) => ({ value, month, source: "MONTHLY" as const });
  save.factionLifetime = { totalWorldBlocks: save.world.map.widthCells * save.world.map.heightCells,
    records: save.factions.map(f => {
      const month = f.status === "EXTINCT" ? f.terminationMonth ?? f.extinctionMonth! : save.world.worldMonth;
      const population = save.users.filter(u => u.factionId === f.factionId).length;
      const territoryBlocks = save.blocks.filter(b => b.ownerFactionId === f.factionId).length;
      const cityCount = save.cities.filter(c => c.ownerFactionId === f.factionId).length;
      return { factionId: f.factionId, lastObservedMonth: month, peakPopulation: peak(population, month),
        peakTerritoryBlocks: peak(territoryBlocks, month), peakCityCount: peak(cityCount, month),
        ...(f.status === "EXTINCT" ? { terminal: { month, population, territoryBlocks, cityCount } } : {}) };
    }) };
}
