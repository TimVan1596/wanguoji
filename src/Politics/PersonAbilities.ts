import type {MilitaryPerson} from './MilitaryCommandRegistry';
import type {Ruler} from './Dynasty';
import type {MilitaryFamilyMember} from './MilitaryFamily';
/** Version 1 is identity-derived and consumes no WorldRandom. Never use name/faction/office. */
export type AbilitySource={kind:'RESIDENT';sourceUserId:number;bornMonth:number}|{kind:'ROYAL';rulerId:string;bornMonth:number}|{kind:'FAMILY_BIRTH';memberId:string;bornMonth:number};
export interface PersonAbilities {version:1;source:AbilitySource;command:number;strategy:number;}
export type AbilityPolicy='BASELINE'|'LOW'|'MEDIUM'|'HIGH';
export const DEFAULT_ABILITY_POLICY:AbilityPolicy='MEDIUM';
export const ABILITY_EFFECTS={BASELINE:{selection:0,attempt:0,success:0},LOW:{selection:.08,attempt:.05,success:.025},MEDIUM:{selection:.16,attempt:.10,success:.05},HIGH:{selection:.28,attempt:.18,success:.09}} as const;
export const isAbilityPolicy=(v:unknown):v is AbilityPolicy=>typeof v==='string'&&Object.prototype.hasOwnProperty.call(ABILITY_EFFECTS,v);
const sourceKey=(source:AbilitySource)=>source.kind==='RESIDENT'?source.sourceUserId:source.kind==='ROYAL'?source.rulerId:source.memberId;
const identityKey=(source:AbilitySource)=>`${source.kind.toLowerCase()}:${sourceKey(source)}:${source.bornMonth}`;
export function familyMemberAbilitySource(member:MilitaryFamilyMember):AbilitySource|undefined{
 if(member.birth)return {kind:'FAMILY_BIRTH',memberId:member.memberId,bornMonth:member.bornMonth};
 if(member.sourceUserId!==undefined)return {kind:'RESIDENT',sourceUserId:member.sourceUserId,bornMonth:member.bornMonth};
}
export function residentAbilitySource(sourceUserId:number,bornMonth:number,member?:MilitaryFamilyMember):AbilitySource{
 return member?.birth&&member.bornMonth===bornMonth&&member.sourceUserId===sourceUserId?{kind:'FAMILY_BIRTH',memberId:member.memberId,bornMonth}:{kind:'RESIDENT',sourceUserId,bornMonth};
}
export function civilAbilitySource(term:{bornMonth:number;sourceUserId:number;royalRulerId?:string;familyBirthAbilityId?:string}):AbilitySource{
 if(term.royalRulerId)return {kind:'ROYAL',rulerId:term.royalRulerId,bornMonth:term.bornMonth};
 if(term.familyBirthAbilityId)return {kind:'FAMILY_BIRTH',memberId:term.familyBirthAbilityId,bornMonth:term.bornMonth};
 return {kind:'RESIDENT',sourceUserId:term.sourceUserId,bornMonth:term.bornMonth};
}
export function personAbilities(source:AbilitySource):PersonAbilities{
 const identity=identityKey(source);
 const value=(label:string)=>{let h=2166136261;for(const ch of `person-abilities-v1:${label}:${identity}`)h=Math.imul(h^ch.charCodeAt(0),16777619)>>>0;return h%101;};
 return {version:1,source:{...source},command:value('command'),strategy:value('strategy')};
}
export function militaryAbilities(p:Pick<MilitaryPerson,'sourceUserId'|'bornMonth'|'royalIdentity'|'familyLife'>){return personAbilities(p.royalIdentity?{kind:'ROYAL',rulerId:p.royalIdentity.rulerId,bornMonth:p.bornMonth}:p.familyLife?{kind:'FAMILY_BIRTH',memberId:p.familyLife.memberId,bornMonth:p.bornMonth}:{kind:'RESIDENT',sourceUserId:p.sourceUserId,bornMonth:p.bornMonth});}
export function rulerAbilities(r:Ruler,people:readonly MilitaryPerson[],familyMember?:MilitaryFamilyMember){
 const ids=[r.militaryIdentity?.personId,r.militaryUsurperIdentity?.personId,r.residentIdentity?.military?.personId].filter(Boolean),p=people.find(p=>ids.includes(p.personId)&&p.bornMonth===r.bornYear);
 return p?militaryAbilities(p):personAbilities(r.residentIdentity?residentAbilitySource(r.residentIdentity.sourceUserId,r.bornYear,familyMember):{kind:'ROYAL',rulerId:r.id,bornMonth:r.bornYear});
}
/** Centered bounded effects; real eligibility/army remain mandatory upstream. */
export function abilityFactors(a:PersonAbilities|undefined,policy:AbilityPolicy='BASELINE'){
 const e=ABILITY_EFFECTS[policy],command=((a?.command??50)-50)/50,strategy=((a?.strategy??50)-50)/50;
 return {selection:1+e.selection*(command*.6+strategy*.4),attempt:1+e.attempt*strategy,successDelta:e.success*(strategy*.7+command*.3)};
}

/** Permanent political personality. Same source as command/strategy, no office or world RNG. */
export function personAmbition(source:AbilitySource){
 const identity=identityKey(source);
 let h=2166136261;for(const ch of `person-ambition-v2:${identity}`)h=Math.imul(h^ch.charCodeAt(0),16777619)>>>0;return h%101;
}

/** A derived observation. No health history, lifespan prediction, or world random draw. */
export function personHealth(source:AbilitySource,month:number,deathMonth?:number){
 const at=Math.min(month,deathMonth??month);
 if(!Number.isSafeInteger(at)||at<source.bornMonth)return undefined;
 const identity=sourceKey(source);
 let hash=2166136261;
 for(const ch of `person-constitution-v1:${source.kind}:${identity}:${source.bornMonth}`)hash=Math.imul(hash^ch.charCodeAt(0),16777619)>>>0;
 const age=(at-source.bornMonth)/12;
 const decline=Math.max(0,age-50)*.85+Math.max(0,age-70)*1.15;
 return Math.max(0,Math.min(100,Math.round(76+hash%25-decline)));
}

export function appointmentHealthFactor(source:AbilitySource,month:number){
 return .92+.08*(personHealth(source,month)??100)/100;
}
