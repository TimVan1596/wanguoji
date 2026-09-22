import type { WorldEvent } from "./WorldHistory";
import type { WorldEra } from "../Simulation/WorldEra";
import type { Dynasty, Ruler } from "../Politics/Dynasty";
import type Team from "../Components/Team";
import { getFactionDisplayNameAtMonth } from "../Simulation/FactionIdentity";
import { formatWorldDate } from "../Simulation/WorldTime";

export interface WorldRecord {
  label: string;
  value: string;
}

type RecordFaction = Pick<Team, "name" | "displayName" | "nameHistory" | "firstFoundedYear"> & {
  getCumulativeActiveYears: (worldMonth: number) => number;
};

export function deriveWorldRecords(
  dynasties: Dynasty[],
  teams: RecordFaction[],
  events: WorldEvent[],
  eras: WorldEra[],
  worldMonth = 0
): WorldRecord[] {
  const factions = new Map(teams.map((team) => [team.name, team]));
  const rulers = dynasties.flatMap((dynasty) => dynasty.rulers
    .filter((ruler) => ruler.accessionYear !== undefined && ruler.reignOrdinal !== undefined && ruler.chronicle !== undefined)
    .map((ruler) => ({ dynasty, ruler, factionId: dynasty.factionId })));
  const valid = rulers.filter((entry) => (entry.ruler.accessionYear ?? 0) >= entry.ruler.bornYear);
  const longest = maxBy(valid, (entry) => (entry.ruler.endYear ?? worldMonth) - entry.ruler.accessionYear!);
  const youngest = minBy(valid, (entry) => entry.ruler.accessionYear! - entry.ruler.bornYear);
  const captures = maxBy(valid, (entry) => entry.ruler.chronicle?.citiesCapturedPersonally ?? 0);
  const longestFaction = maxBy(teams, (team) => team.getCumulativeActiveYears(worldMonth));
  const emperor = events.find((event) => event.type === "emperor-proclaimed");
  const unification = events.find((event) => event.type === "world-unification");
  const longestEra = maxBy(eras, (era) => (era.endMonth ?? worldMonth) - era.startMonth);
  const rulerLabel = (entry: typeof longest) => {
    if (!entry) return "";
    const faction = factions.get(entry.factionId);
    const name = faction && entry.ruler.accessionYear !== undefined
      ? getFactionDisplayNameAtMonth(faction, entry.ruler.accessionYear)
      : entry.factionId;
    return `${name} · ${rulerName(entry.ruler)}`;
  };
  return [
    longest && { label: "最长在位", value: `${rulerLabel(longest)} · ${duration((longest.ruler.endYear ?? worldMonth) - longest.ruler.accessionYear!)}` },
    youngest && { label: "最年幼即位", value: `${rulerLabel(youngest)} · ${age(youngest.ruler.accessionYear! - youngest.ruler.bornYear)}` },
    captures && (captures.ruler.chronicle?.citiesCapturedPersonally ?? 0) > 0 && { label: "亲征夺城最多", value: `${rulerLabel(captures)} · ${captures.ruler.chronicle?.citiesCapturedPersonally}座` },
    longestFaction && { label: "最长国祚", value: `${longestFaction.displayName ?? longestFaction.name} · ${duration(longestFaction.getCumulativeActiveYears(worldMonth))}` },
    emperor && { label: "最早称帝", value: `${formatWorldDate(emperor.monthIndex ?? emperor.year)} · ${emperor.title}` },
    unification && { label: "首次统一天下", value: `${formatWorldDate(unification.monthIndex ?? unification.year)} · ${unification.title}` },
    longestEra && { label: "最长时代", value: `${longestEra.name} · ${duration((longestEra.endMonth ?? worldMonth) - longestEra.startMonth)}` },
  ].filter(Boolean) as WorldRecord[];
}

function rulerName(ruler: Ruler) {
  return `${ruler.houseName.replace(/氏$/, "")}${ruler.givenName}`;
}

function duration(months: number) {
  const years = Math.floor(months / 12);
  const remainder = months % 12;
  return remainder === 0 ? `${years}年` : `${years}年${remainder}个月`;
}

function age(months: number) {
  return `${Math.floor(months / 12)}岁${months % 12}个月`;
}

function maxBy<T>(items: T[], value: (item: T) => number) {
  return items.reduce<T | undefined>((best, item) => !best || value(item) > value(best) ? item : best, undefined);
}

function minBy<T>(items: T[], value: (item: T) => number) {
  return items.reduce<T | undefined>((best, item) => !best || value(item) < value(best) ? item : best, undefined);
}
