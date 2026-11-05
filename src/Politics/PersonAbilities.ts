import type {MilitaryPerson} from './MilitaryCommandRegistry';
import type {Ruler} from './Dynasty';
/** Version 1 is identity-derived and consumes no WorldRandom. Never use name/faction/office. */
export type AbilitySource={kind:'RESIDENT';sourceUserId:number;bornMonth:number}|{kind:'ROYAL';rulerId:string;bornMonth:number};
export interface PersonAbilities {version:1;source:AbilitySource;command:number;strategy:number;}
export type AbilityPolicy='BASELINE'|'LOW'|'MEDIUM'|'HIGH';
export const DEFAULT_ABILITY_POLICY:AbilityPolicy='MEDIUM';
export const ABILITY_EFFECTS={BASELINE:{selection:0,attempt:0,success:0},LOW:{selection:.08,attempt:.05,success:.025},MEDIUM:{selection:.16,attempt:.10,success:.05},HIGH:{selection:.28,attempt:.18,success:.09}} as const;
export const isAbilityPolicy=(v:unknown):v is AbilityPolicy=>typeof v==='string'&&Object.prototype.hasOwnProperty.call(ABILITY_EFFECTS,v);
export function personAbilities(source:AbilitySource):PersonAbilities{
 const identity=source.kind==='RESIDENT'?`resident:${source.sourceUserId}:${source.bornMonth}`:`royal:${source.rulerId}:${source.bornMonth}`;
 const value=(label:string)=>{let h=2166136261;for(const ch of `person-abilities-v1:${label}:${identity}`)h=Math.imul(h^ch.charCodeAt(0),16777619)>>>0;return h%101;};
 return {version:1,source:{...source},command:value('command'),strategy:value('strategy')};
}
export function militaryAbilities(p:Pick<MilitaryPerson,'sourceUserId'|'bornMonth'|'royalIdentity'>){return personAbilities(p.royalIdentity?{kind:'ROYAL',rulerId:p.royalIdentity.rulerId,bornMonth:p.bornMonth}:{kind:'RESIDENT',sourceUserId:p.sourceUserId,bornMonth:p.bornMonth});}
export function rulerAbilities(r:Ruler,people:readonly MilitaryPerson[]){
 const ids=[r.militaryIdentity?.personId,r.militaryUsurperIdentity?.personId,r.residentIdentity?.military?.personId].filter(Boolean),p=people.find(p=>ids.includes(p.personId)&&p.bornMonth===r.bornYear);
 return p?militaryAbilities(p):personAbilities(r.residentIdentity?{kind:'RESIDENT',sourceUserId:r.residentIdentity.sourceUserId,bornMonth:r.bornYear}:{kind:'ROYAL',rulerId:r.id,bornMonth:r.bornYear});
}
/** Centered bounded effects; real eligibility/army remain mandatory upstream. */
export function abilityFactors(a:PersonAbilities|undefined,policy:AbilityPolicy='BASELINE'){
 const e=ABILITY_EFFECTS[policy],command=((a?.command??50)-50)/50,strategy=((a?.strategy??50)-50)/50;
 return {selection:1+e.selection*(command*.6+strategy*.4),attempt:1+e.attempt*strategy,successDelta:e.success*(strategy*.7+command*.3)};
}
