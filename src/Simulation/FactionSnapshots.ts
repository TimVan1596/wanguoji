import Team from "../Components/Team";
import {
  FACTION_SNAPSHOT_INTERVAL_MONTHS,
  FACTION_SNAPSHOT_MAX_LENGTH,
} from "../config/simulation";
import {
  calculateTerritoryMetrics,
  getFactionTerritoryMetric,
} from "./TerritoryMetrics";

export interface FactionSnapshot {
  year: number;
  population: number;
  absoluteTerritoryShare: number;
  controlledTerritoryShare: number;
  territoryShare: number;
  cityCount: number;
  stability: number;
}

class FactionSnapshotStore {
  private snapshots = new Map<string, FactionSnapshot[]>();
  private lastSnapshotYear = -1;

  reset() {
    this.snapshots.clear();
    this.lastSnapshotYear = -1;
  }

  observe(year: number, teams: Team[], totalCells: number) {
    if (
      this.lastSnapshotYear >= 0 &&
      year - this.lastSnapshotYear < FACTION_SNAPSHOT_INTERVAL_MONTHS
    ) {
      return;
    }
    this.lastSnapshotYear = year;
    const territoryMetrics = calculateTerritoryMetrics(teams, totalCells);
    teams
      .filter((team) => !team.isDie)
      .forEach((team) => {
        const snapshots = this.snapshots.get(team.name) ?? [];
        const territory = getFactionTerritoryMetric(territoryMetrics, team.name);
        snapshots.push({
          year,
          population: team.users.size,
          absoluteTerritoryShare: territory.absoluteWorldShare / 100,
          controlledTerritoryShare: territory.controlledTerritoryShare / 100,
          territoryShare: territory.absoluteWorldShare / 100,
          cityCount: team.cities.length,
          stability: getSnapshotStability(team),
        });
        this.snapshots.set(
          team.name,
          snapshots.slice(-FACTION_SNAPSHOT_MAX_LENGTH)
        );
      });
  }

  get(factionId: string) {
    return [...(this.snapshots.get(factionId) ?? [])];
  }

  getTotalSnapshotCount() {
    return [...this.snapshots.values()].reduce(
      (sum, snapshots) => sum + snapshots.length,
      0
    );
  }

  exportState() {
    return {
      snapshots: [...this.snapshots.entries()].map(([factionId, snapshots]) => ({
        factionId,
        snapshots: snapshots.map((snapshot) => ({ ...snapshot, monthIndex: snapshot.year })),
      })),
      lastSnapshotMonth: this.lastSnapshotYear,
    };
  }
}

const FactionSnapshots = new FactionSnapshotStore();

export default FactionSnapshots;

function getSnapshotStability(team: Pick<Team, "cities">) {
  if (team.cities.length === 0) {
    return 0;
  }
  const total = team.cities.reduce((sum, city) => sum + city.loyalty, 0);
  return Math.round(total / team.cities.length);
}
