import type { Ruler } from './Dynasty';
/** Formal royal acts are independent of military bans. A change of monarch does not erase them. */
export interface RoyalSuccessionAct {
  eventId: string; kind: 'DISQUALIFIED' | 'RESTORED'; month: number;
  factionId: string; rulerId: string; militaryPersonId: string; issuerRulerId: string;
  courtCoupEventId: string; sourceEventId: string; restoresEventId?: string;
}
export function unresolvedSuccessionAct(ruler: Pick<Ruler,'successionHistory'>, month: number) {
  const acts = (ruler.successionHistory ?? []).filter(a => a.month <= month);
  return acts.find(a => a.kind === 'DISQUALIFIED' && !acts.some(b => b.kind === 'RESTORED' && b.restoresEventId === a.eventId));
}
export function maySucceed(ruler: Pick<Ruler,'successionHistory'>, month: number) {
  return !unresolvedSuccessionAct(ruler, month);
}
