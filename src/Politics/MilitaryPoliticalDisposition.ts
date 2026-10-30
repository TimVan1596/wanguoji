/** Stable personality, independent of faction, office, world RNG and hydration.
 * Loyalty is always supplied by the real User; event copies are historical observations. */
export function militaryAmbition(personId: string, bornMonth: number): number {
  let hash = 2166136261;
  for (const ch of `military-ambition-v1:${personId}:${bornMonth}`) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619) >>> 0;
  return hash % 101;
}
export interface MilitaryDisposition {
  version: 1;
  ambition: number;
  loyalty: number;
  prestige: number;
  responseThreshold: number;
  contestWeight: number;
}
export function militaryDisposition(personId: string, bornMonth: number, loyalty: number, prestige: number): MilitaryDisposition {
  const ambition = militaryAmbition(personId, bornMonth);
  return {version: 1, ambition, loyalty, prestige,
    responseThreshold: 55 + ambition * .3 + prestige * 2,
    contestWeight: .75 + (ambition + 100 - loyalty) / 200};
}
export function validMilitaryDisposition(value: MilitaryDisposition | undefined, personId: string, bornMonth: number, prestige: number): boolean {
  return !!value && Number.isFinite(value.loyalty) && value.loyalty >= 0 && value.loyalty <= 100 &&
    JSON.stringify(value) === JSON.stringify(militaryDisposition(personId, bornMonth, value.loyalty, prestige));
}
/** Loyal, restrained officers decline pressure against their own dynasty. This is not a new crisis or draw. */
export function willingCourtParticipant(value: MilitaryDisposition): boolean {
  return value.loyalty < 45 + value.ambition * .4 + value.prestige * 2;
}
export function militaryDispositionLabel(ambition: number, loyalty?: number): string {
  const character = ambition >= 67 ? '进取' : ambition <= 33 ? '谨慎' : '持中';
  return `${character}${loyalty === undefined ? '' : loyalty >= 75 ? ' · 忠诚较高' : loyalty <= 40 ? ' · 忠诚较低' : ' · 忠诚平稳'}`;
}
