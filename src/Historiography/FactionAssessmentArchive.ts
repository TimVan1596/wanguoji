import type { HistoricalFaction } from "./FactionHistoriography";
import { deriveFactionAssessment } from "./FactionHistoriography";
import FactionLifetimeRecords, { type FactionLifetimeRecord } from "../Simulation/FactionLifetimeRecord";
import type { Dynasty } from "../Politics/Dynasty";
import WorldHistory from "../History/WorldHistory";

// Frozen record identity changes on new world/hydration. No save data or duplicate history.
let cache = new WeakMap<FactionLifetimeRecord, ReturnType<typeof deriveFactionAssessment>>();
export function resetFactionAssessmentCache() { cache = new WeakMap(); }
export function getFactionAssessment(faction: HistoricalFaction, factions: ReadonlyMap<string, HistoricalFaction>, dynasty?: Pick<Dynasty, "rulers" | "houseEpochs">) {
  const lifetime = FactionLifetimeRecords.get(faction.name);
  if (faction.status !== "EXTINCT" || !lifetime?.terminal || !dynasty) return undefined;
  if (!cache.has(lifetime)) cache.set(lifetime, deriveFactionAssessment({ faction, factions, lifetime,
    totalWorldBlocks: FactionLifetimeRecords.getTotalWorldBlocks(), dynasty,
    events: WorldHistory.getEventsForFaction(faction.name) }));
  return cache.get(lifetime);
}
