import type { HistoricalFaction } from "./FactionHistoriography";
import { deriveFactionAssessment } from "./FactionHistoriography";
import FactionLifetimeRecords, { type FactionLifetimeRecord } from "../Simulation/FactionLifetimeRecord";
import type { Ruler, Dynasty } from "../Politics/Dynasty";
import WorldHistory from "../History/WorldHistory";

// Frozen record identity changes on new world/hydration. No save data or duplicate history.
let cache = new WeakMap<FactionLifetimeRecord, ReturnType<typeof deriveFactionAssessment>>();
export function resetFactionAssessmentCache() { cache = new WeakMap(); }
export function getFactionAssessment(faction: HistoricalFaction, factions: ReadonlyMap<string, HistoricalFaction>, dynasty?: Pick<Dynasty, "rulers" | "houseEpochs">, rulersForFaction?: (factionId: string) => readonly Ruler[] | undefined) {
  const lifetime = FactionLifetimeRecords.get(faction.name);
  if (faction.status !== "EXTINCT" || !lifetime?.terminal || !dynasty) return undefined;
  if (!cache.has(lifetime)) {
    // Build only the participating foreign archives, once per derivation, rather
    // than linearly scanning their complete ruler arrays for each battle event.
    const rulerIndexes = new Map<string, Map<string, Ruler>>();
    const resolveRuler = (id: string, factionId: string) => {
      if (!rulerIndexes.has(factionId)) rulerIndexes.set(factionId,
        new Map(rulersForFaction?.(factionId)?.map(r => [r.id, r]) ?? []));
      return rulerIndexes.get(factionId)!.get(id);
    };
    cache.set(lifetime, deriveFactionAssessment({ faction, factions, lifetime,
      totalWorldBlocks: FactionLifetimeRecords.getTotalWorldBlocks(), dynasty, resolveRuler,
      events: WorldHistory.getEventsForFaction(faction.name) }));
  }
  return cache.get(lifetime);
}
