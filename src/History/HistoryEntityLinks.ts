import type {WorldEvent} from './WorldHistory';
import type {MilitaryFamily} from '../Politics/MilitaryFamily';
import type {MilitaryPerson} from '../Politics/MilitaryCommandRegistry';
import type {Dynasty} from '../Politics/Dynasty';
import type {PersonArchiveTarget} from '../UI/Components/FactionDetails/PersonArchiveTarget';
export type HistoryEntityLink={label:string;target:PersonArchiveTarget|{kind:'FACTION'|'CITY';id:string;factionId?:string}};
/** Entity IDs, sourced family acts and permanent identities; never name matching. */
export function historyEntityLinks(e:WorldEvent,families:readonly MilitaryFamily[],people:readonly MilitaryPerson[],dynasties:readonly Dynasty[],factionIds:ReadonlySet<string>,cityIds:ReadonlySet<string>=new Set()){
 const links:HistoryEntityLink[]=[],m=e.metadata??{},month=e.monthIndex??e.year,local=[e.actorFactionId,e.targetFactionId,...e.factionIds??[]].filter(Boolean) as string[];
 const add=(label:string,target:HistoryEntityLink['target'])=>{if(!links.some(l=>JSON.stringify(l.target)===JSON.stringify(target)))links.push({label,target});};
 for(const id of local)if(factionIds.has(id))add('查看国家',{kind:'FACTION',id});
 if(e.cityId&&cityIds.has(e.cityId))add('查看城市',{kind:'CITY',id:e.cityId});
 const f=typeof m.familyId==='string'?families.find(f=>f.familyId===m.familyId&&f.factionId===e.actorFactionId):['military-ennobled','court-peerage-granted','founding-peerage-granted'].includes(e.type)?families.find(f=>f.factionId===e.actorFactionId&&f.members.some(member=>member.militaryPersonId===m.personId)&&people.some(p=>p.personId===m.personId&&p.nobilityHistory?.some(g=>g.eventId===e.id&&e.metadata?.nobility===JSON.stringify(g)))):undefined;
 if(['civil-governor-appointed','civil-governor-ended','civil-governor-merit'].includes(e.type)&&typeof m.personId==='string'&&e.actorFactionId)add('查看地方文官档案',{kind:'CIVIL',factionId:e.actorFactionId,id:m.personId});
 if(f){
  let memberIds:string[]=[];let valid=false;
  if(['family-title-started','family-title-succeeded','family-title-ended'].includes(e.type))try{const a=f.nobleSuccession?.find(a=>a.eventId===e.id&&a.month===month&&a.familyId===f.familyId);if(a&&m.familyNobleAct===JSON.stringify(a)){memberIds=[a.previousMemberId,...a.holderMemberId?[a.holderMemberId]:[]];valid=true;}}catch{}
  else if(e.type==='military-family-founded'&&e.id===`${f.familyId}-founded`&&m.sourceEventId===f.sourceEventId){memberIds=f.members.filter(q=>q.militaryPersonId===f.founderPersonId).map(q=>q.memberId);valid=true;}
  else if(e.type==='military-family-merit'&&f.renewals?.some(r=>r.memberId===m.memberId&&r.month===month&&r.sourceEventId===m.sourceEventId)){memberIds=[String(m.memberId)];valid=true;}
  if(['family-child-born','family-child-population-entered','family-member-died'].includes(e.type)){const q=f.members.find(q=>q.memberId===m.memberId);if(q&&q.enteredMonth<=month&&(e.type!=='family-child-born'||q.birth?.eventId===e.id)){memberIds=[q.memberId,...q.parentMemberId?[q.parentMemberId]:[]];valid=true;}}
  if(['military-ennobled','court-peerage-granted','founding-peerage-granted'].includes(e.type)){memberIds=f.members.filter(q=>q.militaryPersonId===m.personId).map(q=>q.memberId);valid=memberIds.length>0;}
  if(valid&&factionIds.has(f.factionId)){
   add(`查看${f.surname}氏总谱`,{kind:'FAMILY',factionId:f.factionId,id:f.familyId});
   for(const id of memberIds){const member=f.members.find(q=>q.memberId===id);if(!member)continue;add(`定位${member.name}`,{kind:'FAMILY',factionId:f.factionId,id:f.familyId,memberId:id});const p=member.militaryPersonId&&people.find(p=>p.personId===member.militaryPersonId&&p.sourceUserId===member.sourceUserId&&p.bornMonth===member.bornMonth);if(p&&p.appointments.some(a=>a.factionId===f.factionId&&a.startMonth<=month))add(`军政档案 · ${member.name}`,{kind:'MILITARY',factionId:f.factionId,id:p.personId});}
  }
 }
 for(const key of ['personId','commanderPersonId','militaryPersonId','militaryUsurperPersonId']){const id=m[key],p=people.find(p=>p.personId===id);if(!p)continue;const factionId=local.find(id=>factionIds.has(id)&&p.appointments.some(a=>a.factionId===id&&a.startMonth<=month));if(factionId)add(`军政档案 · ${p.personalName??p.name}`,{kind:'MILITARY',factionId,id:p.personId});}
 if(e.type==='royal-child-born'){const d=dynasties.find(d=>d.factionId===e.actorFactionId),r=d?.rulers.find(r=>r.id===e.rulerId&&r.householdBirth?.eventId===e.id&&JSON.stringify(r.householdBirth)===m.royalBirth);if(r?.parentId&&d!.rulers.some(p=>p.id===r.parentId))add('查看父亲王室档案',{kind:'GENEALOGY',factionId:d!.factionId,id:r.parentId});}
 if(e.type==='royal-noble-act'){const d=dynasties.find(d=>d.factionId===e.actorFactionId),a=d?.royalNobility?.find(a=>a.eventId===e.id&&a.month===month&&m.royalNobleAct===JSON.stringify(a));if(a){for(const id of [a.previousRulerId,a.holderRulerId])if(id&&d!.rulers.some(r=>r.id===id))add('查看王室宗谱',{kind:'GENEALOGY',factionId:d!.factionId,id});const g=people.flatMap(p=>p.nobilityHistory??[]).find(g=>g.eventId===a.sourceGrantEventId);if(g)add('查看原军功授爵人物',{kind:'MILITARY',factionId:g.factionId,id:g.personId});}}
 for(const id of [e.rulerId,m.previousRulerId,m.predecessorRulerId,m.nextRulerId,m.targetRulerId,m.foundingRulerId,m.recipientRulerId]){const d=dynasties.find(d=>local.includes(d.factionId)&&factionIds.has(d.factionId)&&d.rulers.some(r=>r.id===id&&r.bornYear<=month)),r=d?.rulers.find(r=>r.id===id);if(d&&r)add(`王室档案 · ${r.houseName.replace(/氏$/,'')}${r.givenName}`,{kind:r.reignOrdinal!==undefined?'RULER':'GENEALOGY',factionId:d.factionId,id:r.id});}
 return links;
}
