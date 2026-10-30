import {validMilitaryDisposition, type MilitaryDisposition} from './MilitaryPoliticalDisposition';

export interface MilitaryClaimSupport {
  personId: string; name: string; disposition: MilitaryDisposition;
  rulerId: string; rulerName: string; basis: 'KINSHIP' | 'SENIORITY'; bonus: number;
}
interface Claim {rulerId:string;name:string;relation:string;bornMonth:number;militaryAdvantage?:number}
const kinship:Record<string,number>={DIRECT_CHILD:6,GRANDCHILD:5,SIBLING:4,NEPHEW:3,UNCLE:2,COUSIN:1};
/** Only compares an already validated set of legal adult kin. No claimant or relationship is created.
 * A restrained loyal participant prefers nearer kin; an assertive one prefers an established adult.
 * This records the actual support decision, not an assertion of kinship or hidden motives. */
export function chooseMilitaryClaimSupport(candidates:readonly Claim[],personId:string,name:string,disposition:MilitaryDisposition):MilitaryClaimSupport|undefined {
  if(!candidates.length)return;
  const basis=disposition.loyalty>=disposition.ambition?'KINSHIP':'SENIORITY';
  const ordered=[...candidates].sort((a,b)=>(basis==='KINSHIP'?kinship[b.relation]-kinship[a.relation]:a.bornMonth-b.bornMonth)||a.rulerId.localeCompare(b.rulerId));
  const c=ordered[0];
  return {personId,name,disposition:structuredClone(disposition),rulerId:c.rulerId,rulerName:c.name,basis,bonus:.05+Math.min(3,disposition.prestige)*.025};
}
export function validMilitaryClaimSupport(value:MilitaryClaimSupport, candidates:readonly Claim[], bornMonth:number):boolean {
  return !!value && validMilitaryDisposition(value.disposition,value.personId,bornMonth,value.disposition?.prestige) &&
    JSON.stringify(value)===JSON.stringify(chooseMilitaryClaimSupport(candidates,value.personId,value.name,value.disposition));
}
