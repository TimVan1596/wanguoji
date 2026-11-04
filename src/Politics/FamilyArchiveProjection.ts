import type {MilitaryFamily,MilitaryFamilyMember} from './MilitaryFamily';
import type {MilitaryPerson} from './MilitaryCommandRegistry';
import type {Dynasty} from './Dynasty';
import type {WorldEvent} from '../History/WorldHistory';
import {FAMILY_NOBLE_RANKS,createFamilyNobleContext,familyAtEvidenceBoundary,familyResidenceAt,familyMemberPresent,eligibleFamilyNobleHeirs,type FamilyNobleAct} from './FamilyNobleSuccession';
import {formatWorldDate} from '../Simulation/WorldTime';
import {currentNobleGrant,NOBLE_RANKS} from './MilitaryNobility';
import {verifiedPoliticalOffice} from './MilitaryPoliticalInfluence';
export interface FamilyArchiveSource {month:number;people:readonly MilitaryPerson[];events:readonly WorldEvent[];dynasties:readonly Dynasty[];}
export type FamilyArchiveClass='ACTIVE'|'HISTORICAL'|'EXTINCT';
export function projectFamilyArchive(f:MilitaryFamily,s:FamilyArchiveSource){
 const members=f.members.filter(m=>m.enteredMonth<=s.month),c=createFamilyNobleContext(s.month,[f],s.people,s.events,s.dynasties),byPerson=new Map(c.people.map(p=>[p.personId,p])),eventsById=new Map(s.events.map(e=>[e.id,e])),rulers=s.dynasties.flatMap(d=>d.rulers.map(r=>({r,factionId:d.factionId}))),acts=f.nobleSuccession?.filter(a=>a.month<=s.month)??[],last=acts.at(-1);
 const rows=new Map(members.map(m=>{
  const p=m.militaryPersonId?byPerson.get(m.militaryPersonId):undefined,political=rulers.find(({r})=>r.bornYear===m.bornMonth&&r.accessionYear!==undefined&&r.accessionYear<=s.month&&(r.residentIdentity?.sourceUserId===m.sourceUserId||m.militaryPersonId&&(r.militaryUsurperIdentity?.personId===m.militaryPersonId||r.militaryIdentity?.personId===m.militaryPersonId)));
  const dead=Math.min(m.deathMonth??Infinity,political?.r.deathMonth??Infinity)<=s.month,life=dead?'DEAD' as const:political||familyMemberPresent(m,s.month)?'ALIVE' as const:'UNKNOWN' as const;
  const appointments=p?.appointments.filter(a=>a.startMonth<=s.month)??[],currentAppointment=appointments.find(a=>(a.endMonth??Infinity)>s.month),activeOffice=p&&currentAppointment&&life==='ALIVE'&&!political?verifiedPoliticalOffice(p,currentAppointment.commandId,currentAppointment.factionId,s.month,s.events):undefined;
  const personalHistory=p?.nobilityHistory?.filter(g=>g.month<=s.month)??[];
  const effectivePersonal=life==='ALIVE'&&!political&&p?personalHistory.filter(g=>c.activeEpochs.has(`${g.factionId}/${g.epochFounderId}`)&&familyResidenceAt(f,m,s.month)===g.factionId&&currentNobleGrant(p,g.factionId,s.month,g.epochFounderId)?.eventId===g.eventId).sort((a,b)=>NOBLE_RANKS.indexOf(b.rank)-NOBLE_RANKS.indexOf(a.rank))[0]:undefined;
  const inheritedHistory=acts.filter(a=>a.kind==='SUCCEEDED'&&a.holderMemberId===m.memberId),forfeited=p?.politicalHistory?.some(a=>a.kind==='COURT_BAN'&&a.severity==='FORFEITURE'&&a.factionId===f.factionId&&a.epochFounderId===f.epochFounderId&&a.month<=s.month);
  const inherited=last?.kind==='SUCCEEDED'&&last.holderMemberId===m.memberId&&life==='ALIVE'&&!political&&!forfeited&&familyMemberPresent(m,s.month)&&familyResidenceAt(f,m,s.month)===f.factionId&&c.activeEpochs.has(`${f.factionId}/${f.epochFounderId}`)?last:undefined;
  const renewed=f.renewals?.filter(r=>r.memberId===m.memberId&&r.month<=s.month&&eventsById.has(r.sourceEventId)&&eventsById.has(`${f.familyId}-${m.memberId}-merit`))??[];
  const sourceRanks=[effectivePersonal?.rank,inherited?.rank].filter((r):r is NonNullable<typeof r>=>!!r).sort((a,b)=>FAMILY_NOBLE_RANKS.indexOf(b)-FAMILY_NOBLE_RANKS.indexOf(a));
  return [m.memberId,{member:m,person:p,life,political,appointments,activeOffice,personalHistory,effectivePersonal,inheritedHistory,inherited,renewed,primaryRank:sourceRanks[0],important:m.source==='FOUNDER'||appointments.length>0||personalHistory.length>0||inheritedHistory.length>0||!!political||renewed.length>0}] as const;
 }));
 const active=[...rows.values()].filter(r=>r.life==='ALIVE'&&(r.inherited||r.effectivePersonal||r.activeOffice||r.political&&(r.political.r.endYear??Infinity)>s.month));
 const allKnownDead=rows.size>0&&[...rows.values()].every(r=>r.life==='DEAD'),classification:FamilyArchiveClass=active.length?'ACTIVE':allKnownDead?'EXTINCT':'HISTORICAL';
 const inheritedHolder=[...rows.values()].find(r=>r.inherited),personalHolder=[...rows.values()].filter(r=>r.effectivePersonal).sort((a,b)=>FAMILY_NOBLE_RANKS.indexOf(b.effectivePersonal!.rank)-FAMILY_NOBLE_RANKS.indexOf(a.effectivePersonal!.rank)||a.member.bornMonth-b.member.bornMonth||a.member.memberId.localeCompare(b.member.memberId))[0];
 return {family:f,month:s.month,rows,acts,last,classification,activeMembers:active.length,living:[...rows.values()].filter(r=>r.life==='ALIVE').length,unknown:[...rows.values()].filter(r=>r.life==='UNKNOWN').length,currentInheritedHolderId:inheritedHolder?.member.memberId,locatableTitleHolderId:inheritedHolder?.member.memberId??personalHolder?.member.memberId,actualSuccessions:acts.filter(a=>a.kind==='SUCCEEDED').length,importantIds:new Set([...rows.values()].filter(r=>r.important).map(r=>r.member.memberId)),newMeritMembers:[...rows.values()].filter(r=>r.member.generation>0&&r.effectivePersonal&&['HOU','GONG'].includes(r.effectivePersonal.rank)).length};
}
export type FamilyArchiveProjection=ReturnType<typeof projectFamilyArchive>;
/** Reconstruct the decision from the saved event boundary, including death/transfer order. */
export function explainFamilyTitleEnd(f:MilitaryFamily,a:FamilyNobleAct,s:FamilyArchiveSource){
 const index=s.events.findIndex(e=>e.id===a.eventId);if(index<0)return {text:'该次承袭处理的原始事件未找到，无法重建当时资格。',children:[] as Array<{memberId:string;name:string;reason:string}>,grandchildren:0,laterChildren:[] as Array<{memberId:string;name:string;bornMonth:number;enteredMonth:number;entryEventId:string;parentDeathMonth?:number}>,sourceEventIds:a.sourceEventIds};
 const historical=familyAtEvidenceBoundary({...f,nobleSuccession:f.nobleSuccession?.filter(x=>s.events.findIndex(e=>e.id===x.eventId)<index)},a.month,index,s.events),prior=s.events.slice(0,index),context=createFamilyNobleContext(a.month,[historical],s.people,prior,s.dynasties),previous=historical.members.find(m=>m.memberId===a.previousMemberId),eligible=new Set(eligibleFamilyNobleHeirs(historical,a.previousMemberId,context).map(m=>m.memberId));
 const children=historical.members.filter(m=>m.parentMemberId===a.previousMemberId).map(m=>({memberId:m.memberId,name:m.name,reason:eligible.has(m.memberId)?'符合当时直接承袭资格':(m.deathMonth??Infinity)<=a.month?`已于${formatWorldDate(m.deathMonth!)}去世`:familyResidenceAt(historical,m,a.month)!==f.factionId?'当时已转属他国':!familyMemberPresent(m,a.month)?'当时已无可核验的在籍人口身份':context.politicalAccessions.has(m.memberId)?'此前已经登位': '有正式谋逆重处分，袭爵资格受限'}));
 const seen=new Set<string>();const descendants=(parentId:string):MilitaryFamilyMember[]=>{if(seen.has(parentId))return [];seen.add(parentId);const direct=historical.members.filter(m=>m.parentMemberId===parentId&&!seen.has(m.memberId));return direct.flatMap(m=>[m,...descendants(m.memberId)]);};
 const childIds=new Set(children.map(m=>m.memberId)),grandchildren=descendants(a.previousMemberId).filter(m=>!childIds.has(m.memberId)&&familyMemberPresent(m,a.month)&&familyResidenceAt(historical,m,a.month)===f.factionId).length;
 let text:string;
 const laterChildren=f.members.filter(m=>m.parentMemberId===a.previousMemberId&&m.enteredMonth<=s.month&&!historical.members.some(h=>h.memberId===m.memberId)).map(m=>({memberId:m.memberId,name:m.name,bornMonth:m.bornMonth,enteredMonth:m.enteredMonth,entryEventId:`${m.memberId}-entered`,parentDeathMonth:previous?.deathMonth}));
 if(a.reason==='NO_HEIR')text=children.length?`当次处理时，已登记${children.length}名直接子嗣：${children.map(m=>`${m.name}${m.reason==='符合当时直接承袭资格'?'具备资格':`（${m.reason}）`}`).join('、')}。`:'当次处理时，没有已入籍、已登记的直接子嗣。';
 else if(a.reason==='RANK_EXHAUSTED')text=`${previous?.name??'原持爵者'}所持爵位已降至男爵，本次身故后世降耗尽；不是因为家族无人存续。`;
 else if(a.reason==='REGIME_ENDED')text='原爵所属国家或王统的政治权威已经终结，旧朝承袭失效；并不表示家族成员死亡。';
 else if(a.reason==='REVOKED')text='原始个人爵位已有正式追夺事件，不能继续作为承袭权源。';
 else if(a.reason==='FORFEITED')text=`${previous?.name??'原持爵者'}本人受到本朝正式谋逆重处分，相关承袭资格终止；不等于其他家族成员受罚。`;
 else if(a.reason==='FOREIGN')text=`${previous?.name??'原持爵者'}当时已转属他国，原国承袭资格终止；后代与旧爵历史仍然保留。`;
 else if(a.reason==='POLITICAL_ACCESSION')text=`${previous?.name??'原持爵者'}已正式登位，不再接续原爵。`;
 else if(a.reason==='ENTITY_ENDED')text='原持爵者的实际在籍身份已经终止；没有据此推断其死亡。';
 else text=`${previous?.name??'原持爵者'}实际死亡后，按出生顺序从符合资格的直接子嗣中择一，完成一次世降。`;
 if(a.reason==='NO_HEIR'&&eligible.size)return {text:'史料资格与断袭结果存在不一致，需核验原始事务；不据此推断家族无后。',children,grandchildren,laterChildren,sourceEventIds:a.sourceEventIds};
 if(a.reason==='NO_HEIR')text+=grandchildren?`另有${grandchildren}名在世在籍的孙辈或更远后代；现行制度不允许代袭，故爵位终止，血脉仍可延续。`:'没有可接续的合格直接子嗣，承袭链终止；不据此判定家族绝嗣。';
 return {text,children,grandchildren,laterChildren,sourceEventIds:a.sourceEventIds};
}
/** Research only: does not append to the sealed V44 chain or invent a new hereditary period. */
export function familyRenewalCandidates(p:FamilyArchiveProjection){const end=p.acts.find(a=>a.kind==='ENDED');return end?[...p.rows.values()].filter(r=>r.member.generation>0&&r.life==='ALIVE'&&r.effectivePersonal&&['HOU','GONG'].includes(r.effectivePersonal.rank)&&r.effectivePersonal.month>end.month).map(r=>({memberId:r.member.memberId,sourceEventId:r.effectivePersonal!.eventId,rank:r.effectivePersonal!.rank})):[];}
