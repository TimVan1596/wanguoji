import type Team from "../Components/Team";

export type PopulationTransitionCause =
  | "NATURAL_GROWTH"
  | "RANDOM_EVENT"
  | "REBELLION_TRANSFER"
  | "EMPIRE_SPLIT_TRANSFER"
  | "SURRENDER_TRANSFER"
  | "EXTINCTION_DISBAND"
  | "EXTINCTION_REMNANT"
  | "RESTORATION"
  | "GOD_ACTION"
  | "SIEGE_LOSS"
  | "CONQUEST_TRANSFER"
  | "BATTLE_DEATH"
  | "RULER_LIFECYCLE"
  | "FACTION_MERGER"
  | "FACTION_SUBMISSION"
  | "LIVE_JOIN"
  | "LIVE_TRANSFER"
  | "INITIALIZATION"
  | "UNATTRIBUTED";

export interface PopulationMutationContext {
  cause: PopulationTransitionCause;
  month?: number;
  relatedFactionId?: string;
  context?: string;
}

export interface PopulationTransitionRecord {
  month: number;
  factionId: string;
  factionName: string;
  before: number;
  after: number;
  delta: number;
  cause: PopulationTransitionCause;
  relatedFactionId?: string;
  context?: string;
}

type TeamPopulation = Pick<Team, "name" | "displayName"> & { users: { size: number } };
const MAX_RECENT_TRANSITIONS = 240;

/** Session-only diagnostics: never exported to WorldSave or consulted by simulation rules. */
export class PopulationTransitionAudit {
  private previousCounts = new Map<string, { count: number; displayName: string }>();
  private pending = new Map<string, PopulationTransitionRecord>();
  private recent: PopulationTransitionRecord[] = [];
  private active = false;

  getRuntimeCardinality() {
    return { populationAuditPrevious: this.previousCounts.size, populationAuditPending: this.pending.size, populationAuditRecent: this.recent.length };
  }

  reset(month: number, teams: TeamPopulation[]) {
    this.pending.clear();
    this.recent = [];
    this.previousCounts = this.snapshot(teams);
    this.active = true;
    this.lastReconciledMonth = month;
  }

  private lastReconciledMonth = 0;

  record(
    team: TeamPopulation,
    before: number,
    after: number,
    metadata: PopulationMutationContext
  ) {
    if (!this.active || before === after) return;
    const month = metadata.month ?? this.lastReconciledMonth;
    const key = [month, team.name, metadata.cause, metadata.relatedFactionId ?? ""].join("|");
    const previous = this.pending.get(key);
    const record: PopulationTransitionRecord = previous
      ? { ...previous, after: previous.after + (after - before), delta: previous.delta + (after - before), context: metadata.context ?? previous.context }
      : {
          month,
          factionId: team.name,
          factionName: team.displayName,
          before,
          after,
          delta: after - before,
          cause: metadata.cause,
          relatedFactionId: metadata.relatedFactionId,
          context: metadata.context,
        };
    this.pending.set(key, record);
  }

  reconcile(month: number, teams: TeamPopulation[]) {
    if (!this.active) this.reset(month, teams);
    const current = this.snapshot(teams);
    // Factions can be registered during a monthly event while AutoSimulator still holds
    // the array passed at the start of that month. Use known pending deltas as the
    // newly-created faction's first observed count, then validate it on the next month.
    const pendingByNewFaction = new Map<string, PopulationTransitionRecord[]>();
    for (const record of this.pending.values()) {
      if (this.previousCounts.has(record.factionId) || current.has(record.factionId)) continue;
      const group = pendingByNewFaction.get(record.factionId) ?? [];
      group.push(record);
      pendingByNewFaction.set(record.factionId, group);
    }
    for (const [factionId, records] of pendingByNewFaction) {
      const count = records.reduce((sum, entry) => sum + entry.delta, 0);
      current.set(factionId, { count: Math.max(0, count), displayName: records[0].factionName });
    }
    const factionIds = new Set([...this.previousCounts.keys(), ...current.keys()]);
    const pendingRecords = [...this.pending.values()];
    for (const factionId of factionIds) {
      const previous = this.previousCounts.get(factionId) ?? { count: 0, displayName: factionId };
      const next = current.get(factionId) ?? { count: 0, displayName: previous.displayName };
      const actualDelta = next.count - previous.count;
      const explainedDelta = pendingRecords
        .filter((entry) => entry.factionId === factionId && entry.month <= month)
        .reduce((sum, entry) => sum + entry.delta, 0);
      const unexplainedDelta = actualDelta - explainedDelta;
      if (unexplainedDelta !== 0) {
        pendingRecords.push({
          month,
          factionId,
          factionName: next.displayName,
          before: previous.count + explainedDelta,
          after: next.count,
          delta: unexplainedDelta,
          cause: "UNATTRIBUTED",
          context: "monthly population reconciliation",
        });
      }
    }
    pendingRecords.forEach((entry) => {
      if (entry.month <= month && entry.delta !== 0) this.recent.push(entry);
    });
    this.recent = this.recent.slice(-MAX_RECENT_TRANSITIONS);
    this.pending = new Map([...this.pending.entries()].filter(([, entry]) => entry.month > month));
    this.previousCounts = current;
    this.lastReconciledMonth = month;
    return this.getRecentSignificant();
  }

  getRecent() {
    return [...this.recent, ...this.pending.values()].slice(-MAX_RECENT_TRANSITIONS);
  }

  getRecentSignificant(limit = 12) {
    return this.getRecent().filter(isSignificantPopulationTransition).slice(-limit).reverse();
  }

  private snapshot(teams: TeamPopulation[]) {
    return new Map(teams.map((team) => [team.name, { count: team.users.size, displayName: team.displayName }]));
  }
}

export function isSignificantPopulationTransition(record: Pick<PopulationTransitionRecord, "before" | "delta">) {
  return Math.abs(record.delta) >= 3 || (record.before > 0 && Math.abs(record.delta) / record.before >= 0.25);
}
