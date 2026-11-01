import type {MilitaryPerson} from './MilitaryCommandRegistry';
import type {WorldEvent} from '../History/WorldHistory';
import {splitEstablishedPersonalName,hanGivenNamePool} from './NameCulture';
/** Genealogy records refer to the original population identity, never create an extra resident. */
export interface MilitaryFamilyMember {
 memberId:string; sourceUserId:number; name:string; bornMonth:number; generation:number;
 parentMemberId?:string; enteredMonth:number; source:'FOUNDER'|'NATURAL_GROWTH';
 militaryPersonId?:string; deathMonth?:number; deathCause?:string; exitMonth?:number; exitCause?:string;
}
export interface MilitaryFamily {
 familyId:string; surname:string; founderPersonId:string; factionId:string; epochFounderId:string;
 foundedMonth:number; sourceEventId:string; renewals?:Array<{memberId:string;month:number;sourceEventId:string}>; members:MilitaryFamilyMember[];
}
export const familyMemberId=(userId:number,bornMonth:number)=>`family-member-${userId}-${bornMonth}`;
export function familyFounderSource(p:MilitaryPerson,events:readonly WorldEvent[],factionId:string,epoch:string,month:number){
 if(p.royalIdentity||p.politicalRulerId||p.deathMonth!==undefined||p.factionId!==factionId)return;
 return events.find(e=>(e.monthIndex??e.year)<=month&&e.actorFactionId===factionId&&e.metadata?.personId===p.personId&&
  (e.type==='military-ennobled'&&p.nobilityHistory?.some(g=>g.eventId===e.id&&g.epochFounderId===epoch&&['HOU','GONG'].includes(g.rank))||
   e.type==='court-service-granted'&&e.rulerId&&e.metadata?.issuerRulerId===e.rulerId));
}
export function makeMilitaryFamily(p:MilitaryPerson,factionId:string,epoch:string,month:number,source:WorldEvent):MilitaryFamily|undefined{
 const split=splitEstablishedPersonalName(p.personalName??p.name);if(!split)return;
 return {familyId:`military-family-${p.personId}-${epoch}`,surname:split.houseName.replace(/氏$/,''),founderPersonId:p.personId,factionId,epochFounderId:epoch,foundedMonth:month,sourceEventId:source.id,
 members:[{memberId:familyMemberId(p.sourceUserId,p.bornMonth),sourceUserId:p.sourceUserId,name:p.personalName??p.name,bornMonth:p.bornMonth,generation:0,enteredMonth:month,source:'FOUNDER',militaryPersonId:p.personId}]};
}
function hash(s:string){let n=2166136261;for(const c of s)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;}
/** Called only before first population entry. Birth is derived from the original population label, never re-aged. */
export function planFamilyPopulationEntry(families:readonly MilitaryFamily[],factionId:string,epoch:string|undefined,userId:number,bornMonth:number,month:number,seed:string){
 const options=families.filter(f=>f.factionId===factionId&&f.epochFounderId===epoch&&f.foundedMonth<=month).flatMap(f=>f.members.filter(p=>
  p.bornMonth+18*12<=bornMonth&&bornMonth<=p.bornMonth+55*12&&(p.deathMonth??Infinity)>bornMonth&&(p.exitMonth??Infinity)>bornMonth&&p.enteredMonth<month&&p.generation<4&&
  f.members.filter(c=>c.parentMemberId===p.memberId).length<2&&
  !f.members.some(c=>c.parentMemberId===p.memberId&&Math.abs(c.bornMonth-bornMonth)<48)
 ).map(parent=>({family:f,parent}))).sort((a,b)=>a.family.familyId.localeCompare(b.family.familyId)||a.parent.memberId.localeCompare(b.parent.memberId));
 if(!options.length||hash(`${seed}/${userId}/${bornMonth}/family-entry`)%100>=25)return;
 const {family,parent}=options[hash(`${seed}/${userId}/family-parent`)%options.length];
 const pool=hanGivenNamePool,name=family.surname+pool.doubleNamePrefixes[hash(`${userId}/given-a`)%pool.doubleNamePrefixes.length]+pool.doubleNameSuffixes[hash(`${userId}/given-b`)%pool.doubleNameSuffixes.length];
 const member:MilitaryFamilyMember={memberId:familyMemberId(userId,bornMonth),sourceUserId:userId,name,bornMonth,generation:parent.generation+1,parentMemberId:parent.memberId,enteredMonth:month,source:'NATURAL_GROWTH'};
 return {familyId:family.familyId,member};
}
/** First appointment only; inherited reputation never substitutes for eligibility, army or personal merit. */
export function familyAppointmentWeight(family:MilitaryFamily|undefined,member:MilitaryFamilyMember|undefined,factionId:string,epoch:string|undefined,month:number){
 if(!family||!member||family.factionId!==factionId||family.epochFounderId!==epoch||member.deathMonth!==undefined||member.militaryPersonId||member.enteredMonth>month||month-member.bornMonth<18*12)return 1;
 let generations=member.generation,parent:MilitaryFamilyMember|undefined=member.parentMemberId?family.members.find(m=>m.memberId===member.parentMemberId):undefined;
 const visited=new Set<string>();
 while(parent){const ancestor=parent;if(visited.has(ancestor.memberId))return 1;visited.add(ancestor.memberId);if(family.renewals?.some(r=>r.memberId===ancestor.memberId&&r.month<=month)){generations=member.generation-ancestor.generation;break;}parent=ancestor.parentMemberId?family.members.find(m=>m.memberId===ancestor.parentMemberId):undefined;}
 return generations===1?1.10:generations===2?1.05:1;
}
export function familyStatus(f:MilitaryFamily,people:readonly MilitaryPerson[]){
 const descendants=f.members.filter(m=>m.generation>0),serving=descendants.filter(m=>m.militaryPersonId&&people.some(p=>p.personId===m.militaryPersonId&&p.status==='ACTIVE'));
 return serving.length?'后代在朝从军':descendants.some(m=>m.deathMonth===undefined)?'后代尚无现役军职':'暂无后继军政人物';
}
