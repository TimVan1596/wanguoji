import type Team from "../Components/Team";

export type PopulationTransitionCause =
  | "NATURAL_GROWTH"
  | "NATURAL_DEATH"
  | "RANDOM_EVENT"
  | "IMMIGRATION"
  | "SPECIAL_EVENT"
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

export type PopulationDamageSource = "CITY_SIEGE" | "HOSTILE_HOME_OCCUPATION" | "MILITARY_LIFESPAN" | "UNSPECIFIED";

export interface PopulationCasualtyEvidence {
  victimUserId: number;
  victimLogicalUnitId?: string;
  victimMilitaryPersonId?: string;
  victimPosition?: { x: number; y: number; gridX: number; gridY: number; source: "LOGICAL" | "PHASER" };
  populationBefore: number;
  populationAfter: number;
  destroyed: true;
}

export interface PopulationMutationContext {
  cause: PopulationTransitionCause;
  month?: number;
  relatedFactionId?: string;
  context?: string;
  damageSource?: PopulationDamageSource;
  triggerCityId?: string;
  casualty?: PopulationCasualtyEvidence;
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
  damageSource?: PopulationDamageSource;
  triggerCityId?: string;
  casualty?: PopulationCasualtyEvidence;
}

type TeamPopulation = Pick<Team, "name" | "displayName"> & { users: { size: number } };
const MAX_RECENT_TRANSITIONS = 240;

export function emptyPopulationTotals() {
  return { net: 0, naturalGrowth: 0, external: 0, warDeaths: 0, naturalDeaths: 0, transferIn: 0, transferOut: 0, special: 0, otherNet: 0, unattributed: 0 };
}
type PopulationTotals = ReturnType<typeof emptyPopulationTotals>;
const TRANSFERS = new Set<PopulationTransitionCause>(["REBELLION_TRANSFER", "EMPIRE_SPLIT_TRANSFER", "SURRENDER_TRANSFER", "CONQUEST_TRANSFER", "FACTION_MERGER", "FACTION_SUBMISSION", "LIVE_TRANSFER"]);
function addPopulationTotal(total: PopulationTotals, row: Pick<PopulationTransitionRecord, "delta" | "cause" | "relatedFactionId">) {
  const d = row.delta; total.net += d;
  if (TRANSFERS.has(row.cause) || row.cause === "RESTORATION" && row.relatedFactionId) { if (d > 0) total.transferIn += d; else total.transferOut -= d; }
  else if (row.cause === "NATURAL_GROWTH" && d > 0) total.naturalGrowth += d;
  else if (["IMMIGRATION", "LIVE_JOIN"].includes(row.cause) && d > 0) total.external += d;
  else if (["SIEGE_LOSS", "BATTLE_DEATH"].includes(row.cause) && d < 0) total.warDeaths -= d;
  else if (row.cause === "NATURAL_DEATH" && d < 0) total.naturalDeaths -= d;
  else if (["SPECIAL_EVENT", "RANDOM_EVENT"].includes(row.cause) && d > 0) total.special += d;
  else if (row.cause === "UNATTRIBUTED") total.unattributed += d;
  else total.otherNet += d;
}

/** Session-only diagnostics: never exported to WorldSave or consulted by simulation rules. */
export class PopulationTransitionAudit {
  private previousCounts = new Map<string, { count: number; displayName: string }>();
  private pending = new Map<string, PopulationTransitionRecord>();
  private recent: PopulationTransitionRecord[] = [];
  private active = false;
  private sessionStartMonth = 0;
  private openingWorldPopulation = 0;
  private totals = emptyPopulationTotals();
  private monthly = new Map<number, Map<string, PopulationTotals>>();
  private latestMonth = 0;
  private rollingLimited = false;


  getRuntimeCardinality() {
    return { populationAuditPrevious: this.previousCounts.size, populationAuditPending: this.pending.size, populationAuditRecent: this.recent.length, populationAuditMonthBuckets: this.monthly.size };
  }

  reset(month: number, teams: TeamPopulation[]) {
    this.pending.clear();
    this.recent = [];
    this.sessionStartMonth = this.latestMonth = month;
    this.openingWorldPopulation = teams.reduce((n,t) => n + t.users.size, 0);
    this.totals = emptyPopulationTotals(); this.monthly.clear(); this.rollingLimited = false;
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
    this.account({ month, factionId: team.name, delta: after - before, cause: metadata.cause, relatedFactionId: metadata.relatedFactionId });
    const causeContext = metadata.cause === "SIEGE_LOSS" ? metadata.context ?? "" : "";
    // A successful casualty has its own row so that the victim identity and exact
    // population delta cannot be merged into an anonymous aggregate.
    const casualtyKey = metadata.casualty
      ? `${metadata.casualty.victimLogicalUnitId ?? ""}|${metadata.casualty.victimMilitaryPersonId ?? ""}|${metadata.casualty.victimUserId}`
      : "";
    const key = [month, team.name, metadata.cause, metadata.relatedFactionId ?? "", metadata.damageSource ?? "",
      metadata.triggerCityId ?? "", causeContext, casualtyKey].join("|");
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
          damageSource: metadata.damageSource,
          triggerCityId: metadata.triggerCityId,
          casualty: metadata.casualty ? { ...metadata.casualty, victimPosition: metadata.casualty.victimPosition ? { ...metadata.casualty.victimPosition } : undefined } : undefined,
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
        this.account({ month, factionId, delta: unexplainedDelta, cause: "UNATTRIBUTED" });
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

  private account(row: Pick<PopulationTransitionRecord, "month" | "factionId" | "delta" | "cause" | "relatedFactionId">) {
    addPopulationTotal(this.totals, row);
    this.latestMonth = Math.max(this.latestMonth, row.month);
    for (const month of this.monthly.keys()) if (month < this.latestMonth - 11) this.monthly.delete(month);
    if (row.month < this.latestMonth - 11) return;
    const bucket = this.monthly.get(row.month) ?? new Map<string, PopulationTotals>();
    for (const id of ["", row.factionId]) {
      if (!bucket.has(id) && bucket.size >= 2049) { this.rollingLimited = true; continue; }
      const total = bucket.get(id) ?? emptyPopulationTotals(); addPopulationTotal(total, row); bucket.set(id, total);
    }
    this.monthly.set(row.month, bucket);
  }

  getSummary(factionId?: string, teams?: TeamPopulation[]) {
    const month = Math.max(this.lastReconciledMonth, this.latestMonth);
    const recent = emptyPopulationTotals();
    for (const [at, bucket] of this.monthly) if (at > month - 12 && at <= month) {
      const t = bucket.get(factionId ?? "");
      if (t) for (const key of Object.keys(recent) as Array<keyof PopulationTotals>) recent[key] += t[key];
    }
    const closingWorldPopulation = teams ? teams.reduce((n,t) => n+t.users.size,0) : [...this.previousCounts.values()].reduce((n,t)=>n+t.count,0);
    return { sessionStartMonth: this.sessionStartMonth, worldMonth: month, observedMonths: Math.min(12, Math.max(0, month-this.sessionStartMonth)),
      openingWorldPopulation: this.openingWorldPopulation, closingWorldPopulation, totals: { ...this.totals }, recent,
      unexplainedWorldDifference: closingWorldPopulation - this.openingWorldPopulation - (this.totals.net - this.totals.unattributed),
      rollingLimited: this.rollingLimited };
  }

  getRecent() {
    return [...this.recent, ...this.pending.values()].slice(-MAX_RECENT_TRANSITIONS);
  }

  getRecentSignificant(limit = 12) {
    return this.getRecent().filter(record => Boolean(record.casualty) || isSignificantPopulationTransition(record)).slice(-limit).reverse();
  }

  private snapshot(teams: TeamPopulation[]) {
    return new Map(teams.map((team) => [team.name, { count: team.users.size, displayName: team.displayName }]));
  }
}

export function isSignificantPopulationTransition(record: Pick<PopulationTransitionRecord, "before" | "delta">) {
  return Math.abs(record.delta) >= 3 || (record.before > 0 && Math.abs(record.delta) / record.before >= 0.25);
}
