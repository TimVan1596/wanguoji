import {CIVIL_OFFICES,civilOfficeLevel,centralCivilOfficeAvailable} from './CivilOffice';
import type {CivilGovernorTerm,CivilPromotionEvidence} from './CivilAdministrationSchema';
import {personAbilities} from './PersonAbilities';
/** Receipts are real bounded city recoveries, never inferred from ability or elapsed years. */
export function civilPromotionEvidence(term:CivilGovernorTerm,month:number,loyalty:number,cities:number,terms:readonly CivilGovernorTerm[]):CivilPromotionEvidence|undefined{
 const level=civilOfficeLevel(term.office),next=CIVIL_OFFICES[level+1];
 if(!next||term.endMonth!==undefined||month%12!==0||!centralCivilOfficeAvailable(next,cities,terms,term.factionId))return;
 const strategy=personAbilities(term.royalRulerId?{kind:'ROYAL',rulerId:term.royalRulerId,bornMonth:term.bornMonth}:{kind:'RESIDENT',sourceUserId:term.sourceUserId,bornMonth:term.bornMonth}).strategy;
 const serviceMonths=month-term.startMonth,receipts=(term.receipts??[]).filter(r=>r.month<month||r.month===month),contribution=receipts.reduce((sum,r)=>sum+r.loyalty+r.devastation,0);
 if(serviceMonths<[36,60,72][level]||strategy<[55,65,75][level]||loyalty<[50,60,70][level]||receipts.length<[2,3,5][level]||contribution<[3,5,8][level])return;
 return {fromAssignmentId:term.assignmentId,fromOffice:term.office??'JUNSHOU',serviceMonths,meritEventIds:receipts.map(r=>r.eventId),contribution,strategy,loyalty};
}
