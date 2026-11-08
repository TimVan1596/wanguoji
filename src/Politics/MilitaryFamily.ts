import type {FamilyChildBirth} from './FamilyChildBirth';
import type {FamilyFoundationPolicy} from './FamilyFoundationPolicy';
import type {FamilyNobleAct} from './FamilyNobleSuccession';
import {POLITICAL_CALIBRATIONS,type PoliticalCalibration} from './PoliticalCalibration';
import type {MilitaryPerson} from './MilitaryCommandRegistry';
import type {WorldEvent} from '../History/WorldHistory';
import {splitEstablishedPersonalName,hanGivenNamePool} from './NameCulture';
/** Genealogy records refer to the original population identity, never create an extra resident. */
export interface MilitaryFamilyMember {
 memberId:string; sourceUserId?:number; name:string; bornMonth:number; generation:number;
 parentMemberId?:string; enteredMonth:number; source:'FOUNDER'|'NATURAL_GROWTH'|'HOUSEHOLD_BIRTH';
 birth?:FamilyChildBirth;populationEnteredMonth?:number;
 factionHistory?:Array<{month:number;factionId:string;eventIndex:number}>; deathHistoryIndex?:number; exitHistoryIndex?:number;
 militaryPersonId?:string; deathMonth?:number; deathCause?:string; exitMonth?:number; exitCause?:string;
}
export interface MilitaryFamily {
 familyId:string; surname:string; founderPersonId:string; factionId:string; epochFounderId:string;
 foundedMonth:number; sourceEventId:string; nobleSuccession?:FamilyNobleAct[]; renewals?:Array<{memberId:string;month:number;sourceEventId:string}>; members:MilitaryFamilyMember[];
}
export const familyMemberId=(userId:number,bornMonth:number)=>`family-member-${userId}-${bornMonth}`;
export function familyFounderSource(p:MilitaryPerson,events:readonly WorldEvent[],factionId:string,epoch:string,month:number,policy:FamilyFoundationPolicy='FOUNDING'){
 if(p.royalIdentity||p.politicalRulerId||p.deathMonth!==undefined||p.factionId!==factionId)return;
 return [...events].sort((a,b)=>(a.monthIndex??a.year)-(b.monthIndex??b.year)||a.id.localeCompare(b.id)).find(e=>(e.monthIndex??e.year)<=month&&e.actorFactionId===factionId&&e.metadata?.personId===p.personId&&
  (e.type==='military-ennobled'&&p.nobilityHistory?.some(g=>g.eventId===e.id&&g.epochFounderId===epoch&&(policy==='Z48'?['HOU','GONG']:policy==='FOUNDING'?['NAN','ZI','BO','HOU','GONG']:['BO','HOU','GONG']).includes(g.rank)&&!(p.honorHistory??[]).some(h=>h.kind==='REVOKED'&&h.factionId===factionId&&h.epochFounderId===epoch&&h.month<=month&&events.some(e=>e.id===h.eventId)))||
   policy==='FOUNDING'&&e.type==='founding-peerage-granted'&&p.nobilityHistory?.some(g=>g.eventId===e.id&&g.basis==='FOUNDING'&&g.epochFounderId===epoch)||
   e.type==='court-service-granted'&&e.rulerId&&e.metadata?.issuerRulerId===e.rulerId));
}
export function makeMilitaryFamily(p:MilitaryPerson,factionId:string,epoch:string,month:number,source:WorldEvent):MilitaryFamily|undefined{
 const split=splitEstablishedPersonalName(p.personalName??p.name);if(!split)return;
 return {familyId:`military-family-${p.personId}-${epoch}`,surname:split.houseName.replace(/氏$/,''),founderPersonId:p.personId,factionId,epochFounderId:epoch,foundedMonth:month,sourceEventId:source.id,
 members:[{memberId:familyMemberId(p.sourceUserId,p.bornMonth),sourceUserId:p.sourceUserId,name:p.personalName??p.name,bornMonth:p.bornMonth,generation:0,enteredMonth:month,source:'FOUNDER',militaryPersonId:p.personId}]};
}
function hash(s:string){let n=2166136261;for(const c of s)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;}
/** Called only before first population entry. Birth is derived from the original population label, never re-aged. */
function planFamilyPopulationEntryUnmeasured(families:readonly MilitaryFamily[],factionId:string,epoch:string|undefined,userId:number,bornMonth:number,month:number,seed:string){
 // This pure identity hash already rejected these entries after the old scan.
 // Moving it ahead of the scan preserves every accepted parent and all RNG.
 if(hash(`${seed}/${userId}/${bornMonth}/family-entry`)%100>=25)return;
 const options=families.filter(f=>f.factionId===factionId&&f.epochFounderId===epoch&&f.foundedMonth<=month).flatMap(f=>{
  const kin=createFamilyKinIndex(f),renewed=new Set(f.renewals?.filter(r=>r.month<=month).map(r=>r.memberId));
  return f.members.filter(p=>p.bornMonth+18*12<=bornMonth&&bornMonth<=p.bornMonth+55*12&&(p.deathMonth??Infinity)>bornMonth&&(p.exitMonth??Infinity)>bornMonth&&p.enteredMonth<month&&
   (kin.children.get(p.memberId)?.length??0)<2&&!(kin.children.get(p.memberId)??[]).some(c=>Math.abs(c.bornMonth-bornMonth)<48)&&familyGenerationsSinceMerit(f,p,month,kin,renewed)<4
  ).map(parent=>({family:f,parent}));
 }).sort((a,b)=>a.family.familyId.localeCompare(b.family.familyId)||a.parent.memberId.localeCompare(b.parent.memberId));
 if(!options.length)return;
 const {family,parent}=options[hash(`${seed}/${userId}/family-parent`)%options.length];
 const pool=hanGivenNamePool,name=family.surname+pool.doubleNamePrefixes[hash(`${userId}/given-a`)%pool.doubleNamePrefixes.length]+pool.doubleNameSuffixes[hash(`${userId}/given-b`)%pool.doubleNameSuffixes.length];
 const member:MilitaryFamilyMember={memberId:familyMemberId(userId,bornMonth),sourceUserId:userId,name,bornMonth,generation:parent.generation+1,parentMemberId:parent.memberId,enteredMonth:month,source:'NATURAL_GROWTH'};
 return {familyId:family.familyId,member};
}
/** Session-only measurement hook. Never persisted and never used for a decision. */
let populationEntryObserver:((sample:{month:number;elapsedMs:number;matched:boolean})=>void)|undefined;
export function observeFamilyPopulationEntryForSimulation(observer:typeof populationEntryObserver){populationEntryObserver=observer;}
export function planFamilyPopulationEntry(...args:Parameters<typeof planFamilyPopulationEntryUnmeasured>){
 const observer=populationEntryObserver;if(!observer)return planFamilyPopulationEntryUnmeasured(...args);
 const start=performance.now();let result:ReturnType<typeof planFamilyPopulationEntryUnmeasured>=undefined;
 try{return result=planFamilyPopulationEntryUnmeasured(...args);}finally{observer({month:args[5],elapsedMs:performance.now()-start,matched:!!result});}
}
/** Built from the actual current family for one transaction; never a persistent second genealogy.
 * Rebuilding at each boundary also covers hydration, rollback and in-place identity changes. */
export function createFamilyKinIndex(family:MilitaryFamily){
 const byId=new Map(family.members.map(m=>[m.memberId,m])),children=new Map<string,MilitaryFamilyMember[]>();
 for(const m of family.members)if(m.parentMemberId){const row=children.get(m.parentMemberId)??[];row.push(m);children.set(m.parentMemberId,row);}
 return {byId,children};
}
/** A new sourced achievement can renew only the actual descendant's branch. */
export function familyGenerationsSinceMerit(family:MilitaryFamily,member:MilitaryFamilyMember,month:number,kin?:ReturnType<typeof createFamilyKinIndex>,renewed?:ReadonlySet<string>){
 let generations=member.generation,parent:MilitaryFamilyMember|undefined=member;
 const visited=new Set<string>();
 while(parent){const ancestor:MilitaryFamilyMember=parent;if(visited.has(ancestor.memberId))return Infinity;visited.add(ancestor.memberId);if(renewed?renewed.has(ancestor.memberId):family.renewals?.some(r=>r.memberId===ancestor.memberId&&r.month<=month)){generations=member.generation-ancestor.generation;break;}parent=ancestor.parentMemberId?(kin?kin.byId.get(ancestor.parentMemberId):family.members.find(m=>m.memberId===ancestor.parentMemberId)):undefined;}
 return generations;
}
/** First appointment only; inherited reputation never substitutes for eligibility, army or personal merit. */
export function familyAppointmentWeight(family:MilitaryFamily|undefined,member:MilitaryFamilyMember|undefined,factionId:string,epoch:string|undefined,month:number,calibration:PoliticalCalibration='BASELINE'){
 if(!family||!member||family.factionId!==factionId||family.epochFounderId!==epoch||member.deathMonth!==undefined||member.militaryPersonId||member.enteredMonth>month||month-member.bornMonth<18*12)return 1;
 const generations=familyGenerationsSinceMerit(family,member,month);
 const profile=POLITICAL_CALIBRATIONS[calibration];return generations===1?profile.familyChild:generations===2?profile.familyGrandchild:1;
}
export function familyStatus(f:MilitaryFamily,people:readonly MilitaryPerson[]){
 const descendants=f.members.filter(m=>m.generation>0),serving=descendants.filter(m=>m.militaryPersonId&&people.some(p=>p.personId===m.militaryPersonId&&p.status==='ACTIVE'));
 return serving.length?'后代仍有现役军人':descendants.some(m=>m.deathMonth===undefined)?'后代尚无现役军职':'暂无后继军政人物';
}
