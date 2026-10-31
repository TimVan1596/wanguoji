import type {DepositionEvaluation} from './InReignDeposition';
import type {MilitaryPoliticalParticipant} from './MilitaryPoliticalInfluence';
import type {MilitaryPerson} from './MilitaryCommandRegistry';
import {willingCourtParticipant} from './MilitaryPoliticalDisposition';
/** One shared annual country opportunity. These bounds add actual failed actions, not extra success rolls. */
export const COURT_ATTEMPT_PARAMETERS={LOW:.08,MEDIUM:.15,HIGH:.25} as const;
export type CourtAttemptPolicy=keyof typeof COURT_ATTEMPT_PARAMETERS;
export function selectCourtInstigator(e:DepositionEvaluation,people:readonly MilitaryPerson[]){
 if(!e.eligible)return;
 const candidates=[...(e.royalMilitaryClaims??[]).map(c=>({...c.participant,officeStanding:{office:c.office,eventId:c.officeEventId,appointmentEventId:c.appointmentEventId}})),...(e.military?.candidates??[])];
 return candidates.filter(c=>{const p=people.find(p=>p.personId===c.personId);return p&&p.status==='ACTIVE'&&p.factionId===c.factionId&&p.deathMonth===undefined&&!p.politicalRulerId&&c.officeStanding&&c.unitCount>=2&&c.serviceMonths>=12&&c.disposition&&willingCourtParticipant(c.disposition)&&c.disposition.ambition>c.disposition.loyalty;})
 .sort((a,b)=>(b.politicalSelectionWeight??b.strength)-(a.politicalSelectionWeight??a.strength)||a.personId.localeCompare(b.personId))[0];
}
export interface CourtCoupRecord {
 version:1;factionId:string;month:number;previousRulerId:string;targetRulerId:string;
 participant:MilitaryPoliticalParticipant;crisisEventIds:string[];stability:number;cityCount:number;
 policy:CourtAttemptPolicy;attemptProbability:number;successProbability:number;roll:number;
 outcome:'SUCCESS'|'FAILED';outcomeEventId:string;consequence:'DEPOSITION'|'DISMISSED';
}
export function courtAttemptOutcome(e:DepositionEvaluation,actor:MilitaryPoliticalParticipant|undefined,roll:number,policy:CourtAttemptPolicy='MEDIUM'){
 if(!e.eligible||!actor||!Number.isFinite(roll)||roll<0||roll>=COURT_ATTEMPT_PARAMETERS[policy])return;
 return roll<e.probability?'SUCCESS' as const:'FAILED' as const;
}
