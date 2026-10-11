import type { Dynasty, Ruler } from "../Politics/Dynasty";
import type { HistoricalFaction } from "./FactionHistoriography";
import type { HouseAssessment } from "./DynastyHouseHistoriography";
import WorldHistory from "../History/WorldHistory";
import FactionLifetimeRecords from "../Simulation/FactionLifetimeRecord";
import { buildUnifiedFactionChronicle, type UnifiedChronicle } from "./UnifiedFactionChronicle";
// One final derived article per live dynasty, not another persistent history.
const cache = new WeakMap<Dynasty, { stamp: string; phases: readonly HouseAssessment[]; dependencies: string[]; identities: string; result: UnifiedChronicle }>();
export function getUnifiedFactionChronicle(dynasty: Dynasty, faction: HistoricalFaction,
  factions: ReadonlyMap<string, HistoricalFaction>, worldMonth: number, phases: readonly HouseAssessment[],
  rulersForFaction?: (id: string) => readonly Ruler[] | undefined) {
  const lifetime = FactionLifetimeRecords.get(faction.name);
  if (!lifetime) return undefined;
  const stamp = JSON.stringify([worldMonth, WorldHistory.getRevision(), lifetime, faction.nameHistory, faction.status,
    faction.terminationTargetFactionId, faction.stateFoundedMonth, faction.firstFoundedYear, faction.origin, faction.restorationYears,
    faction.sovereigntyHistory, dynasty.rulers.map(r => [r.id, r.templeName, r.posthumousEpithet, r.deathMonth, r.deathReason]), FactionLifetimeRecords.getTotalWorldBlocks()]);
  const identityStamp = (ids: readonly string[]) => JSON.stringify(ids.map(id => {
    const f = factions.get(id); return [id, f?.displayName, f?.nameHistory, f?.sovereigntyHistory];
  }));
  const previous = cache.get(dynasty);
  if (previous?.stamp === stamp && previous.phases === phases && previous.identities === identityStamp(previous.dependencies)) return previous.result;
  const events = WorldHistory.getEventsForFaction(faction.name);
  const dependencies = [...new Set(events.flatMap(e => [e.actorFactionId, e.targetFactionId, e.conquerorFactionId]).filter((id): id is string => Boolean(id && id !== faction.name)))];
  if (faction.terminationTargetFactionId && !dependencies.includes(faction.terminationTargetFactionId)) dependencies.push(faction.terminationTargetFactionId);
  const indexes = new Map<string, Map<string, Ruler>>();
  const result = buildUnifiedFactionChronicle({ dynasty, faction, factions, worldMonth, phases, lifetime,
    totalWorldBlocks: FactionLifetimeRecords.getTotalWorldBlocks(), events,
    resolveRuler: (id, factionId) => {
      if (!indexes.has(factionId)) indexes.set(factionId, new Map((rulersForFaction?.(factionId) ?? []).map(r => [r.id, r])));
      return indexes.get(factionId)!.get(id);
    } });
  cache.set(dynasty, { stamp, phases, dependencies, identities: identityStamp(dependencies), result }); return result;
}
