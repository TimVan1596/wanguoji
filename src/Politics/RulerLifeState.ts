/** Actual recorded deaths only; scheduled lifespan and political ends are not evidence. */
export const RULER_DEATH_REASONS = ["去世", "自然去世", "战死", "被俘处死"] as const;
export type RulerDeathReason = typeof RULER_DEATH_REASONS[number];
export const RULER_STATUSES = ["ruling", "exiled", "heir", "kin", "dead", "abdicated", "politically-ended"] as const;
export interface RulerDeathRecord {
  deathMonth?: number;
  deathReason?: RulerDeathReason;
  bornYear?: number;
}
export function hasRecordedRulerDeath(ruler: RulerDeathRecord): boolean {
  return Number.isSafeInteger(ruler.deathMonth) && ruler.deathMonth! >= 0 &&
    (ruler.bornYear === undefined || ruler.deathMonth! >= ruler.bornYear) &&
    RULER_DEATH_REASONS.includes(ruler.deathReason!);
}
