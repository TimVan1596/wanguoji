import {civilAbilitySource,personHealth} from './PersonAbilities';
import type {CivilGovernorTerm} from './CivilAdministrationSchema';
import {WorldRandom} from '../Simulation/WorldRandom';
export type CivilCareerPolicy='BASELINE'|'LOW'|'MEDIUM';
export const CIVIL_CAREER_POLICY:CivilCareerPolicy='LOW';
export interface CivilStabilitySample {month:number;loyalty:number;devastation:number;historyIndex:number;}
export interface CivilStewardshipWindow {cityId:string;cityName:string;controlledSince:number;samples:CivilStabilitySample[];}
export interface CivilStewardshipAssessment extends CivilStewardshipWindow {eventId:string;assignmentId:string;month:number;policy:CivilCareerPolicy;contribution:number;}
export interface CivilRetirementEvidence {month:number;ageMonths:number;serviceMonths:number;health?:number;policy:CivilCareerPolicy;chance:number;roll:number;seed:string;}
export const civilPromotionChance=(policy:CivilCareerPolicy)=>policy==='MEDIUM'?.25:.35;
export const stewardshipInterval=36;
export function stewardshipContribution(policy:CivilCareerPolicy){return policy==='BASELINE'?0:1.5;}
export function validStewardshipWindow(w:CivilStewardshipWindow,startMonth:number,endMonth:number,complete=true){
 return (complete?w.samples.length===stewardshipInterval:w.samples.length>0&&w.samples.length<stewardshipInterval)&&w.controlledSince<=w.samples[0].month&&w.samples[0].month>startMonth&&w.samples.at(-1)!.month===endMonth&&w.samples.every((s,i)=>Number.isSafeInteger(s.month)&&s.month===w.samples[0].month+i&&Number.isFinite(s.loyalty)&&s.loyalty>=75&&s.loyalty<=100&&Number.isFinite(s.devastation)&&s.devastation>=0&&s.devastation<=5&&Number.isSafeInteger(s.historyIndex)&&s.historyIndex>=0&&(!i||s.historyIndex>=w.samples[i-1].historyIndex));
}
/** Named local draw: no lifespan change, world RNG draw, fictional successor or automatic office. */
export function civilRetirementEvidence(term:CivilGovernorTerm,month:number,worldSeed:string,policy:CivilCareerPolicy):CivilRetirementEvidence|undefined{
 const ageMonths=month-term.bornMonth,serviceMonths=month-term.startMonth;
 if(policy==='BASELINE'||month%12!==0||ageMonths<65*12||serviceMonths<60||term.endMonth!==undefined)return;
 const source=civilAbilitySource(term);
 const health=personHealth(source,month);
 const baseChance=ageMonths>=80*12?.65:ageMonths>=75*12?.3:ageMonths>=70*12?.12:.04;
 const chance=Math.min(.70,baseChance+Math.max(0,65-(health??65))*.002),seed=`civil-retirement-v1:${worldSeed}:${term.assignmentId}:${month}`,rng=new WorldRandom();rng.initialize(seed);const roll=rng.next();
 return {month,ageMonths,serviceMonths,health,policy,chance,roll,seed};
}
