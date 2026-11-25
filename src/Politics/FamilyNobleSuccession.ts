import type {MilitaryFamily,MilitaryFamilyMember} from './MilitaryFamily';
import type {MilitaryPerson} from './MilitaryCommandRegistry';
import type {WorldEvent} from '../History/WorldHistory';
import {NOBLE_RANKS,currentNobleGrant} from './MilitaryNobility';
export const FAMILY_NOBLE_RANKS=['NAN','ZI','BO','HOU','GONG'] as const;
export type FamilyNobleRank=typeof FAMILY_NOBLE_RANKS[number];
export const FAMILY_NOBLE_NAMES:Record<FamilyNobleRank,string>={NAN:'男爵',ZI:'子爵',BO:'伯爵',HOU:'侯爵',GONG:'公爵'};
export interface FamilyNobleAct {
 version:1|2;period?:number;eventId:string;familyId:string;factionId:string;epochFounderId:string;month:number;
 kind:'STARTED'|'UPGRADED'|'SUCCEEDED'|'ENDED';reason:'NEW_MERIT'|'DEATH'|'NO_HEIR'|'RANK_EXHAUSTED'|'REVOKED'|'FORFEITED'|'FOREIGN'|'POLITICAL_ACCESSION'|'REGIME_ENDED'|'ENTITY_ENDED';
 sourceGrantEventId:string;previousEventId:string;previousMemberId:string;previousRank:FamilyNobleRank;
 kinship?:FamilyNobleKinship;
 holderMemberId?:string;rank?:FamilyNobleRank;step:number;sourceEventIds:string[];
}
type FamilyNobleRelation='CHILD'|'GRANDCHILD'|'BROTHER'|'NEPHEW';
type FamilyNobleBlock='DEAD'|'EXITED'|'FOREIGN'|'FORFEITED'|'ACCEDED'|'UNREGISTERED'|'OTHER_TITLE';
export interface FamilyNobleKinship {
 relation?:FamilyNobleRelation;
 path?:string[];
 rejected:{memberId:string;relation:FamilyNobleRelation;reason:FamilyNobleBlock}[];
}
export interface FamilyNobleContext {renewable?:boolean;independent?:boolean;occupiedMembers?:ReadonlySet<string>;dynasties?:readonly Pick<import('./Dynasty').Dynasty,'factionId'|'houseEpochs'|'rulers'>[];month:number;people:readonly MilitaryPerson[];events:readonly WorldEvent[];activeEpochs:ReadonlySet<string>;politicalAccessions:ReadonlyMap<string,number>;}
const at=(e:WorldEvent)=>e.monthIndex??e.year;
export function familyResidenceAt(f:MilitaryFamily,m:MilitaryFamilyMember,month:number){return m.factionHistory?.filter(h=>h.month<=month).at(-1)?.factionId??m.birth?.factionId??f.factionId;}
export function familyMemberPresent(m:MilitaryFamilyMember,month:number){return m.enteredMonth<=month&&(m.deathMonth??Infinity)>month&&(m.exitMonth??Infinity)>month;}
function memberForfeiture(m:MilitaryFamilyMember,f:MilitaryFamily,c:FamilyNobleContext){const p=c.people.find(p=>p.personId===m.militaryPersonId);return p?.politicalHistory?.filter(b=>b.kind==='COURT_BAN'&&['FORFEITURE','EXECUTION'].includes(b.severity)&&b.factionId===f.factionId&&b.epochFounderId===f.epochFounderId&&b.month<=c.month&&(!b.eventId||c.events.some(e=>e.id===b.eventId))).at(-1);}
export function familyNobleAuthorityAt(f:MilitaryFamily,month:number,factionId?:string,epochFounderId?:string){
 const history=f.nobleSuccession??[];
 const periods=[...familyNoblePeriods(history,month).values()];
 const last=periods.find(a=>a.kind!=='ENDED'&&(!factionId||a.factionId===factionId)&&(!epochFounderId||a.epochFounderId===epochFounderId))??periods.at(-1);
 return {factionId:last?.factionId??f.factionId,epochFounderId:last?.epochFounderId??f.epochFounderId};
}
export function eligibleFamilyNobleHeirs(f:MilitaryFamily,parentId:string,c:FamilyNobleContext){const authority={...f,...familyNobleAuthorityAt(f,c.month)};return f.members.filter(m=>m.parentMemberId===parentId&&familyMemberPresent(m,c.month)&&familyResidenceAt(f,m,c.month)===authority.factionId&&!memberForfeiture(m,authority,c)&&(c.politicalAccessions.get(m.memberId)??Infinity)>c.month).sort((a,b)=>a.bornMonth-b.bornMonth||a.memberId.localeCompare(b.memberId));}
function highPeerageHeir(f:MilitaryFamily,evidence:MilitaryFamily,holder:MilitaryFamilyMember,c:FamilyNobleContext,deathContext:FamilyNobleContext){
 const atDeath=evidence.members,commonParent=holder.parentMemberId?atDeath.find(m=>m.memberId===holder.parentMemberId):undefined;
 const children=atDeath.filter(m=>m.parentMemberId===holder.memberId);
 const brothers=commonParent?atDeath.filter(m=>m.parentMemberId===commonParent.memberId&&m.memberId!==holder.memberId):[];
 const rows:{member:MilitaryFamilyMember;relation:FamilyNobleRelation;path:string[]}[]=[];
 const add=(member:MilitaryFamilyMember,relation:FamilyNobleRelation,...path:string[])=>rows.push({member,relation,path:[holder.memberId,...path,member.memberId]});
 const order=(a:MilitaryFamilyMember,b:MilitaryFamilyMember)=>a.bornMonth-b.bornMonth||a.memberId.localeCompare(b.memberId);
 children.sort(order).forEach(m=>add(m,'CHILD'));
 for(const child of children)if((child.deathMonth??Infinity)<=deathContext.month)
  atDeath.filter(m=>m.parentMemberId===child.memberId).sort(order).forEach(m=>add(m,'GRANDCHILD',child.memberId));
 brothers.sort(order).forEach(m=>add(m,'BROTHER',commonParent!.memberId));
 for(const brother of brothers)atDeath.filter(m=>m.parentMemberId===brother.memberId).sort(order).forEach(m=>add(m,'NEPHEW',commonParent!.memberId,brother.memberId));
 const authority={...f,...familyNobleAuthorityAt(f,c.month)};
 const reason=(family:MilitaryFamily,m:MilitaryFamilyMember,context:FamilyNobleContext):FamilyNobleBlock|undefined=>{
  if(c.occupiedMembers?.has(m.memberId))return 'OTHER_TITLE';
  if(m.enteredMonth>context.month||m.bornMonth>context.month)return 'UNREGISTERED';
  if((m.deathMonth??Infinity)<=context.month)return 'DEAD';
  if((m.exitMonth??Infinity)<=context.month)return 'EXITED';
  if(familyResidenceAt(family,m,context.month)!==authority.factionId)return 'FOREIGN';
  if(memberForfeiture(m,authority,context))return 'FORFEITED';
  if((context.politicalAccessions.get(m.memberId)??Infinity)<=context.month)return 'ACCEDED';
  return undefined;
 };
 const kinship:FamilyNobleKinship={rejected:[]};
 for(const row of rows){
  const current=f.members.find(m=>m.memberId===row.member.memberId);
  const rejected=reason(evidence,row.member,deathContext)??(current?reason(f,current,c):'UNREGISTERED');
  if(rejected)kinship.rejected.push({memberId:row.member.memberId,relation:row.relation,reason:rejected});
  else {
   kinship.relation=row.relation;kinship.path=row.path;
   return {heir:row.member,kinship};
  }
 }
 return {heir:undefined,kinship};
}
/** One active main period; a distinct valid personal grant is the only source of a new period. */
function planNewPeriod(f:MilitaryFamily,c:FamilyNobleContext,last:FamilyNobleAct):FamilyNobleAct|undefined{
 if(!c.renewable)return;
 const used=new Set((f.nobleSuccession??[]).map(a=>a.sourceGrantEventId));
 const candidates=f.members.flatMap(m=>{
  if(!m.militaryPersonId||!familyMemberPresent(m,c.month)||(c.politicalAccessions.get(m.memberId)??Infinity)<=c.month)return [];
  if(last.kind!=='ENDED'&&last.holderMemberId!==m.memberId)return [];
  const p=c.people.find(p=>p.personId===m.militaryPersonId),residence=familyResidenceAt(f,m,c.month);
  const grants=p?.nobilityHistory?.filter(g=>g.factionId===residence&&g.month<=c.month&&c.activeEpochs.has(`${g.factionId}/${g.epochFounderId}`)&&currentNobleGrant(p,g.factionId,c.month,g.epochFounderId)?.eventId===g.eventId)??[];
  const g=grants.sort((a,b)=>NOBLE_RANKS.indexOf(b.rank)-NOBLE_RANKS.indexOf(a.rank)||a.month-b.month)[0];
  if(!g||memberForfeiture(m,{...f,factionId:g.factionId,epochFounderId:g.epochFounderId},c)||used.has(g.eventId)||g.month<m.enteredMonth||!c.events.some(e=>e.id===g.eventId)||last.kind!=='ENDED'&&FAMILY_NOBLE_RANKS.indexOf(g.rank)<=FAMILY_NOBLE_RANKS.indexOf(last.rank!))return [];
  return [{m,g}];
 }).sort((a,b)=>FAMILY_NOBLE_RANKS.indexOf(b.g.rank)-FAMILY_NOBLE_RANKS.indexOf(a.g.rank)||a.g.month-b.g.month||a.m.memberId.localeCompare(b.m.memberId));
 const chosen=candidates[0];if(!chosen)return;
 const step=last.step+1;
 return {version:2,period:(last.period??1)+1,eventId:`${f.familyId}-succession-${step}`,familyId:f.familyId,factionId:chosen.g.factionId,epochFounderId:chosen.g.epochFounderId,month:c.month,kind:'STARTED',reason:'NEW_MERIT',sourceGrantEventId:chosen.g.eventId,previousEventId:last.eventId,previousMemberId:last.holderMemberId??last.previousMemberId,previousRank:last.rank??last.previousRank,holderMemberId:chosen.m.memberId,rank:chosen.g.rank,step,sourceEventIds:[last.eventId,chosen.g.eventId]};
}
function planSingleTransition(f:MilitaryFamily,c:FamilyNobleContext):FamilyNobleAct|undefined{
 const history=f.nobleSuccession?.filter(a=>a.month<=c.month)??[],last=history.at(-1);if(last){const next=planNewPeriod(f,c,last);if(next)return next;if(last.kind==='ENDED')return;}
 if(f.preparatory&&!last){
  const candidates=f.members.flatMap(m=>{
   const p=c.people.find(p=>p.personId===m.militaryPersonId),country=familyResidenceAt(f,m,c.month);
   if(!p||!familyMemberPresent(m,c.month)||(c.politicalAccessions.get(m.memberId)??Infinity)<=c.month)return [];
   return (p.nobilityHistory??[]).filter(g=>g.factionId===country&&g.month<=c.month&&c.activeEpochs.has(`${g.factionId}/${g.epochFounderId}`)&&
    currentNobleGrant(p,country,c.month,g.epochFounderId)?.eventId===g.eventId&&!memberForfeiture(m,{...f,factionId:country,epochFounderId:g.epochFounderId},c)).map(g=>({m,g}));
  }).sort((a,b)=>NOBLE_RANKS.indexOf(b.g.rank)-NOBLE_RANKS.indexOf(a.g.rank)||a.g.month-b.g.month||a.m.memberId.localeCompare(b.m.memberId));
  const chosen=candidates[0];
  if(!chosen)return;
  const {m,g}=chosen,previousEventId=`${f.familyId}-founded`;
  return {version:2,period:1,eventId:`${f.familyId}-succession-1`,familyId:f.familyId,factionId:g.factionId,epochFounderId:g.epochFounderId,month:c.month,kind:'STARTED',reason:'NEW_MERIT',sourceGrantEventId:g.eventId,previousEventId,previousMemberId:m.memberId,previousRank:g.rank,holderMemberId:m.memberId,rank:g.rank,step:1,sourceEventIds:[previousEventId,g.eventId]};
 }
 const authority={...f,...familyNobleAuthorityAt(f,c.month)};
 const founder=c.people.find(p=>p.personId===f.founderPersonId),grant=last?c.people.flatMap(p=>p.nobilityHistory??[]).find(g=>g.eventId===last.sourceGrantEventId):(founder?currentNobleGrant(founder,f.factionId,Math.min(c.month,founder.deathMonth??Infinity),f.epochFounderId):undefined)??founder?.nobilityHistory?.filter(g=>g.factionId===f.factionId&&g.epochFounderId===f.epochFounderId&&g.month<=Math.min(c.month,founder.deathMonth??Infinity)).sort((a,b)=>NOBLE_RANKS.indexOf(b.rank)-NOBLE_RANKS.indexOf(a.rank)||b.month-a.month)[0];
 if(!grant)return;
 const holder=f.members.find(m=>m.memberId===(last?.holderMemberId??f.members.find(m=>m.militaryPersonId===f.founderPersonId)?.memberId));if(!holder)return;
 const previousRank=last?.rank??grant.rank,previousEventId=last?.eventId??grant.eventId,sourceEventIds=[previousEventId],step=(last?.step??0)+1;
 let reason:FamilyNobleAct['reason']|undefined;
 if(!c.activeEpochs.has(`${authority.factionId}/${authority.epochFounderId}`))reason='REGIME_ENDED';
 else if(familyResidenceAt(f,holder,c.month)!==authority.factionId)reason='FOREIGN';
 else if((c.politicalAccessions.get(holder.memberId)??Infinity)<=c.month)reason='POLITICAL_ACCESSION';
 else if(memberForfeiture(holder,authority,c)&&memberForfeiture(holder,authority,c)!.month>=(last?.month??grant.month)){reason='FORFEITED';sourceEventIds.push(memberForfeiture(holder,authority,c)!.eventId);}
 else if((!last||last.kind==='STARTED'||last.kind==='UPGRADED')&&c.people.find(p=>p.nobilityHistory?.some(g=>g.eventId===grant.eventId))?.honorHistory?.some(h=>h.kind==='REVOKED'&&h.month>=grant.month&&h.factionId===authority.factionId&&h.epochFounderId===authority.epochFounderId&&h.month<=c.month)){reason='REVOKED';sourceEventIds.push(c.people.find(p=>p.nobilityHistory?.some(g=>g.eventId===grant.eventId))!.honorHistory!.find(h=>h.kind==='REVOKED'&&h.month>=grant.month&&h.factionId===authority.factionId&&h.epochFounderId===authority.epochFounderId&&h.month<=c.month)!.eventId);}
 else if(holder.deathMonth!==undefined&&holder.deathMonth<=c.month){reason='DEATH';const death=c.events.find(e=>e.type==='military-person-died'&&e.metadata?.personId===holder.militaryPersonId&&at(e)===holder.deathMonth);sourceEventIds.push(death?.id??`${f.familyId}-${holder.memberId}-death`);}
 else if(holder.exitMonth!==undefined&&holder.exitMonth<=c.month)reason='ENTITY_ENDED';
 if(!reason)return;
 const rank=FAMILY_NOBLE_RANKS[FAMILY_NOBLE_RANKS.indexOf(previousRank)-1];
 const deathIndex=reason==='DEATH'?c.events.findIndex(e=>e.id===sourceEventIds.at(-1)):-1;
 const evidence=deathIndex>=0?familyAtEvidenceBoundary(f,holder.deathMonth!,deathIndex+1,c.events):f;
 const deathEvents=deathIndex>=0?c.events.slice(0,deathIndex+1):c.events;
 const deathMonth=holder.deathMonth??c.month;
 const deathContext=c.dynasties&&deathIndex>=0?createFamilyNobleContext(deathMonth,[evidence],c.people,deathEvents,c.dynasties):{...c,month:deathMonth,events:deathEvents};
 const high=reason==='DEATH'&&(previousRank==='GONG'||previousRank==='HOU')?highPeerageHeir(f,evidence,holder,c,deathContext):undefined;
 const heir=high?high.heir:reason==='DEATH'&&rank?eligibleFamilyNobleHeirs(evidence,holder.memberId,deathContext).find(candidate=>{const current=f.members.find(m=>m.memberId===candidate.memberId)!;return !c.occupiedMembers?.has(current.memberId)&&familyMemberPresent(current,c.month)&&familyResidenceAt(f,current,c.month)===authority.factionId&&!memberForfeiture(current,authority,c)&&(c.politicalAccessions.get(current.memberId)??Infinity)>c.month;}):undefined;
 if(reason==='DEATH'&&!heir)reason=rank?'NO_HEIR':'RANK_EXHAUSTED';
 return {version:last?.version===2?2:1,...(last?.period?{period:last.period}:{}),eventId:`${f.familyId}-succession-${step}`,familyId:f.familyId,factionId:authority.factionId,epochFounderId:authority.epochFounderId,month:c.month,kind:heir?'SUCCEEDED':'ENDED',reason,sourceGrantEventId:grant.eventId,previousEventId,previousMemberId:holder.memberId,previousRank,...(high?{kinship:high.kinship}:{}),...(heir?{holderMemberId:heir.memberId,rank}:{}),step,sourceEventIds};
}
/** The original family ID and a monotonically assigned period identify each independent chain. */
export function familyNoblePeriods(history:readonly FamilyNobleAct[],month=Infinity){
 const periods=new Map<number,FamilyNobleAct>();
 for(const act of history)if(act.month<=month)periods.set(act.period??1,act);
 if(periods.size&&!history.some(act=>act.kind==='STARTED'&&act.period===1&&act.month<=month)){
  const latest=history.filter(act=>act.month<=month).at(-1)!;
  return new Map([[latest.period??1,latest]]);
 }
 return periods;
}

export function familyTitleForMember(f:MilitaryFamily,memberId:string,month:number,factionId:string,epochFounderId?:string){
 return [...familyNoblePeriods(f.nobleSuccession??[],month).values()].find(act=>
  act.kind!=='ENDED'&&act.holderMemberId===memberId&&(act.factionId??f.factionId)===factionId&&
  (!epochFounderId||epochFounderId===(act.epochFounderId??f.epochFounderId)));
}

export function familyNobleRankAt(f:MilitaryFamily,m:MilitaryFamilyMember,month:number,factionId=familyResidenceAt(f,m,month),epochFounderId?:string){
 if(!familyMemberPresent(m,month)||familyResidenceAt(f,m,month)!==factionId)return;
 return [...familyNoblePeriods(f.nobleSuccession??[],month).values()]
  .filter(act=>act.kind!=='ENDED'&&act.holderMemberId===m.memberId&&(act.factionId??f.factionId)===factionId&&(!epochFounderId||epochFounderId===(act.epochFounderId??f.epochFounderId)))
  .sort((a,b)=>FAMILY_NOBLE_RANKS.indexOf(b.rank!)-FAMILY_NOBLE_RANKS.indexOf(a.rank!))[0]?.rank;
}

export function planFamilyNobleTransition(f:MilitaryFamily,c:FamilyNobleContext):FamilyNobleAct|undefined{
 if(!c.independent)return planSingleTransition(f,c);
 const history=(f.nobleSuccession??[]).filter(act=>act.month<=c.month),periods=familyNoblePeriods(history);
 const active=[...periods.values()].filter(act=>act.kind!=='ENDED');
 const step=(history.at(-1)?.step??0)+1,eventId=`${f.familyId}-succession-${step}`;
 const used=new Set(history.map(act=>act.sourceGrantEventId));
 // Resolve deaths and forfeitures in opening order. A committed award reserves its holder for the next chain.
 for(const last of active){
  const occupiedMembers=new Set(active.filter(act=>act!==last&&act.factionId===last.factionId&&act.epochFounderId===last.epochFounderId).map(act=>act.holderMemberId!));
  const next=planSingleTransition({...f,nobleSuccession:[last]},{...c,renewable:false,occupiedMembers});
  if(next)return {...next,step,eventId};
 }
 if(history.length&&!c.renewable)return;
 const candidates=f.members.flatMap(member=>{
  const person=c.people.find(p=>p.personId===member.militaryPersonId);
  const delayedFounder=!history.length&&member.militaryPersonId===f.founderPersonId&&
    member.deathMonth!==undefined&&member.deathMonth<=c.month&&member.enteredMonth<=member.deathMonth;
  if(!person||!delayedFounder&&!familyMemberPresent(member,c.month)||(c.politicalAccessions.get(member.memberId)??Infinity)<=c.month)return [];
  const country=familyResidenceAt(f,member,c.month);
  return (person.nobilityHistory??[]).filter(grant=>grant.factionId===country&&grant.month>=member.enteredMonth&&grant.month<=(member.deathMonth??c.month)&&
   !used.has(grant.eventId)&&c.activeEpochs.has(`${country}/${grant.epochFounderId}`)&&
   currentNobleGrant(person,country,c.month,grant.epochFounderId)?.eventId===grant.eventId&&
   !memberForfeiture(member,{...f,factionId:country,epochFounderId:grant.epochFounderId},c))
   .flatMap(grant=>{
    const prior=active.find(act=>act.holderMemberId===member.memberId&&act.factionId===country&&act.epochFounderId===grant.epochFounderId);
    if(prior&&FAMILY_NOBLE_RANKS.indexOf(prior.rank!)>=FAMILY_NOBLE_RANKS.indexOf(grant.rank))return [];
    return [{member,grant,prior}];
   });
 }).sort((a,b)=>a.grant.month-b.grant.month||NOBLE_RANKS.indexOf(b.grant.rank)-NOBLE_RANKS.indexOf(a.grant.rank)||a.member.memberId.localeCompare(b.member.memberId));
 const chosen=candidates[0];if(!chosen)return;
 const {member,grant,prior}=chosen,previousEventId=prior?.eventId??`${f.familyId}-founded`;
 return {version:2,period:prior?.period??periods.size+1,eventId,familyId:f.familyId,factionId:grant.factionId,
  epochFounderId:grant.epochFounderId,month:c.month,kind:prior?'UPGRADED':'STARTED',reason:'NEW_MERIT',
  sourceGrantEventId:grant.eventId,previousEventId,previousMemberId:member.memberId,previousRank:prior?.rank??grant.rank,
  holderMemberId:member.memberId,rank:grant.rank,step,sourceEventIds:[previousEventId,grant.eventId]};
}
export function familyNobleTitle(f:MilitaryFamily,m:MilitaryFamilyMember,month:number){const rank=familyNobleRankAt(f,m,month);return rank?FAMILY_NOBLE_NAMES[rank]:undefined;}
export function familyNobleText(f:MilitaryFamily,a:FamilyNobleAct){
 const old=f.members.find(m=>m.memberId===a.previousMemberId)!,heir=f.members.find(m=>m.memberId===a.holderMemberId);
 if(a.kind==='UPGRADED')return `${heir?.name??'持爵者'}以新功进爵为${FAMILY_NOBLE_NAMES[a.rank!]}，延续第${a.period}爵脉。`;
 if(a.kind==='STARTED')return `${heir?.name??'原授爵者'}以本人新功所获${FAMILY_NOBLE_NAMES[a.rank!]}开立${f.surname}氏第${a.period}期爵位传承，旧期史实保留。`;
 if(heir){
  const relation=a.kinship?.relation??'CHILD';
  const title=relation==='BROTHER'?(heir.bornMonth<old.bornMonth?'其兄':'其弟'):relation==='GRANDCHILD'?'其孙':relation==='NEPHEW'?'其侄':'其子';
  return `${old.name}卒后，${relation==='CHILD'?'':'无合格直接子嗣，'}${title}${heir.name}袭${FAMILY_NOBLE_NAMES[a.rank!]}。`;
 }
 if(a.reason==='NO_HEIR')return `${old.name}卒后，其爵无合格${a.kinship?'在籍近亲':'在籍子嗣'}接续，承袭链告终。`;
 if(a.reason==='RANK_EXHAUSTED')return `男爵${old.name}卒，世降已尽，爵位不再承袭。`;
 if(a.reason==='REGIME_ENDED')return `原朝政治权威已终结，${f.surname}氏旧爵承袭失效。`;
 const reasons:Record<string,string>={REVOKED:'原爵已被正式追夺，相关承袭终止',FORFEITED:'因谋逆受重处分，承袭资格终止',FOREIGN:'已离开原国，旧朝承袭终止',POLITICAL_ACCESSION:'已登位，旧朝承袭终止',ENTITY_ENDED:'在籍身份终止，相关承袭终止'};
 return `${old.name}${reasons[a.reason]??'承袭终止'}。`;
}

export function createFamilyNobleContext(month:number,families:readonly MilitaryFamily[],people:readonly MilitaryPerson[],events:readonly WorldEvent[],dynasties:readonly Pick<import('./Dynasty').Dynasty,'factionId'|'houseEpochs'|'rulers'>[]):FamilyNobleContext{
 const activeEpochs=new Set<string>(),politicalAccessions=new Map<string,number>();
 const terminalByFaction=new Map<string,WorldEvent>();
 for(const event of events){
  if(at(event)>month)continue;
  const factionId=event.type==='faction-merged'?event.metadata?.absorbedFactionId:
   event.type==='faction-submitted'?event.metadata?.submittedFactionId:
   event.type==='faction-exiled'||event.type==='faction-extinct'?event.targetFactionId:
   event.type==='dynasty-line-ended'||event.type==='faction-restored'||event.type==='dynasty-restored'?event.actorFactionId:undefined;
  if(typeof factionId!=='string')continue;
  const previous=terminalByFaction.get(factionId);
  if(!previous||at(previous)<=at(event))terminalByFaction.set(factionId,event);
 }
 for(const d of dynasties){
  const terminal=terminalByFaction.get(d.factionId);
  if(!terminal||['faction-restored','dynasty-restored'].includes(terminal.type))for(const ep of d.houseEpochs??[])if(ep.startMonth<=month&&(month<(ep.endMonth??Infinity)||ep.endMonth===month&&!events.some(e=>e.actorFactionId===d.factionId&&at(e)===month&&(e.type==='dynasty-usurped'||['ruler-acceded','ruler-succession','ruler-deposed'].includes(e.type)&&d.houseEpochs?.some(next=>next.startMonth===month&&next.foundingRulerId!==ep.foundingRulerId&&(e.rulerId===next.foundingRulerId||e.metadata?.nextRulerId===next.foundingRulerId))))))activeEpochs.add(`${d.factionId}/${ep.foundingRulerId}`);
 }
 const rulers=dynasties.flatMap(d=>d.rulers);
 for(const f of families)for(const m of f.members){const p=people.find(p=>p.personId===m.militaryPersonId),r=rulers.find(r=>p?.politicalRulerId===r.id||m.sourceUserId!==undefined&&r.residentIdentity?.sourceUserId===m.sourceUserId&&r.residentIdentity.bornMonth===m.bornMonth);if(r?.accessionYear!==undefined&&(r.accessionYear<month||events.some(e=>at(e)===r.accessionYear&&(e.rulerId===r.id||e.metadata?.nextRulerId===r.id||e.metadata?.foundingRulerId===r.id)&&['ruler-acceded','ruler-succession','ruler-deposed','dynasty-usurped','rebel-faction-founded','empire-split','frontier-faction-founded'].includes(e.type))))politicalAccessions.set(m.memberId,r.accessionYear);}
 const ids=new Set(events.map(e=>e.id));const historicalPeople=people.map(p=>({...p,nobilityHistory:p.nobilityHistory?.filter(g=>ids.has(g.eventId)),honorHistory:p.honorHistory?.filter(h=>ids.has(h.eventId)),politicalHistory:p.politicalHistory?.filter(h=>ids.has(h.eventId))}));
 return {month,people:historicalPeople,events,activeEpochs,politicalAccessions,dynasties};
}

/** Same-month deaths and transfers after a title transaction cannot be read backwards into it. */
export function familyAtEvidenceBoundary(f:MilitaryFamily,month:number,eventIndex:number,events?:readonly WorldEvent[],eventPositions?:ReadonlyMap<string,number>){const copy=structuredClone(f);
const positions=events?(eventPositions??new Map(events.map((e,i)=>[e.id,i]))):undefined;
 if(positions){copy.nobleSuccession=copy.nobleSuccession?.filter(a=>a.month<=month&&(positions.get(a.eventId)??Infinity)<eventIndex);copy.members=copy.members.filter(m=>m.enteredMonth<=month&&(positions.get(m.source==='FOUNDER'?`${f.familyId}-founded`:m.birth?m.birth.eventId:`${m.memberId}-entered`)??Infinity)<eventIndex);}
for(const m of copy.members){
 if(m.birth&&positions&&((positions.get(`${m.memberId}-population-entered`)??Infinity)>=eventIndex)){delete m.sourceUserId;delete m.populationEnteredMonth;delete m.militaryPersonId;}
 m.factionHistory=m.factionHistory?.filter(h=>h.month<month||h.month===month&&h.eventIndex<=eventIndex);
 if((m.deathMonth??-Infinity)>month||m.deathMonth===month&&(m.deathHistoryIndex??-1)>eventIndex){delete m.deathMonth;delete m.deathCause;}
 if((m.exitMonth??-Infinity)>month||m.exitMonth===month&&(m.exitHistoryIndex??-1)>eventIndex){delete m.exitMonth;delete m.exitCause;}
 }return copy;}
