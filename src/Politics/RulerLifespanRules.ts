import { yearsToMonths } from "../Simulation/WorldTime";

export interface RulerLifespanBand {
  maxRoll: number;
  minAgeYears: number;
  maxAgeYears: number;
}

export const RULER_LIFESPAN_BANDS: RulerLifespanBand[] = [
  { maxRoll: 8, minAgeYears: 45, maxAgeYears: 54 },
  { maxRoll: 78, minAgeYears: 55, maxAgeYears: 74 },
  { maxRoll: 95, minAgeYears: 75, maxAgeYears: 84 },
  { maxRoll: 100, minAgeYears: 85, maxAgeYears: 92 },
];

export function createNaturalDeathMonth(
  birthMonth: number,
  roll: (maxExclusive: number) => number
) {
  const rollValue = roll(100);
  const band =
    RULER_LIFESPAN_BANDS.find((item) => rollValue < item.maxRoll) ??
    RULER_LIFESPAN_BANDS[RULER_LIFESPAN_BANDS.length - 1];
  const spanYears =
    band.minAgeYears + roll(band.maxAgeYears - band.minAgeYears + 1);
  return birthMonth + yearsToMonths(spanYears);
}

export function getAgeAtMonth(birthMonth: number, month: number) {
  return Math.max(0, Math.floor((month - birthMonth) / 12));
}

export function deriveHeirBirthMonth(
  parentBirthMonth: number,
  currentMonth: number,
  roll: (maxExclusive: number) => number,
  minParentAgeMonths = 18 * 12,
  maxParentAgeMonths = 40 * 12
) {
  const parentAgeMonths = currentMonth - parentBirthMonth;
  if (parentAgeMonths < minParentAgeMonths) {
    return undefined;
  }
  const earliest = parentBirthMonth + minParentAgeMonths;
  const latest = Math.min(currentMonth, parentBirthMonth + maxParentAgeMonths);
  return earliest + roll(Math.max(1, latest - earliest + 1));
}

export function isNaturallyDeadByMonth(
  naturalDeathMonth: number | undefined,
  month: number
) {
  return naturalDeathMonth !== undefined && month >= naturalDeathMonth;
}
