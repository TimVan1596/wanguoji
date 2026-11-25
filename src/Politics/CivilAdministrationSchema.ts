import type {CivilCareerPolicy,CivilStewardshipWindow,CivilStewardshipAssessment,CivilRetirementEvidence} from './CivilCareerRules';
import type {CivilOffice} from './CivilOffice';
import type {NobleRank} from './MilitaryNobility';
export type CivilGovernancePolicy='BASELINE'|'LOW'|'MEDIUM'|'HIGH';
export const CIVIL_GOVERNANCE_POLICY:CivilGovernancePolicy='MEDIUM';
export const CIVIL_APPOINTMENT_CHANCE:Record<CivilGovernancePolicy,number>={BASELINE:0,LOW:.28,MEDIUM:.42,HIGH:.58};
export const CIVIL_CITY_STABILITY_MONTHS=24;
export const MAX_ACTIVE_CIVIL_GOVERNORS_PER_FACTION=3;
export const civilGovernanceThreshold=(policy:CivilGovernancePolicy)=>policy==='LOW'?72:policy==='HIGH'?48:60;
export const isCivilGovernancePolicy=(value:unknown):value is CivilGovernancePolicy=>typeof value==='string'&&Object.hasOwn(CIVIL_APPOINTMENT_CHANCE,value);
export type CivilGovernorSource='ORDINARY_RESIDENT'|'FAMILY'|'NOBLE'|'ROYAL'|'RETIRED_MILITARY';
export type CivilGovernorEndReason='DEATH'|'CITY_LOST'|'FACTION_ENDED'|'REGIME_ENDED'|'POLITICAL_SANCTION'|'MILITARY_OFFICE'|'REPLACED'|'IDENTITY_ENDED'|'PROMOTED'|'TRANSFERRED'|'RETIREMENT';
export interface CivilGovernanceReceipt {eventId:string;month:number;cityId:string;cityName:string;loyalty:number;devastation:number;}
export interface CivilPromotionEvidence {stewardshipEventIds?:string[];fromAssignmentId:string;fromOffice:CivilOffice;serviceMonths:number;meritEventIds:string[];contribution:number;strategy:number;loyalty:number;}
export interface CivilPromotionReview {month:number;historyIndex:number;cityCount:number;loyalty:number;policy:CivilCareerPolicy;reasons:string[];outcome:'INELIGIBLE'|'CHANCE_NOT_MET'|'NOT_SELECTED'|'SELECTED';selectedAssignmentId?:string;sharedRoll?:number;}
/** Two completed appraisal periods can qualify a stable posting for transfer. */
export const civilTransferStewardship = (term:CivilGovernorTerm,month:number) =>
 (term.stewardshipAssessments??[]).filter(record=>record.month<month).map(record=>record.eventId);
export const hasCivilTransferMerit = (term:CivilGovernorTerm,month:number) =>
 (term.meritMonth!==undefined&&term.meritMonth<=month&&!!term.meritEventId) ||
 civilTransferStewardship(term,month).length>=2;
export function civilTransferDemand(loyalty:number,devastation:number):"HIGH"|"MEDIUM"|undefined {
 return loyalty<50||devastation>=40?'HIGH':loyalty<65||devastation>=20?'MEDIUM':undefined;
}
export interface CivilGovernorTerm {
 promotionReview?:CivilPromotionReview;
 stewardshipWindow?:CivilStewardshipWindow;stewardshipAssessments?:CivilStewardshipAssessment[];retirement?:CivilRetirementEvidence;
 transfer?:{demand?:ReturnType<typeof civilTransferDemand>;fromAssignmentId:string;meritEventIds:string[];stewardshipEventIds:string[];sourceLoyalty:number;sourceDevastation:number;targetLoyalty:number;targetDevastation:number};
 office?:CivilOffice;promotion?:CivilPromotionEvidence;receipts?:CivilGovernanceReceipt[];
 nameEvidence:{seed:string;culture:import('./NameCulture').NameCulture;originalName:string;source:'GENERATED'|'ESTABLISHED'};
 version:1;assignmentId:string;personId:string;sourceUserId:number;bornMonth:number;personalName:string;
 identitySource:CivilGovernorSource;familyId?:string;familyMemberId?:string;royalRulerId?:string;
 factionId:string;countryName:string;epochFounderId:string;cityId?:string;cityName?:string;
 rulerId:string;rulerTitle:string;startMonth:number;appointEventId:string;
 endMonth?:number;endReason?:CivilGovernorEndReason;endEventId?:string;
 lastEffectMonth?:number;loyaltyRecovered:number;devastationRecovered:number;meritMonth?:number;meritEventId?:string;
 meritLoyaltyRecovered?:number;meritDevastationRecovered?:number;
}
export interface CivilAdministrationState {careerPolicy?:CivilCareerPolicy;version:1;sequence:number;lastEvaluationMonth:number;policy:CivilGovernancePolicy;terms:CivilGovernorTerm[];}
export interface CivilGovernorCandidate {
 personId:string;sourceUserId:number;bornMonth:number;personalName:string;identitySource:CivilGovernorSource;
 familyId?:string;familyMemberId?:string;royalRulerId?:string;nobleRank?:NobleRank;strategy:number;weight:number;
}
