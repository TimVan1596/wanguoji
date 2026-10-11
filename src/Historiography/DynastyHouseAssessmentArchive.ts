import type { Dynasty } from "../Politics/Dynasty";
import WorldHistory from "../History/WorldHistory";
import { deriveHouseAssessments, type HouseHistoricalFaction, type HouseHistoryContext, type HouseAssessment } from "./DynastyHouseHistoriography";

// Runtime identity changes on hydration/reset. One derived entry per live dynasty;
// no duplicate history store or permanent image/archive cache.
const cache = new WeakMap<Dynasty, { faction: HouseHistoricalFaction; revision: number; month: number; stamp: string;
  factions: HouseHistoryContext["factions"]; result: HouseAssessment[] }>();
export function getHouseAssessments(dynasty: Dynasty, faction: HouseHistoricalFaction,
  factions: HouseHistoryContext["factions"], worldMonth: number) {
  const stamp = JSON.stringify([dynasty.currentRulerId, dynasty.houseEpochs, dynasty.rulers.map(r =>
    [r.id, r.houseName, r.givenName, r.reignOrdinal, r.accessionYear, r.endYear, r.status, r.relationType, Boolean(r.chronicle)]),
    faction.name, faction.status, faction.stateFoundedMonth, faction.terminationMonth, faction.extinctionYear, faction.terminationReason, faction.nameHistory]);
  const revision = WorldHistory.getRevision(), previous = cache.get(dynasty);
  if (previous && previous.faction === faction && previous.factions === factions && previous.revision === revision && previous.month === worldMonth && previous.stamp === stamp) return previous.result;
  const result = deriveHouseAssessments({ dynasty, faction, factions, worldMonth,
    events: WorldHistory.getEventsForFaction(faction.name) });
  cache.set(dynasty, { faction, factions, revision, month: worldMonth, stamp, result });
  return result;
}
