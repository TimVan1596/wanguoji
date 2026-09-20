export type FactionStatus = "ACTIVE" | "EXILED" | "EXTINCT";

export interface FactionLifecycleState {
  status: FactionStatus;
  firstFoundedYear: number;
  currentActiveSinceYear: number;
  lastExiledYear?: number;
  restorationYears: number[];
  extinctionYear?: number;
  cumulativeActiveYears: number;
}

export function resolveFactionStatus(
  ownedCityCount: number,
  remnantPopulation: number
): FactionStatus {
  if (ownedCityCount > 0) {
    return "ACTIVE";
  }
  return remnantPopulation > 0 ? "EXILED" : "EXTINCT";
}

export function initializeFactionLifecycle(
  state: FactionLifecycleState,
  year: number
) {
  state.status = "ACTIVE";
  state.firstFoundedYear = year;
  state.currentActiveSinceYear = year;
  state.lastExiledYear = undefined;
  state.restorationYears = [];
  state.extinctionYear = undefined;
  state.cumulativeActiveYears = 0;
}

export function markLifecycleActive(
  state: FactionLifecycleState,
  year: number
) {
  if (state.status !== "ACTIVE") {
    state.currentActiveSinceYear = year;
    state.restorationYears.push(year);
  }
  state.status = "ACTIVE";
  state.extinctionYear = undefined;
}

export function markLifecycleExiled(
  state: FactionLifecycleState,
  year: number
) {
  if (state.status === "ACTIVE") {
    state.cumulativeActiveYears += Math.max(
      0,
      year - state.currentActiveSinceYear
    );
  }
  state.status = "EXILED";
  state.lastExiledYear = year;
}

export function markLifecycleExtinct(
  state: FactionLifecycleState,
  year: number
) {
  if (state.status === "ACTIVE") {
    state.cumulativeActiveYears += Math.max(
      0,
      year - state.currentActiveSinceYear
    );
  }
  state.status = "EXTINCT";
  state.extinctionYear = year;
}

export function getCumulativeActiveYears(
  state: FactionLifecycleState,
  year: number
) {
  return (
    state.cumulativeActiveYears +
    (state.status === "ACTIVE"
      ? Math.max(0, year - state.currentActiveSinceYear)
      : 0)
  );
}

export function shouldDynastyContinue(status: FactionStatus) {
  return status !== "EXTINCT";
}
