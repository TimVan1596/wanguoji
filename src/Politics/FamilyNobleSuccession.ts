import type {MilitaryFamily,MilitaryFamilyMember} from './MilitaryFamily';
import type {MilitaryPerson} from './MilitaryCommandRegistry';
import type {WorldEvent} from '../History/WorldHistory';
import {NOBLE_RANKS,currentNobleGrant} from './MilitaryNobility';
export const FAMILY_NOBLE_RANKS=['NAN','ZI','BO','HOU','GONG'] as const;
export type FamilyNobleRank=typeof FAMILY_NOBLE_RANKS[number];
export const FAMILY_NOBLE_NAMES:Record<FamilyNobleRank,string>={NAN:'男爵',ZI:'子爵',BO:'伯爵',HOU:'侯爵',GONG:'公爵'};
export interface FamilyNobleAct {
 version:1|2;period?:number;eventId:string;familyId:string;factionId:string;epochFounderId:string;month:number;
 kind:'STARTED'|'SUCCEEDED'|'ENDED';reason:'NEW_MERIT'|'DEATH'|'NO_HEIR'|'RANK_EXHAUSTED'|'REVOKED'|'FORFEITED'|'FOREIGN'|'POLITICAL_ACCESSION'|'REGIME_ENDED'|'ENTITY_ENDED';
 sourceGrantEventId:string;previousEventId:string;previousMemberId:string;previousRank:FamilyNobleRank;
 holderMemberId?:string;rank?:FamilyNobleRank;step:number;sourceEventIds:string[];
}
export interface FamilyNobleContext {renewable?:boolean;month:number;people:readonly MilitaryPerson[];events:readonly WorldEvent[];activeEpochs:ReadonlySet<string>;politicalAccessions:ReadonlyMap<string,number>;}
const at=(e:WorldEvent)=>e.monthIndex??e.year;
export function familyResidenceAt(f:MilitaryFamily,m:MilitaryFamilyMember,month:number){return m.factionHistory?.filter(h=>h.month<=month).at(-1)?.factionId??f.factionId;}
export function familyMemberPresent(m:MilitaryFamilyMember,month:number){return m.enteredMonth<=month&&(m.deathMonth??Infinity)>month&&(m.exitMonth??Infinity)>month;}
function memberForfeiture(m:MilitaryFamilyMember,f:MilitaryFamily,c:FamilyNobleContext){const p=c.people.find(p=>p.personId===m.militaryPersonId);return p?.politicalHistory?.filter(b=>b.kind==='COURT_BAN'&&['FORFEITURE','EXECUTION'].includes(b.severity)&&b.factionId===f.factionId&&b.epochFounderId===f.epochFounderId&&b.month<=c.month&&(!b.eventId||c.events.some(e=>e.id===b.eventId))).at(-1);}
export function eligibleFamilyNobleHeirs(f:MilitaryFamily,parentId:string,c:FamilyNobleContext){return f.members.filter(m=>m.parentMemberId===parentId&&familyMemberPresent(m,c.month)&&familyResidenceAt(f,m,c.month)===f.factionId&&!memberForfeiture(m,f,c)&&(c.politicalAccessions.get(m.memberId)??Infinity)>c.month).sort((a,b)=>a.bornMonth-b.bornMonth||a.memberId.localeCompare(b.memberId));}
/** One active main period; a distinct valid personal grant is the only source of a new period. */
function planNewPeriod(f:MilitaryFamily,c:FamilyNobleContext,last:FamilyNobleAct):FamilyNobleAct|undefined{
 if(!c.renewable||!c.activeEpochs.has(`${f.factionId}/${f.epochFounderId}`))return;
 const used=new Set((f.nobleSuccession??[]).map(a=>a.sourceGrantEventId));
 const candidates=f.members.flatMap(m=>{
  if(m.generation===0||!m.militaryPersonId||!familyMemberPresent(m,c.month)||familyResidenceAt(f,m,c.month)!==f.factionId||memberForfeiture(m,f,c)||(c.politicalAccessions.get(m.memberId)??Infinity)<=c.month)return [];
  if(last.kind!=='ENDED'&&last.holderMemberId!==m.memberId)return [];
  const p=c.people.find(p=>p.personId===m.militaryPersonId),g=p&&currentNobleGrant(p,f.factionId,c.month,f.epochFounderId);
  if(!g||used.has(g.eventId)||g.month<m.enteredMonth||!c.events.some(e=>e.id===g.eventId)||last.kind!=='ENDED'&&FAMILY_NOBLE_RANKS.indexOf(g.rank)<=FAMILY_NOBLE_RANKS.indexOf(last.rank!))return [];
  return [{m,g}];
 }).sort((a,b)=>FAMILY_NOBLE_RANKS.indexOf(b.g.rank)-FAMILY_NOBLE_RANKS.indexOf(a.g.rank)||a.g.month-b.g.month||a.m.memberId.localeCompare(b.m.memberId));
 const chosen=candidates[0];if(!chosen)return;
 const step=last.step+1;
 return {version:2,period:(last.period??1)+1,eventId:`${f.familyId}-succession-${step}`,familyId:f.familyId,factionId:f.factionId,epochFounderId:f.epochFounderId,month:c.month,kind:'STARTED',reason:'NEW_MERIT',sourceGrantEventId:chosen.g.eventId,previousEventId:last.eventId,previousMemberId:last.holderMemberId??last.previousMemberId,previousRank:last.rank??last.previousRank,holderMemberId:chosen.m.memberId,rank:chosen.g.rank,step,sourceEventIds:[last.eventId,chosen.g.eventId]};
}
export function planFamilyNobleTransition(f:MilitaryFamily,c:FamilyNobleContext):FamilyNobleAct|undefined{
 const history=f.nobleSuccession?.filter(a=>a.month<=c.month)??[],last=history.at(-1);if(last){const next=planNewPeriod(f,c,last);if(next)return next;if(last.kind==='ENDED')return;}
 const founder=c.people.find(p=>p.personId===f.founderPersonId),grant=last?c.people.flatMap(p=>p.nobilityHistory??[]).find(g=>g.eventId===last.sourceGrantEventId):(founder?currentNobleGrant(founder,f.factionId,Math.min(c.month,founder.deathMonth??Infinity),f.epochFounderId):undefined)??founder?.nobilityHistory?.filter(g=>g.factionId===f.factionId&&g.epochFounderId===f.epochFounderId&&g.month<=Math.min(c.month,founder.deathMonth??Infinity)).sort((a,b)=>NOBLE_RANKS.indexOf(b.rank)-NOBLE_RANKS.indexOf(a.rank)||b.month-a.month)[0];
 if(!grant)return;
 const holder=f.members.find(m=>m.memberId===(last?.holderMemberId??f.members.find(m=>m.militaryPersonId===f.founderPersonId)?.memberId));if(!holder)return;
 const previousRank=last?.rank??grant.rank,previousEventId=last?.eventId??grant.eventId,sourceEventIds=[previousEventId],step=(last?.step??0)+1;
 let reason:FamilyNobleAct['reason']|undefined;
 if(!c.activeEpochs.has(`${f.factionId}/${f.epochFounderId}`))reason='REGIME_ENDED';
 else if(familyResidenceAt(f,holder,c.month)!==f.factionId)reason='FOREIGN';
 else if((c.politicalAccessions.get(holder.memberId)??Infinity)<=c.month)reason='POLITICAL_ACCESSION';
 else if(memberForfeiture(holder,f,c)&&memberForfeiture(holder,f,c)!.month>=(last?.month??grant.month)){reason='FORFEITED';sourceEventIds.push(memberForfeiture(holder,f,c)!.eventId);}
 else if((!last||last.kind==='STARTED')&&c.people.find(p=>p.nobilityHistory?.some(g=>g.eventId===grant.eventId))?.honorHistory?.some(h=>h.kind==='REVOKED'&&h.month>=grant.month&&h.factionId===f.factionId&&h.epochFounderId===f.epochFounderId&&h.month<=c.month)){reason='REVOKED';sourceEventIds.push(c.people.find(p=>p.nobilityHistory?.some(g=>g.eventId===grant.eventId))!.honorHistory!.find(h=>h.kind==='REVOKED'&&h.month>=grant.month&&h.factionId===f.factionId&&h.epochFounderId===f.epochFounderId&&h.month<=c.month)!.eventId);}
 else if(holder.deathMonth!==undefined&&holder.deathMonth<=c.month){reason='DEATH';const death=c.events.find(e=>e.type==='military-person-died'&&e.metadata?.personId===holder.militaryPersonId&&at(e)===holder.deathMonth);sourceEventIds.push(death?.id??`${f.familyId}-${holder.memberId}-death`);}
 else if(holder.exitMonth!==undefined&&holder.exitMonth<=c.month)reason='ENTITY_ENDED';
 if(!reason)return;
 const rank=FAMILY_NOBLE_RANKS[FAMILY_NOBLE_RANKS.indexOf(previousRank)-1];
 const deathIndex=reason==='DEATH'?c.events.findIndex(e=>e.id===sourceEventIds.at(-1)):-1;
 const evidence=deathIndex>=0?familyAtEvidenceBoundary(f,holder.deathMonth!,deathIndex+1,c.events):f;
 const heir=reason==='DEATH'&&rank?eligibleFamilyNobleHeirs(evidence,holder.memberId,{...c,month:holder.deathMonth!,events:deathIndex>=0?c.events.slice(0,deathIndex+1):c.events}).find(candidate=>{const current=f.members.find(m=>m.memberId===candidate.memberId)!;return familyMemberPresent(current,c.month)&&familyResidenceAt(f,current,c.month)===f.factionId&&!memberForfeiture(current,f,c)&&(c.politicalAccessions.get(current.memberId)??Infinity)>c.month;}):undefined;
 if(reason==='DEATH'&&!heir)reason=rank?'NO_HEIR':'RANK_EXHAUSTED';
 return {version:last?.version===2?2:1,...(last?.period?{period:last.period}:{}),eventId:`${f.familyId}-succession-${step}`,familyId:f.familyId,factionId:f.factionId,epochFounderId:f.epochFounderId,month:c.month,kind:heir?'SUCCEEDED':'ENDED',reason,sourceGrantEventId:grant.eventId,previousEventId,previousMemberId:holder.memberId,previousRank,...(heir?{holderMemberId:heir.memberId,rank}:{}),step,sourceEventIds};
}
export function familyNobleTitle(f:MilitaryFamily,m:MilitaryFamilyMember,month:number){const a=f.nobleSuccession?.filter(a=>a.month<=month).at(-1);return a&&a.kind!=='ENDED'&&a.holderMemberId===m.memberId&&familyMemberPresent(m,month)&&familyResidenceAt(f,m,month)===f.factionId&&a.rank?FAMILY_NOBLE_NAMES[a.rank]:undefined;}
export function familyNobleText(f:MilitaryFamily,a:FamilyNobleAct){
 const old=f.members.find(m=>m.memberId===a.previousMemberId)!,heir=f.members.find(m=>m.memberId===a.holderMemberId);
 if(a.kind==='STARTED')return `${heir?.name??'原授爵者'}以本人新功所获${FAMILY_NOBLE_NAMES[a.rank!]}开立${f.surname}氏第${a.period}期爵位传承，旧期史实保留。`;
 if(heir)return `${old.name}卒后，其子${heir.name}袭${FAMILY_NOBLE_NAMES[a.rank!]}。`;
 if(a.reason==='NO_HEIR')return `${old.name}卒后，其爵无合格在籍子嗣接续，承袭链告终。`;
 if(a.reason==='RANK_EXHAUSTED')return `男爵${old.name}卒，世降已尽，爵位不再承袭。`;
 if(a.reason==='REGIME_ENDED')return `原朝政治权威已终结，${f.surname}氏旧爵承袭失效。`;
 const reasons:Record<string,string>={REVOKED:'原爵已被正式追夺，相关承袭终止',FORFEITED:'因谋逆受重处分，承袭资格终止',FOREIGN:'已离开原国，旧朝承袭终止',POLITICAL_ACCESSION:'已登位，旧朝承袭终止',ENTITY_ENDED:'在籍身份终止，相关承袭终止'};
 return `${old.name}${reasons[a.reason]??'承袭终止'}。`;
}

export function createFamilyNobleContext(month:number,families:readonly MilitaryFamily[],people:readonly MilitaryPerson[],events:readonly WorldEvent[],dynasties:readonly Pick<import('./Dynasty').Dynasty,'factionId'|'houseEpochs'|'rulers'>[]):FamilyNobleContext{
 const activeEpochs=new Set<string>(),politicalAccessions=new Map<string,number>();
 for(const d of dynasties){
  const terminal=events.filter(e=>at(e)<=month&&(e.type==='faction-merged'?e.metadata?.absorbedFactionId===d.factionId:e.type==='faction-submitted'?e.metadata?.submittedFactionId===d.factionId:['faction-exiled','faction-extinct'].includes(e.type)?e.targetFactionId===d.factionId:e.actorFactionId===d.factionId)&&['faction-exiled','faction-extinct','faction-merged','faction-submitted','dynasty-line-ended','faction-restored','dynasty-restored'].includes(e.type)).sort((a,b)=>at(a)-at(b)).at(-1);
  if(!terminal||['faction-restored','dynasty-restored'].includes(terminal.type))for(const ep of d.houseEpochs??[])if(ep.startMonth<=month&&(month<(ep.endMonth??Infinity)||ep.endMonth===month&&!events.some(e=>e.actorFactionId===d.factionId&&at(e)===month&&(e.type==='dynasty-usurped'||['ruler-acceded','ruler-succession','ruler-deposed'].includes(e.type)&&d.houseEpochs?.some(next=>next.startMonth===month&&next.foundingRulerId!==ep.foundingRulerId&&(e.rulerId===next.foundingRulerId||e.metadata?.nextRulerId===next.foundingRulerId))))))activeEpochs.add(`${d.factionId}/${ep.foundingRulerId}`);
 }
 const rulers=dynasties.flatMap(d=>d.rulers);
 for(const f of families)for(const m of f.members){const p=people.find(p=>p.personId===m.militaryPersonId),r=rulers.find(r=>p?.politicalRulerId===r.id||m.sourceUserId!==undefined&&r.residentIdentity?.sourceUserId===m.sourceUserId&&r.residentIdentity.bornMonth===m.bornMonth);if(r?.accessionYear!==undefined&&(r.accessionYear<month||events.some(e=>at(e)===r.accessionYear&&(e.rulerId===r.id||e.metadata?.nextRulerId===r.id||e.metadata?.foundingRulerId===r.id)&&['ruler-acceded','ruler-succession','ruler-deposed','dynasty-usurped','rebel-faction-founded','empire-split','frontier-faction-founded'].includes(e.type))))politicalAccessions.set(m.memberId,r.accessionYear);}
 const ids=new Set(events.map(e=>e.id));const historicalPeople=people.map(p=>({...p,nobilityHistory:p.nobilityHistory?.filter(g=>ids.has(g.eventId)),honorHistory:p.honorHistory?.filter(h=>ids.has(h.eventId)),politicalHistory:p.politicalHistory?.filter(h=>ids.has(h.eventId))}));
 return {month,people:historicalPeople,events,activeEpochs,politicalAccessions};
}

/** Same-month deaths and transfers after a title transaction cannot be read backwards into it. */
export function familyAtEvidenceBoundary(f:MilitaryFamily,month:number,eventIndex:number,events?:readonly WorldEvent[],eventPositions?:ReadonlyMap<string,number>){const copy=structuredClone(f);
const positions=events?(eventPositions??new Map(events.map((e,i)=>[e.id,i]))):undefined;
 if(positions){copy.nobleSuccession=copy.nobleSuccession?.filter(a=>a.month<=month&&(positions.get(a.eventId)??Infinity)<eventIndex);copy.members=copy.members.filter(m=>m.enteredMonth<=month&&(positions.get(m.source==='FOUNDER'?`${f.familyId}-founded`:m.birth?m.birth.eventId:`${m.memberId}-entered`)??Infinity)<eventIndex);}
for(const m of copy.members){
 if(m.birth&&positions&&((positions.get(`${m.memberId}-population-entered`)??Infinity)>=eventIndex)){delete m.sourceUserId;delete m.populationEnteredMonth;delete m.militaryPersonId;}
 m.factionHistory=m.factionHistory?.filter(h=>h.month<month||h.month===month&&h.eventIndex<=eventIndex);
 if(m.deathMonth===month&&(m.deathHistoryIndex??-1)>eventIndex){delete m.deathMonth;delete m.deathCause;}
 if(m.exitMonth===month&&(m.exitHistoryIndex??-1)>eventIndex){delete m.exitMonth;delete m.exitCause;}
 }return copy;}
