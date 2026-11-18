import type { RollingStepPerformance } from "./RollingStepPerformance";

export const runtimeProfilingEnabled = import.meta.env.DEV || import.meta.env.MODE === "desktop-debug";

/** Aggregate all cities/spawns within one month before recording bounded samples. */
export class MonthlyPhaseProfiler {
  private totals = new Map<string, number>([
    "Military/life","Military/formations","Military/insurgent commands","Military/orders","Military/order evidence","Military/promotions","Military/family eligibility","Military/initial candidates","Military/royal eligibility","Military/weights","Military/title eligibility","Military/appointment transaction",
    "Dynasty/life archives","Dynasty/heir life","Dynasty/ruling monarch","Dynasty/heir qualification","Dynasty/ruler body","Dynasty/court qualification and acts","Dynasty/succession transaction",
    "City.updateLoyalty", "City.updateSiege", "City.updateDevastation", "City.calculateMaxDefense/development", "City.zone/visual refresh",
    "Population.active faction scan", "Population.capacity", "Population.growth context", "Population.spawn/runtime creation", "Population.user id lookup", "Population.makeUser",
    "WorldEvent.expired effects", "WorldEvent.observeWorldGoal", "WorldEvent.checkStateFormation", "WorldEvent.applyProvisionalDissolutionPressure",
    "WorldEvent.checkEmperorProclamation", "WorldEvent.checkRestorations", "WorldEvent.checkEmpireSplit", "WorldEvent.checkCityFounding", "WorldEvent.triggerRandomEvent",
  ].map((name) => [name, 0]));
  measure<T>(name: string, work: () => T): T {
    const start = performance.now();
    try { return work(); }
    finally { this.totals.set(name, (this.totals.get(name) ?? 0) + performance.now() - start); }
  }
  flush(target: RollingStepPerformance,month?:number) {
    this.totals.forEach((duration, name) => { target.record(name, duration,month); this.totals.set(name, 0); });
  }
}

export function measurePhase<T>(profile: MonthlyPhaseProfiler | undefined, name: string, work: () => T): T {
  return profile ? profile.measure(name, work) : work();
}
