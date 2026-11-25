import {CIVIL_OFFICES,civilOfficeLevel,centralCivilOfficeAvailable} from './CivilOffice';
import type {CivilGovernorTerm,CivilPromotionEvidence} from './CivilAdministrationSchema';
import {civilAbilitySource,personAbilities} from './PersonAbilities';
export const CIVIL_PROMOTION_BLOCKS:Record<string,string>={HIGHEST:'已至最高文职',INACTIVE:'任期已经结束',MONTH:'尚非年度选拔月份',VACANCY:'中央官额或对应职位尚无空缺',TENURE:'本职任职资历尚不足',STRATEGY:'谋略未达该级门槛',LOYALTY:'当时忠诚未达门槛',MERIT:'恢复治绩与守成考课尚不足'};
export function civilPromotionFacts(term:CivilGovernorTerm,month:number,loyalty:number,cities:number,terms:readonly CivilGovernorTerm[]){
 const level=civilOfficeLevel(term.office),next=CIVIL_OFFICES[level+1],strategy=personAbilities(civilAbilitySource(term)).strategy;
 const assessments=(term.stewardshipAssessments??[]).filter(a=>a.month<=month),receipts=(term.receipts??[]).filter(r=>r.month<=month),serviceMonths=month-term.startMonth,contribution=receipts.reduce((sum,r)=>sum+r.loyalty+r.devastation,0)+assessments.reduce((sum,a)=>sum+a.contribution,0),reasons:string[]=[];
 if(!next)reasons.push('HIGHEST');if(term.endMonth!==undefined)reasons.push('INACTIVE');if(month%12!==0)reasons.push('MONTH');
 if(next&&!centralCivilOfficeAvailable(next,cities,terms,term.factionId))reasons.push('VACANCY');
 if(next){if(serviceMonths<[36,60,72][level])reasons.push('TENURE');if(strategy<[55,65,75][level])reasons.push('STRATEGY');if(loyalty<[50,60,70][level])reasons.push('LOYALTY');if(receipts.length+assessments.length<[2,3,5][level]||contribution<[3,5,8][level])reasons.push('MERIT');}
 return {reasons,assessments,receipts,serviceMonths,strategy,contribution};
}
/** Recovery and the weaker stable-service assessment are distinct, sourced contributions. */
export function civilPromotionEvidence(term:CivilGovernorTerm,month:number,loyalty:number,cities:number,terms:readonly CivilGovernorTerm[]):CivilPromotionEvidence|undefined{
 const f=civilPromotionFacts(term,month,loyalty,cities,terms);if(f.reasons.length)return;
 const stewardshipEventIds=f.assessments.map(a=>a.eventId);
 return {...(stewardshipEventIds.length?{stewardshipEventIds}:{}),fromAssignmentId:term.assignmentId,fromOffice:term.office??'JUNSHOU',serviceMonths:f.serviceMonths,meritEventIds:f.receipts.map(r=>r.eventId),contribution:f.contribution,strategy:f.strategy,loyalty};
}
