import type {NobleRank} from './MilitaryNobility';
export type CivilGovernancePolicy='BASELINE'|'LOW'|'MEDIUM'|'HIGH';
export const CIVIL_GOVERNANCE_POLICY:CivilGovernancePolicy='MEDIUM';
export const CIVIL_APPOINTMENT_CHANCE:Record<CivilGovernancePolicy,number>={BASELINE:0,LOW:.28,MEDIUM:.42,HIGH:.58};
export const CIVIL_CITY_STABILITY_MONTHS=24;
export const MAX_ACTIVE_CIVIL_GOVERNORS_PER_FACTION=3;
export const civilGovernanceThreshold=(policy:CivilGovernancePolicy)=>policy==='LOW'?72:policy==='HIGH'?48:60;
export const isCivilGovernancePolicy=(value:unknown):value is CivilGovernancePolicy=>typeof value==='string'&&Object.hasOwn(CIVIL_APPOINTMENT_CHANCE,value);
export type CivilGovernorSource='ORDINARY_RESIDENT'|'FAMILY'|'NOBLE'|'ROYAL'|'RETIRED_MILITARY';
export type CivilGovernorEndReason='DEATH'|'CITY_LOST'|'FACTION_ENDED'|'REGIME_ENDED'|'POLITICAL_SANCTION'|'MILITARY_OFFICE'|'REPLACED'|'IDENTITY_ENDED';
export interface CivilGovernorTerm {
 version:1;assignmentId:string;personId:string;sourceUserId:number;bornMonth:number;personalName:string;
 identitySource:CivilGovernorSource;familyId?:string;familyMemberId?:string;royalRulerId?:string;
 factionId:string;countryName:string;epochFounderId:string;cityId:string;cityName:string;
 rulerId:string;rulerTitle:string;startMonth:number;appointEventId:string;
 endMonth?:number;endReason?:CivilGovernorEndReason;endEventId?:string;
 lastEffectMonth?:number;loyaltyRecovered:number;devastationRecovered:number;meritMonth?:number;meritEventId?:string;
 meritLoyaltyRecovered?:number;meritDevastationRecovered?:number;
}
export interface CivilAdministrationState {version:1;sequence:number;lastEvaluationMonth:number;policy:CivilGovernancePolicy;terms:CivilGovernorTerm[];}
export interface CivilGovernorCandidate {
 personId:string;sourceUserId:number;bornMonth:number;personalName:string;identitySource:CivilGovernorSource;
 familyId?:string;familyMemberId?:string;royalRulerId?:string;nobleRank?:NobleRank;strategy:number;weight:number;
}
