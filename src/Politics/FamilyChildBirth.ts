import {WorldRandom} from '../Simulation/WorldRandom';
import {createNaturalDeathMonth} from './RulerLifespanRules';
import {deriveNameCulture,hanGivenNamePool,cultureGivenNamePools} from './NameCulture';
import {pickRulerGivenName} from './SuccessionRules';
export type FamilyBirthPolicy='BASELINE'|'LOW'|'MEDIUM'|'HIGH';
export const FAMILY_BIRTH_CHANCE={BASELINE:0,LOW:.035,MEDIUM:.065,HIGH:.10} as const;
export const isFamilyBirthPolicy=(v:unknown):v is FamilyBirthPolicy=>typeof v==='string'&&Object.hasOwn(FAMILY_BIRTH_CHANCE,v);
export const FAMILY_CHILD_LIMIT=2,FAMILY_LIVING_CHILD_LIMIT=8,FAMILY_ANNUAL_BIRTH_LIMIT=1,COUNTRY_ANNUAL_FAMILY_BIRTH_LIMIT=2;
export interface FamilyChildBirth {
 version:1;eventId:string;familyId:string;parentMemberId:string;factionId:string;epochFounderId:string;
 month:number;opportunityMonth:number;policy:FamilyBirthPolicy;ticket:number;basisEventId:string;naturalDeathMonth:number;
}
export interface FamilyBirthParent {memberId:string;bornMonth:number;enteredMonth:number;deathMonth?:number;basisEventId:string;}
/** Pure current-month opportunity. No User allocation, world RNG, spouse or retrospective child. */
export function planFamilyChildBirth(f:{familyId:string;surname:string;factionId:string;epochFounderId:string;foundedMonth:number},parent:FamilyBirthParent,month:number,seed:string,policy:FamilyBirthPolicy){
 if(!Number.isSafeInteger(month)||month<12||month<f.foundedMonth||month<parent.enteredMonth||month-parent.bornMonth<240||month-parent.bornMonth>600||(parent.deathMonth??Infinity)<=month)return;
 const opportunityMonth=Math.floor(month/12)*12,key=`family-child-v1:${seed}:${f.familyId}:${parent.memberId}:${parent.bornMonth}:${opportunityMonth}`,delivery=new WorldRandom();delivery.initialize(key+':delivery');
 if(month!==opportunityMonth+delivery.pickIndex(12))return;
 const rng=new WorldRandom();rng.initialize(key);const ticket=rng.next();if(ticket>=FAMILY_BIRTH_CHANCE[policy])return;
 const culture=deriveNameCulture(f.surname+'氏'),pool=culture==='HAN'?hanGivenNamePool:{...cultureGivenNamePools[culture],singleNames:[],doubleNamePrefixes:[],doubleNameSuffixes:[],doubleNameChancePercent:0};
 const memberId=`${f.familyId}-child-${month}`,name=f.surname+pickRulerGivenName(pool,[],max=>rng.pickIndex(max));
 // Only newly born abstract children use this fixed life plan; existing User lives are unchanged.
 const early=rng.next()<.04,naturalDeathMonth=early?month+12+rng.pickIndex(17*12):createNaturalDeathMonth(month,max=>rng.pickIndex(max));
 const birth:FamilyChildBirth={version:1,eventId:`${memberId}-born`,familyId:f.familyId,parentMemberId:parent.memberId,factionId:f.factionId,epochFounderId:f.epochFounderId,month,opportunityMonth,policy,ticket,basisEventId:parent.basisEventId,naturalDeathMonth};
 return {memberId,name,bornMonth:month,parentMemberId:parent.memberId,enteredMonth:month,birth};
}

import type {MilitaryFamily} from './MilitaryFamily';
import type {FamilyNobleContext} from './FamilyNobleSuccession';
import {familyMemberPresent,familyResidenceAt} from './FamilyNobleSuccession';
import {currentNobleGrant} from './MilitaryNobility';
/** Current lawful title or actual military service, never surname matching or a future claimant. */
export function familyBirthParents(f:MilitaryFamily,c:FamilyNobleContext){
 if(f.foundedMonth>c.month||!c.activeEpochs.has(`${f.factionId}/${f.epochFounderId}`))return [];
 const children=new Map<string,typeof f.members>();let living=0;
 for(const m of f.members){if(familyMemberPresent(m,c.month))living++;if(m.parentMemberId){const rows=children.get(m.parentMemberId)??[];rows.push(m);children.set(m.parentMemberId,rows);}}
 if(living>=FAMILY_LIVING_CHILD_LIMIT)return [];
 const last=f.nobleSuccession?.filter(a=>a.month<=c.month).at(-1),ids=new Set(c.events.map(e=>e.id));
 return f.members.flatMap(m=>{
  if(!familyMemberPresent(m,c.month)||familyResidenceAt(f,m,c.month)!==f.factionId||m.bornMonth+240>c.month||m.bornMonth+600<c.month||(children.get(m.memberId)?.length??0)>=FAMILY_CHILD_LIMIT||(children.get(m.memberId)??[]).some(ch=>c.month-ch.enteredMonth<48)||(c.politicalAccessions.get(m.memberId)??Infinity)<=c.month)return [];
  const p=c.people.find(p=>p.personId===m.militaryPersonId);if(p&&(p.factionId!==f.factionId||p.deathMonth!==undefined||p.politicalRulerId||p.politicalHistory?.some(a=>a.kind==='COURT_BAN'&&['FORFEITURE','EXECUTION'].includes(a.severity)&&a.month<=c.month)))return [];
  const inherited=last?.kind==='SUCCEEDED'&&last.holderMemberId===m.memberId?last:undefined,g=p?currentNobleGrant(p,f.factionId,c.month,f.epochFounderId):undefined,a=p?.status==='ACTIVE'?p.appointments.find(a=>a.factionId===f.factionId&&a.endMonth===undefined&&a.startMonth<=c.month):undefined;
  const basisEventId=inherited?.eventId??g?.eventId??(a?`military-appointment-${a.commandId}`:undefined);if(!basisEventId||!ids.has(basisEventId))return [];
  return [{member:m,basisEventId,holder:!!inherited||!!g}];
 }).sort((a,b)=>Number(b.holder)-Number(a.holder)||a.member.bornMonth-b.member.bornMonth||a.member.memberId.localeCompare(b.member.memberId));
}
/** An existing natural-growth slot may materialize one already-born adult; it never adds a slot. */
export function familyChildForPopulationEntry(families:readonly MilitaryFamily[],factionId:string,epoch:string|undefined,userId:number,month:number,seed:string){
 const rng=new WorldRandom();rng.initialize(`family-child-entry-v1:${seed}:${userId}:${month}`);if(rng.next()>=.25)return;
 return families.filter(f=>f.factionId===factionId&&f.epochFounderId===epoch).flatMap(f=>f.members.filter(m=>m.birth&&m.sourceUserId===undefined&&m.bornMonth+216<=month&&m.birth.naturalDeathMonth>month&&familyMemberPresent(m,month)&&familyResidenceAt(f,m,month)===factionId).map(m=>({family:f,member:m}))).sort((a,b)=>a.member.bornMonth-b.member.bornMonth||a.member.memberId.localeCompare(b.member.memberId))[0];
}
