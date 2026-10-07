import type { CityHistoryEvent } from "../Components/City";
import { resolveFactionHistoricalName, type HistoryFactionLike } from "./HistoryRenderRules";

export function formatCityHistoryEvent(
  event: CityHistoryEvent,
  city: { name: string; founderFactionId: string; foundedMonth: number },
  factions: Map<string, HistoryFactionLike>,
  rulerTitle?: string
) {
  const month = event.year;
  const name = (id?: string) => resolveFactionHistoricalName(factions, id, month);
  const previous = name(event.previousOwnerFactionId);
  const next = name(event.newOwnerFactionId);
  const founderAtFounding = resolveFactionHistoricalName(factions, city.founderFactionId, city.foundedMonth);
  switch (event.type) {
    case "founded":
      return founderAtFounding ? `${founderAtFounding}建立${city.name}` : event.title;
    case "capital-started":
      return founderAtFounding ? `${founderAtFounding}定都${city.name}` : event.title;
    case "captured":
      if (!next || !previous) return event.title;
      return rulerTitle
        ? `${rulerTitle}亲征，${next}攻陷${previous}控制的${city.name}`
        : `${next}攻陷${previous}控制的${city.name}`;
    case "recovered":
      if (!next || !previous) return event.title;
      return `${next}从${previous}手中收复${city.name}`;
    case "capital-lost":
      if (!previous || !event.wasCapital) return event.title;
      return `${previous}失都${city.name}`;
    case "capital-relocated":
      return next ? `${next}迁都${city.name}` : event.title;
    case "submitted":
      return previous && next ? `${previous}纳土归附${next}，${city.name}行政归入${next}` : event.title;
    default:
      return event.title;
  }
}

export function getCityHistoricalFactionName(
  factions: Map<string, HistoryFactionLike>,
  factionId: string,
  month: number
) {
  return resolveFactionHistoricalName(factions, factionId, month);
}
