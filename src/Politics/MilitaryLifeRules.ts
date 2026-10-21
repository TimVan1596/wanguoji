/** Stable identity only: does not draw from WorldRandom or predict public history. */
export function deriveMilitaryLifeSchedule(person: { personId: string; bornMonth: number; royalIdentity?: {naturalDeathMonth: number} }) {
  const hash = (label: string) => {
    let value = 2166136261;
    for (const char of `${label}\u0000${person.personId}\u0000${person.bornMonth}`) {
      value = Math.imul(value ^ char.charCodeAt(0), 16777619);
    }
    return value >>> 0;
  };
  const retirementAgeMonths = 65 * 12 + hash("retirement") % (10 * 12 + 1);
  const naturalAgeMonths = 75 * 12 + hash("natural-death") % (20 * 12 + 1);
  return { retirementMonth: person.bornMonth + retirementAgeMonths,
    naturalDeathMonth: person.royalIdentity?.naturalDeathMonth ?? person.bornMonth + Math.max(retirementAgeMonths + 12, naturalAgeMonths) };
}
