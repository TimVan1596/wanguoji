import type {MilitaryFamily,MilitaryFamilyMember} from './MilitaryFamily';
import {familyNobleTitle} from './FamilyNobleSuccession';
export const HEREDITARY_RECRUITMENT_POLICIES=['BASELINE','LOW','MEDIUM'] as const;
export type HereditaryRecruitmentPolicy=typeof HEREDITARY_RECRUITMENT_POLICIES[number];
export function isHereditaryRecruitmentPolicy(x:unknown):x is HereditaryRecruitmentPolicy{return HEREDITARY_RECRUITMENT_POLICIES.includes(x as HereditaryRecruitmentPolicy);}
/** A title is social standing, never a command. Benefits overlap by maximum, not multiplication. */
export function hereditaryAppointmentWeight(f:MilitaryFamily|undefined,m:MilitaryFamilyMember|undefined,factionId:string,epoch:string|undefined,month:number,base:number,policy:HereditaryRecruitmentPolicy){
 if(policy==='BASELINE'||!f||!m||f.factionId!==factionId||f.epochFounderId!==epoch||m.militaryPersonId)return base;
 const title=familyNobleTitle(f,m,month),weight=title?({'公爵':3,'侯爵':2.5,'伯爵':2,'子爵':1.5,'男爵':1.25}[title]??1):1;
 return Math.max(base,weight);
}
/** The ordinary 5% window remains intact. A single bounded vacancy window is experimental. */
export function hereditaryVacancyChance(policy:HereditaryRecruitmentPolicy,hasQualifiedTitle:boolean){return policy==='MEDIUM'&&hasQualifiedTitle ? .095 : 0;}
