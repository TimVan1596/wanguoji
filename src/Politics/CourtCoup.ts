import type {DepositionEvaluation} from './InReignDeposition';
import type {MilitaryPoliticalEvidence,MilitaryPoliticalParticipant} from './MilitaryPoliticalInfluence';
import type {MilitaryPerson} from './MilitaryCommandRegistry';
import {willingCourtParticipant} from './MilitaryPoliticalDisposition';
/** Test-only scales around the official medium policy; one country opportunity, no per-person draws. */
export const COURT_ATTEMPT_PARAMETERS={LOW:.08,MEDIUM:.15,HIGH:.25} as const;
export type CourtAttemptPolicy=keyof typeof COURT_ATTEMPT_PARAMETERS;
/** Attempts can challenge a robust court after a real crisis. All other old safety gates stay intact. */
export function courtAttemptEligible(e:DepositionEvaluation){
 return e.eligible||e.blockers.length>0&&e.blockers.every(b=>b==='NO_CURRENT_VULNERABILITY');
}
export function courtAttemptChance(c:MilitaryPoliticalParticipant,policy:CourtAttemptPolicy='MEDIUM'){
 const d=c.disposition;if(!d)return 0;
 return Math.min(.25,Math.max(.04,(.05+d.ambition*.0008+(100-d.loyalty)*.001+Math.min(3,c.strength)*.01)*COURT_ATTEMPT_PARAMETERS[policy]/.15));
}
export function selectCourtInstigator(e:DepositionEvaluation,people:readonly MilitaryPerson[],influence?:MilitaryPoliticalEvidence){
 if(!courtAttemptEligible(e))return;
 const candidates=influence?.candidates??[...(e.royalMilitaryClaims??[]).map(c=>({...c.participant,officeStanding:{office:c.office,eventId:c.officeEventId,appointmentEventId:c.appointmentEventId}})),...(e.military?.candidates??[])];
 return candidates.filter(c=>{const p=people.find(p=>p.personId===c.personId);return p&&p.status==='ACTIVE'&&p.factionId===c.factionId&&p.deathMonth===undefined&&!p.politicalRulerId&&c.officeStanding&&c.unitCount>=2&&c.serviceMonths>=12&&c.disposition&&willingCourtParticipant(c.disposition);})
 .sort((a,b)=>(b.politicalSelectionWeight??b.strength)-(a.politicalSelectionWeight??a.strength)||a.personId.localeCompare(b.personId))[0];
}
export interface CourtCoupRecord {
 version:2;successEligible:boolean;depositionBlockers:string[];factionId:string;month:number;previousRulerId:string;targetRulerId:string;
 members:Array<{unitId:string;userId:number;bornMonth:number;factionId:string}>;participant:MilitaryPoliticalParticipant;successPressure?:MilitaryPoliticalParticipant;crisisEventIds:string[];stability:number;cityCount:number;
 policy:CourtAttemptPolicy;attemptProbability:number;successProbability:number;roll:number;
 outcome:'SUCCESS'|'FAILED';outcomeEventId:string;consequence:'DEPOSITION'|'DISMISSED';
}
export function courtAttemptOutcome(e:DepositionEvaluation,actor:MilitaryPoliticalParticipant|undefined,roll:number,policy:CourtAttemptPolicy='MEDIUM'){
 if(!courtAttemptEligible(e)||!actor||!Number.isFinite(roll)||roll<0||roll>=courtAttemptChance(actor,policy))return;
 return e.eligible&&roll<e.probability?'SUCCESS' as const:'FAILED' as const;
}
