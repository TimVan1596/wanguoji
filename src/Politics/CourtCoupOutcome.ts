import {abilityFactors,type AbilityPolicy} from './PersonAbilities';
import type {MilitaryPoliticalParticipant} from './MilitaryPoliticalInfluence';
import type {DepositionEvaluation} from './InReignDeposition';
import type {MilitaryPerson} from './MilitaryCommandRegistry';
import {chooseMilitaryClaimSupport} from './MilitaryClaimSupport';
import {MILITARY_OFFICES} from './MilitaryOffice';
export type CourtSuccessPolicy='LOW'|'MEDIUM'|'HIGH';
export interface CourtTarget {rulerId:string;name:string;bornMonth:number;relation:string;basis:'SELF'|'KINSHIP'|'SENIORITY';}
/** A political goal is selected before the draw from actual existing adult kin. */
export function chooseCourtTarget(e:DepositionEvaluation,c:MilitaryPoliticalParticipant,p:MilitaryPerson):CourtTarget|undefined{
 const own=p.royalIdentity&&e.candidates.find(x=>x.ruler.id===p.royalIdentity!.rulerId),d=c.disposition;if(!d)return;
 const rows=e.candidates.map(x=>({rulerId:x.ruler.id,name:x.ruler.houseName.replace(/氏$/,'')+x.ruler.givenName,bornMonth:x.ruler.bornYear,relation:x.relation}));
 if(own&&d.ambition>=d.loyalty)return {...rows.find(x=>x.rulerId===own.ruler.id)!,basis:'SELF'};
 const support=chooseMilitaryClaimSupport(rows,c.personId,c.personalName??c.name,d);if(!support)return;
 return {...rows.find(x=>x.rulerId===support.rulerId)!,basis:support.basis};
}
/** Conditional success AFTER an actual attempt, independent of the old spontaneous-deposition risk. */
export function courtSuccessChance(c:MilitaryPoliticalParticipant,stability:number,crisisCount:number,target:CourtTarget,policy:CourtSuccessPolicy='MEDIUM',abilityPolicy:AbilityPolicy='BASELINE'){
 const d=c.disposition;if(!d||!c.officeStanding)return 0;
 const kin=target.relation==='DIRECT_CHILD'?.02:target.relation==='SIBLING'?.015:.005;
 const raw=.025+c.strength*.025+c.unitCount*.02+Math.min(3,crisisCount)*.015+(100-stability)*.001+d.ambition*.0003+(100-d.loyalty)*.0002+Math.max(0,MILITARY_OFFICES.indexOf(c.officeStanding.office))*.01+kin;
 return Math.max(.06,Math.min(.60,raw*({LOW:.6,MEDIUM:1,HIGH:1.4}[policy])+abilityFactors(c.abilities,abilityPolicy).successDelta));
}
