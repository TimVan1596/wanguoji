import type { FactionStatus } from "../Components/Team";
import { shouldShowFactionInHistoricalArchive } from "./FactionIdentity";

export type FactionListFilter = "all" | "active" | "exiled" | "extinct";

export interface FactionListItem {
  name: string;
  status: FactionStatus;
  identityStage?: "PROVISIONAL" | "STATE";
  stateFoundedMonth?: number;
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
