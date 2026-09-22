import type { WorldEvent } from "./WorldHistory";
import type { WorldEra } from "../Simulation/WorldEra";
import type { Dynasty, Ruler } from "../Politics/Dynasty";
import type Team from "../Components/Team";

export interface WorldRecord {
  label: string;
  value: string;
}

export function deriveWorldRecords(
  dynasties: Dynasty[],
  teams: Pick<Team, "name" | "displayName" | "firstFoundedYear" | "cumulativeActiveYears">[],
  events: WorldEvent[],
  eras: WorldEra[]
): WorldRecord[] {
  const rulers = dynasties.flatMap((dynasty) => dynasty.rulers).filter((ruler) => ruler.endYear !== undefined);
  const longest = maxBy(rulers, (ruler) => (ruler.endYear ?? 0) - (ruler.accessionYear ?? 0));
  const youngest = minBy(rulers, (ruler) => (ruler.accessionYear ?? 0) - ruler.bornYear);
  const captures = maxBy(rulers, (ruler) => ruler.chronicle?.citiesCapturedPersonally ?? 0);
  const longestFaction = maxBy(teams, (team) => team.cumulativeActiveYears);
  const emperor = events.find((event) => event.type === "emperor-proclaimed");
  const unification = events.find((event) => event.type === "world-unification");
  const longestEra = maxBy(eras, (era) => (era.endMonth ?? era.startMonth) - era.startMonth);
  return [
    longest && { label: "最长在位", value: `${rulerName(longest)} · ${duration((longest.endYear ?? 0) - (longest.accessionYear ?? 0))}` },
    youngest && { label: "最年幼即位", value: `${rulerName(youngest)} · ${duration((youngest.accessionYear ?? 0) - youngest.bornYear)}` },
    captures && (captures.chronicle?.citiesCapturedPersonally ?? 0) > 0 && { label: "亲征夺城最多", value: `${rulerName(captures)} · ${captures.chronicle?.citiesCapturedPersonally}座` },
    longestFaction && { label: "最长国祚", value: `${longestFaction.displayName ?? longestFaction.name} · ${longestFaction.cumulativeActiveYears}年` },
    emperor && { label: "最早称帝", value: `${emperor.year}年 · ${emperor.title}` },
    unification && { label: "首次统一天下", value: `${unification.year}年 · ${unification.title}` },
    longestEra && { label: "最长时代", value: `${longestEra.name} · ${duration((longestEra.endMonth ?? longestEra.startMonth) - longestEra.startMonth)}` },
  ].filter(Boolean) as WorldRecord[];
}

function rulerName(ruler: Ruler) {
  return `${ruler.houseName.replace(/氏$/, "")}${ruler.givenName}`;
}

function duration(months: number) {
  return `${Math.floor(months / 12)}年${months % 12}个月`;
}

function maxBy<T>(items: T[], value: (item: T) => number) {
  return items.reduce<T | undefined>((best, item) => !best || value(item) > value(best) ? item : best, undefined);
}

function minBy<T>(items: T[], value: (item: T) => number) {
  return items.reduce<T | undefined>((best, item) => !best || value(item) < value(best) ? item : best, undefined);
}
