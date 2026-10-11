import type { Dynasty } from "../Politics/Dynasty";
import WorldHistory from "../History/WorldHistory";
import { deriveHouseAssessments, type HouseHistoricalFaction, type HouseHistoryContext, type HouseAssessment } from "./DynastyHouseHistoriography";

// Runtime identity changes on hydration/reset. React may recreate equivalent
// faction/maps: compare factual stamps, rather than rescanning history for that.
const cache = new WeakMap<Dynasty, { revision: number; month: number; stamp: string;
  dependencies: string[]; identityStamp: string; result: HouseAssessment[] }>();
export function getHouseAssessments(dynasty: Dynasty, faction: HouseHistoricalFaction,
  factions: HouseHistoryContext["factions"], worldMonth: number) {
  const stamp = JSON.stringify([dynasty.currentRulerId, dynasty.houseEpochs, dynasty.rulers.map(r =>
    [r.id, r.houseName, r.givenName, r.reignOrdinal, r.accessionYear, r.endYear, r.status, r.relationType, Boolean(r.chronicle)]),
    faction.name, faction.displayName, faction.status, faction.stateFoundedMonth, faction.terminationMonth, faction.extinctionYear, faction.terminationReason, faction.nameHistory]);
  const identityStamp = (ids: string[]) => JSON.stringify(ids.map(id => {
    const f = factions.get(id); return [id, f?.name, f?.displayName, f?.nameHistory];
  }));
  const revision = WorldHistory.getRevision(), previous = cache.get(dynasty);
  if (previous && previous.revision === revision && previous.month === worldMonth && previous.stamp === stamp &&
    previous.identityStamp === identityStamp(previous.dependencies)) return previous.result;
  const events = WorldHistory.getEventsForFaction(faction.name);
  const dependencies = [...new Set(events.flatMap(e => {
    const m = e.metadata ?? {};
    const source = e.type === "faction-merged" ? m.absorbedFactionId ?? e.actorFactionId :
      e.type === "faction-submitted" ? m.submittedFactionId ?? e.actorFactionId : undefined;
    const target = e.type === "faction-merged" ? m.absorbingFactionId ?? e.targetFactionId : m.receivingFactionId ?? e.targetFactionId;
    return source === faction.name && typeof target === "string" ? [target] : [];
  }))];
  const result = deriveHouseAssessments({ dynasty, faction, factions, worldMonth, events });
  cache.set(dynasty, { revision, month: worldMonth, stamp, dependencies, identityStamp: identityStamp(dependencies), result });
  return result;
}
