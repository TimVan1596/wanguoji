/** Permanent observations, not a second faction/identity/history archive. All months are canonical. */
export interface LifetimePeak { value: number; month: number; source: "MONTHLY" | "PRE_TERMINAL" }
export interface FactionLifetimeRecord {
  factionId: string;
  peakPopulation: LifetimePeak;
  peakTerritoryBlocks: LifetimePeak;
  peakCityCount: LifetimePeak;
  lastObservedMonth: number;
  terminal?: { month: number; population: number; territoryBlocks: number; cityCount: number };
}
export interface FactionLifetimeState { totalWorldBlocks: number; records: FactionLifetimeRecord[] }
export interface LifetimeFaction {
  name: string; status: string; users: { size: number }; cities: { length: number };
  blocks?: { children?: { size?: number } };
}

export class FactionLifetimeStore {
  private records = new Map<string, FactionLifetimeRecord>();
  private pending = new Map<string, NonNullable<FactionLifetimeRecord["terminal"]>>();
  private totalWorldBlocks = 0;
  reset(totalWorldBlocks = 0) { this.records.clear(); this.pending.clear(); this.totalWorldBlocks = totalWorldBlocks; }
  observe(team: LifetimeFaction, month: number, source: LifetimePeak["source"] = "MONTHLY") {
    const previous = this.records.get(team.name);
    if (previous?.terminal) return previous;
    if (previous && month < previous.lastObservedMonth) throw new Error("Lifetime observation cannot move backwards");
    const values = { population: team.users.size, territoryBlocks: team.status === "ACTIVE" ? team.blocks?.children?.size ?? 0 : 0, cityCount: team.cities.length };
    const peak = (old: LifetimePeak | undefined, value: number): LifetimePeak => !old || value > old.value ? { value, month, source } : old;
    const record: FactionLifetimeRecord = { factionId: team.name,
      peakPopulation: peak(previous?.peakPopulation, values.population),
      peakTerritoryBlocks: peak(previous?.peakTerritoryBlocks, values.territoryBlocks),
      peakCityCount: peak(previous?.peakCityCount, values.cityCount), lastObservedMonth: month };
    this.records.set(team.name, record);
    return record;
  }
  observeWorld(month: number, teams: readonly LifetimeFaction[], totalWorldBlocks: number) {
    if (this.totalWorldBlocks && this.totalWorldBlocks !== totalWorldBlocks) throw new Error("Lifetime world geometry changed");
    this.totalWorldBlocks = totalWorldBlocks;
    for (const team of teams) if (team.status !== "EXTINCT") this.observe(team, month);
  }
  /** Capture before users/cities/blocks leave the source; no political action occurs here. */
  prepareTerminal(team: LifetimeFaction, month: number) {
    if (this.records.get(team.name)?.terminal) return;
    const pending = this.pending.get(team.name);
    if (pending) {
      if (pending.month !== month) throw new Error("Lifetime terminal boundary mismatch");
      return;
    }
    this.observe(team, month, "PRE_TERMINAL");
    this.pending.set(team.name, { month, population: team.users.size,
      territoryBlocks: team.status === "ACTIVE" ? team.blocks?.children?.size ?? 0 : 0, cityCount: team.cities.length });
  }
  freeze(team: LifetimeFaction, month: number) {
    if (this.records.get(team.name)?.terminal) return;
    if (!this.pending.has(team.name)) this.prepareTerminal(team, month);
    const terminal = this.pending.get(team.name)!;
    if (terminal.month !== month) throw new Error("Lifetime terminal boundary mismatch");
    this.records.set(team.name, { ...this.records.get(team.name)!, terminal });
    this.pending.delete(team.name);
  }
  get(factionId: string) { return this.records.get(factionId); }
  getTotalWorldBlocks() { return this.totalWorldBlocks; }
  exportState(): FactionLifetimeState { return structuredClone({ totalWorldBlocks: this.totalWorldBlocks, records: [...this.records.values()] }); }
  importState(state: FactionLifetimeState) {
    this.totalWorldBlocks = state.totalWorldBlocks;
    this.records = new Map(structuredClone(state.records).map(record => [record.factionId, record]));
    this.pending.clear();
  }
}
/** Fraction (0..1), intentionally distinct from TerritoryMetrics' percent (0..100). */
export function getLifetimeAbsoluteWorldShare(record: FactionLifetimeRecord, totalWorldBlocks: number) {
  return totalWorldBlocks > 0 ? record.peakTerritoryBlocks.value / totalWorldBlocks : 0;
}
const FactionLifetimeRecords = new FactionLifetimeStore();
export default FactionLifetimeRecords;
