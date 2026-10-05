import { getFactionDisplayNameAtMonth } from "../Simulation/FactionIdentity";
import { getFactionColorAtMonth } from "../Simulation/FactionColorHistory";
import type { HistoryFactionLike } from "./HistoryRenderRules";

export function getHistoricalFactionIdentity(faction: HistoryFactionLike, eventMonth: number) {
  return { name: getFactionDisplayNameAtMonth({ name: faction.name,
    displayName: faction.displayName ?? faction.name, nameHistory: faction.nameHistory ?? [] }, eventMonth),
    color: getFactionColorAtMonth(faction, eventMonth) };
}
