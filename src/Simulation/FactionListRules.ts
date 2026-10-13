import type { FactionStatus } from "../Components/Team";
import { shouldShowFactionInHistoricalArchive } from "./FactionIdentity";

export type FactionListFilter = "all" | "active" | "exiled" | "extinct";
export type HistoricalFactionSort =
  | "terminal-recent"
  | "terminal-oldest"
  | "active-longest"
  | "active-shortest"
  | "founded-recent"
  | "restorations-most";

export interface FactionListItem {
  name: string;
  factionId?: string;
  status: FactionStatus;
  identityStage?: "PROVISIONAL" | "STATE";
  stateFoundedMonth?: number;
  firstFoundedYear?: number;
  firstFoundedMonth?: number;
  terminationReason?: "EXTINCT" | "MERGED" | "SUBMITTED";
  extinctionYear?: number;
  terminationMonth?: number;
  restorationYears?: number[];
  cumulativeActiveMonths?: number;
  cumulativeActiveYears?: number;
  getCumulativeActiveYears?: (month: number) => number;
}

export function getVisibleFactions<T extends FactionListItem>(
  factions: T[],
  filter: FactionListFilter
) {
  const archiveVisible = factions.filter((faction) =>
    shouldShowFactionInHistoricalArchive({
      status: faction.status,
      identityStage: faction.identityStage ?? "PROVISIONAL",
      stateFoundedMonth: faction.stateFoundedMonth,
    })
  );
  if (filter === "all") {
    return [...archiveVisible];
  }
  const statusByFilter: Record<Exclude<FactionListFilter, "all">, FactionStatus> = {
    active: "ACTIVE",
    exiled: "EXILED",
    extinct: "EXTINCT",
  };
  return archiveVisible.filter((faction) => faction.status === statusByFilter[filter]);
}

/** The legacy `Year` fields contain world-month indices. Do not rescale them. */
export function getFactionTerminalMonth(faction: FactionListItem): number | undefined {
  if (faction.status !== "EXTINCT") return undefined;
  if (faction.terminationReason === "MERGED" || faction.terminationReason === "SUBMITTED") {
    return isValidMonth(faction.terminationMonth) ? faction.terminationMonth : undefined;
  }
  if (faction.terminationReason === "EXTINCT") {
    return isValidMonth(faction.extinctionYear) ? faction.extinctionYear : undefined;
  }
  const fallback = faction.extinctionYear ?? faction.terminationMonth;
  return isValidMonth(fallback) ? fallback : undefined;
}

/** Sorts an already-filtered terminal archive without mutating the source array. */
export function sortHistoricalFactions<T extends FactionListItem>(
  factions: readonly T[],
  sort: HistoricalFactionSort,
  worldMonth: number
): T[] {
  return [...factions].sort((left, right) => {
    const primary = compareSortValue(left, right, sort, worldMonth);
    if (primary !== 0) return primary;
    const founded = compareOptionalNumber(getFoundedMonth(left), getFoundedMonth(right), 1);
    if (founded !== 0) return founded;
    return compareFactionId(left.factionId ?? left.name, right.factionId ?? right.name);
  });
}

function compareSortValue(
  left: FactionListItem,
  right: FactionListItem,
  sort: HistoricalFactionSort,
  worldMonth: number
) {
  switch (sort) {
    case "terminal-recent":
      return compareOptionalNumber(getFactionTerminalMonth(left), getFactionTerminalMonth(right), -1);
    case "terminal-oldest":
      return compareOptionalNumber(getFactionTerminalMonth(left), getFactionTerminalMonth(right), 1);
    case "active-longest":
      return compareOptionalNumber(getActiveMonths(left, worldMonth), getActiveMonths(right, worldMonth), -1);
    case "active-shortest":
      return compareOptionalNumber(getActiveMonths(left, worldMonth), getActiveMonths(right, worldMonth), 1);
    case "founded-recent":
      return compareOptionalNumber(getFoundedMonth(left), getFoundedMonth(right), -1);
    case "restorations-most":
      return compareOptionalNumber(left.restorationYears?.length, right.restorationYears?.length, -1);
  }
}

function getActiveMonths(faction: FactionListItem, worldMonth: number) {
  return faction.getCumulativeActiveYears?.(worldMonth) ?? faction.cumulativeActiveMonths ?? faction.cumulativeActiveYears;
}

function getFoundedMonth(faction: FactionListItem) {
  return faction.firstFoundedMonth ?? faction.firstFoundedYear;
}

function isValidMonth(value: number | undefined): value is number {
  return value !== undefined && Number.isSafeInteger(value) && value >= 0;
}

function compareOptionalNumber(left: number | undefined, right: number | undefined, direction: 1 | -1) {
  if (left === undefined) return right === undefined ? 0 : 1;
  if (right === undefined) return -1;
  return direction * (left - right);
}

function compareFactionId(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}
