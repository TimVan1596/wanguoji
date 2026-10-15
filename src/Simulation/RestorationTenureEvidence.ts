import type { WorldEvent } from "../History/WorldHistory";

export interface RestorationTenureTeam {
  name: string; status: string; firstFoundedYear?: number; stateFoundedMonth?: number;
  cumulativeActiveYears: number; currentActiveSinceYear?: number; lastExiledYear?: number; restorationYears?: number[];
}
export interface RestorationTenureEvidence {
  factionId: string; evidenceEndMonth: number; complete: boolean; stateTenureMonths: number;
  currentHouseTenureMonths: number; currentHouseContinuityMonths: number; currentHouseEpochStartMonth?: number;
}
export interface RestorationTenureInput {
  team: RestorationTenureTeam;
  dynasty?: { factionId?: string; houseEpochs?: Array<{ startMonth: number; endMonth?: number }> };
  /** Equal-month events must be in canonical append order. Other months may be descending. */
  events: readonly WorldEvent[];
  worldMonth: number;
}
const month = (n: unknown): n is number => Number.isSafeInteger(n) && Number(n) >= 0;

/** Read-only formal ACTIVE intervals; no epoch elapsed-time or lifetime-total fallback. */
export function deriveRestorationTenureEvidence(input: RestorationTenureInput): RestorationTenureEvidence {
  const { team, dynasty, events, worldMonth } = input;
  const result: RestorationTenureEvidence = { factionId: team.name, evidenceEndMonth: worldMonth, complete: false,
    stateTenureMonths: 0, currentHouseTenureMonths: 0, currentHouseContinuityMonths: 0 };
  const first = team.firstFoundedYear, formal = team.stateFoundedMonth;
  if (!month(worldMonth) || !month(first) || !month(formal) || formal < first || formal > worldMonth ||
      !month(team.cumulativeActiveYears) || (dynasty?.factionId !== undefined && dynasty.factionId !== team.name)) return result;
  const epochs = dynasty?.houseEpochs;
  if (!epochs?.length) return result;
  for (let i = 0; i < epochs.length; i++) {
    const e = epochs[i], prev = epochs[i - 1];
    if (!month(e.startMonth) || e.startMonth < first || e.startMonth > worldMonth ||
        (e.endMonth !== undefined && (!month(e.endMonth) || e.endMonth < e.startMonth || e.endMonth > worldMonth)) ||
        (prev && (prev.endMonth === undefined || prev.endMonth !== e.startMonth - 1))) return result;
  }
  const epoch = epochs[epochs.length - 1];
  if (epoch.endMonth !== undefined) return result;
  const relevant = events.filter(e =>
    (e.type === "faction-exiled" && e.targetFactionId === team.name) ||
    (e.type === "faction-restored" && e.actorFactionId === team.name) ||
    (["faction-extinct", "faction-merged", "faction-submitted"].includes(e.type) &&
      (e.targetFactionId === team.name || e.previousOwnerFactionId === team.name)));
  if (relevant.some(e => !month(e.monthIndex ?? e.year) || (e.monthIndex !== undefined && e.monthIndex !== e.year) || (e.monthIndex ?? e.year) < first || (e.monthIndex ?? e.year) > worldMonth)) return result;
  // Stable sort preserves real equal-month order. Never sort by event ID or reverse ties.
  const ordered = relevant.map((event, order) => ({ event, order })).sort((a,b) =>
    (a.event.monthIndex ?? a.event.year) - (b.event.monthIndex ?? b.event.year) || a.order - b.order);
  let status = "ACTIVE", since = first, total = 0, state = 0, house = 0, lastExile: number | undefined;
  const restorations: number[] = [], seen = new Set<string>();
  const close = (end: number) => {
    total += end - since;
    state += Math.max(0, end - Math.max(since, formal));
    house += Math.max(0, end - Math.max(since, formal, epoch.startMonth));
  };
  for (const { event } of ordered) {
    const key = `${event.type}:${event.historyGroupId ?? event.id}`;
    if (seen.has(key)) return result;
    seen.add(key);
    const at = event.monthIndex ?? event.year;
    if (event.type === "faction-exiled") {
      if (status !== "ACTIVE") return result;
      close(at); status = "EXILED"; lastExile = at;
    } else if (event.type === "faction-restored") {
      if (status !== "EXILED") return result;
      status = "ACTIVE"; since = at; restorations.push(at);
    } else {
      if (status === "EXTINCT") return result;
      if (status === "ACTIVE") close(at);
      status = "EXTINCT";
    }
  }
  if (status !== team.status ||
      (status === "ACTIVE" && team.currentActiveSinceYear !== since) ||
      team.lastExiledYear !== lastExile ||
      !team.restorationYears || team.restorationYears.length !== restorations.length ||
      team.restorationYears.some((n,i) => n !== restorations[i]) || total !== team.cumulativeActiveYears) return result;
  if (status === "ACTIVE") close(worldMonth);
  return { ...result, complete: true, stateTenureMonths: state, currentHouseTenureMonths: house,
    currentHouseEpochStartMonth: epoch.startMonth, currentHouseContinuityMonths: worldMonth - epoch.startMonth };
}
