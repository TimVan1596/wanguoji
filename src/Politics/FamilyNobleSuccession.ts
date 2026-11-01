import type {MilitaryFamily,MilitaryFamilyMember} from './MilitaryFamily';
import type {MilitaryPerson} from './MilitaryCommandRegistry';
import type {WorldEvent} from '../History/WorldHistory';
import {NOBLE_RANKS} from './MilitaryNobility';
export const FAMILY_NOBLE_RANKS=['NAN','ZI','BO','HOU','GONG'] as const;
export type FamilyNobleRank=typeof FAMILY_NOBLE_RANKS[number];
export const FAMILY_NOBLE_NAMES:Record<FamilyNobleRank,string>={NAN:'男爵',ZI:'子爵',BO:'伯爵',HOU:'侯爵',GONG:'公爵'};
export interface FamilyNobleAct {
 version:1;eventId:string;familyId:string;factionId:string;epochFounderId:string;month:number;
 kind:'SUCCEEDED'|'ENDED';reason:'DEATH'|'NO_HEIR'|'RANK_EXHAUSTED'|'REVOKED'|'FORFEITED'|'FOREIGN'|'POLITICAL_ACCESSION'|'REGIME_ENDED'|'ENTITY_ENDED';
 sourceGrantEventId:string;previousEventId:string;previousMemberId:string;previousRank:FamilyNobleRank;
 holderMemberId?:string;rank?:FamilyNobleRank;step:number;sourceEventIds:string[];
}
export interface FamilyNobleContext {month:number;people:readonly MilitaryPerson[];events:readonly WorldEvent[];activeEpochs:ReadonlySet<string>;politicalAccessions:ReadonlyMap<string,number>;}
const at=(e:WorldEvent)=>e.monthIndex??e.year;
export function familyResidenceAt(f:MilitaryFamily,m:MilitaryFamilyMember,month:number){return m.factionHistory?.filter(h=>h.month<=month).at(-1)?.factionId??f.factionId;}
export function familyMemberPresent(m:MilitaryFamilyMember,month:number){return m.enteredMonth<=month&&(m.deathMonth??Infinity)>month&&(m.exitMonth??Infinity)>month;}
function memberForfeiture(m:MilitaryFamilyMember,f:MilitaryFamily,c:FamilyNobleContext){const p=c.people.find(p=>p.personId===m.militaryPersonId);return p?.politicalHistory?.find(b=>b.kind==='COURT_BAN'&&b.severity==='FORFEITURE'&&b.factionId===f.factionId&&b.epochFounderId===f.epochFounderId&&b.month<=c.month);}
export function eligibleFamilyNobleHeirs(f:MilitaryFamily,parentId:string,c:FamilyNobleContext){return f.members.filter(m=>m.parentMemberId===parentId&&familyMemberPresent(m,c.month)&&familyResidenceAt(f,m,c.month)===f.factionId&&!memberForfeiture(m,f,c)&&(c.politicalAccessions.get(m.memberId)??Infinity)>c.month).sort((a,b)=>a.bornMonth-b.bornMonth||a.memberId.localeCompare(b.memberId));}
/** One chain per family. New personal military grants never overwrite an inherited title. */
export function planFamilyNobleTransition(f:MilitaryFamily,c:FamilyNobleContext):FamilyNobleAct|undefined{
 const history=f.nobleSuccession?.filter(a=>a.month<=c.month)??[],last=history.at(-1);if(last?.kind==='ENDED')return;
 const founder=c.people.find(p=>p.personId===f.founderPersonId),grant=last?founder?.nobilityHistory?.find(g=>g.eventId===last.sourceGrantEventId):founder?.nobilityHistory?.filter(g=>g.factionId===f.factionId&&g.epochFounderId===f.epochFounderId&&g.month<=Math.min(c.month,founder.deathMonth??Infinity)).sort((a,b)=>NOBLE_RANKS.indexOf(b.rank)-NOBLE_RANKS.indexOf(a.rank)||b.month-a.month)[0];
 if(!grant)return;
 const holder=f.members.find(m=>m.memberId===(last?.holderMemberId??f.members.find(m=>m.militaryPersonId===f.founderPersonId)?.memberId));if(!holder)return;
 const previousRank=last?.rank??grant.rank,previousEventId=last?.eventId??grant.eventId,sourceEventIds=[previousEventId],step=(last?.step??0)+1;
 let reason:FamilyNobleAct['reason']|undefined;
 if(!c.activeEpochs.has(`${f.factionId}/${f.epochFounderId}`))reason='REGIME_ENDED';
 else if(familyResidenceAt(f,holder,c.month)!==f.factionId)reason='FOREIGN';
 else if((c.politicalAccessions.get(holder.memberId)??Infinity)<=c.month)reason='POLITICAL_ACCESSION';
 else if(memberForfeiture(holder,f,c)){reason='FORFEITED';sourceEventIds.push(memberForfeiture(holder,f,c)!.eventId);}
 else if(!last&&founder?.honorHistory?.some(h=>h.kind==='REVOKED'&&h.factionId===f.factionId&&h.epochFounderId===f.epochFounderId&&h.month<=c.month)){reason='REVOKED';sourceEventIds.push(founder.honorHistory.find(h=>h.kind==='REVOKED'&&h.factionId===f.factionId&&h.epochFounderId===f.epochFounderId&&h.month<=c.month)!.eventId);}
 else if(holder.deathMonth!==undefined&&holder.deathMonth<=c.month){reason='DEATH';const death=c.events.find(e=>e.type==='military-person-died'&&e.metadata?.personId===holder.militaryPersonId&&at(e)===holder.deathMonth);sourceEventIds.push(death?.id??`${f.familyId}-${holder.memberId}-death`);}
 else if(holder.exitMonth!==undefined&&holder.exitMonth<=c.month)reason='ENTITY_ENDED';
 if(!reason)return;
 const rank=FAMILY_NOBLE_RANKS[FAMILY_NOBLE_RANKS.indexOf(previousRank)-1],heir=reason==='DEATH'&&rank?eligibleFamilyNobleHeirs(f,holder.memberId,c)[0]:undefined;
 if(reason==='DEATH'&&!heir)reason=rank?'NO_HEIR':'RANK_EXHAUSTED';
 return {version:1,eventId:`${f.familyId}-succession-${step}`,familyId:f.familyId,factionId:f.factionId,epochFounderId:f.epochFounderId,month:c.month,kind:heir?'SUCCEEDED':'ENDED',reason,sourceGrantEventId:grant.eventId,previousEventId,previousMemberId:holder.memberId,previousRank,...(heir?{holderMemberId:heir.memberId,rank}:{}),step,sourceEventIds};
}
export function familyNobleTitle(f:MilitaryFamily,m:MilitaryFamilyMember,month:number){const a=f.nobleSuccession?.filter(a=>a.month<=month).at(-1);return a?.kind==='SUCCEEDED'&&a.holderMemberId===m.memberId&&familyMemberPresent(m,month)&&familyResidenceAt(f,m,month)===f.factionId&&a.rank?FAMILY_NOBLE_NAMES[a.rank]:undefined;}
export function familyNobleText(f:MilitaryFamily,a:FamilyNobleAct){const old=f.members.find(m=>m.memberId===a.previousMemberId)!,heir=f.members.find(m=>m.memberId===a.holderMemberId);if(heir)return `${old.name}卒后，其子${heir.name}袭${FAMILY_NOBLE_NAMES[a.rank!]}。`;const reasons:Record<string,string>={NO_HEIR:'无合格在籍子嗣，爵位断袭',RANK_EXHAUSTED:'男爵世降已尽，爵位不再承袭',REVOKED:'原爵已正式追夺，承袭终止',FORFEITED:'本人因谋逆受重处分，承袭资格终止',FOREIGN:'持爵者已离开原国，旧朝承袭终止',POLITICAL_ACCESSION:'持爵者已登位，承袭终止',REGIME_ENDED:'原朝政治权威已终结，旧爵承袭失效',ENTITY_ENDED:'持爵者人口身份已终结，承袭终止'};return `${f.surname}氏${reasons[a.reason]??'承袭终止'}。`;}
export function createFamilyNobleContext(month:number,families:readonly MilitaryFamily[],people:readonly MilitaryPerson[],events:readonly WorldEvent[],dynasties:readonly Pick<import('./Dynasty').Dynasty,'factionId'|'houseEpochs'|'rulers'>[]):FamilyNobleContext{
 const activeEpochs=new Set<string>(),politicalAccessions=new Map<string,number>();
 for(const d of dynasties){
  const terminal=events.filter(e=>at(e)<=month&&(['faction-exiled','faction-extinct'].includes(e.type)?e.targetFactionId===d.factionId:e.actorFactionId===d.factionId)&&['faction-exiled','faction-extinct','faction-merged','faction-submitted','dynasty-line-ended','faction-restored','dynasty-restored'].includes(e.type)).at(-1);
  if(!terminal||['faction-restored','dynasty-restored'].includes(terminal.type))for(const ep of d.houseEpochs??[])if(ep.startMonth<=month&&(month<(ep.endMonth??Infinity)||ep.endMonth===month&&!events.some(e=>e.actorFactionId===d.factionId&&at(e)===month&&e.type==='dynasty-usurped')))activeEpochs.add(`${d.factionId}/${ep.foundingRulerId}`);
 }
 const rulers=dynasties.flatMap(d=>d.rulers);
 for(const f of families)for(const m of f.members){const p=people.find(p=>p.personId===m.militaryPersonId),r=rulers.find(r=>p?.politicalRulerId===r.id||r.residentIdentity?.sourceUserId===m.sourceUserId&&r.residentIdentity.bornMonth===m.bornMonth);if(r?.accessionYear!==undefined&&(r.accessionYear<month||events.some(e=>at(e)===r.accessionYear&&(e.rulerId===r.id||e.metadata?.nextRulerId===r.id||e.metadata?.foundingRulerId===r.id)&&['ruler-acceded','ruler-succession','ruler-deposed','dynasty-usurped','rebel-faction-founded','empire-split','frontier-faction-founded'].includes(e.type))))politicalAccessions.set(m.memberId,r.accessionYear);}
 const ids=new Set(events.map(e=>e.id));const historicalPeople=people.map(p=>({...p,nobilityHistory:p.nobilityHistory?.filter(g=>ids.has(g.eventId)),honorHistory:p.honorHistory?.filter(h=>ids.has(h.eventId)),politicalHistory:p.politicalHistory?.filter(h=>ids.has(h.eventId))}));
 return {month,people:historicalPeople,events,activeEpochs,politicalAccessions};
}

/** Same-month deaths and transfers after a title transaction cannot be read backwards into it. */
export function familyAtEvidenceBoundary(f:MilitaryFamily,month:number,eventIndex:number){const copy=structuredClone(f);for(const m of copy.members){
 m.factionHistory=m.factionHistory?.filter(h=>h.month<month||h.month===month&&h.eventIndex<=eventIndex);
 if(m.deathMonth===month&&(m.deathHistoryIndex??-1)>eventIndex){delete m.deathMonth;delete m.deathCause;}
 if(m.exitMonth===month&&(m.exitHistoryIndex??-1)>eventIndex){delete m.exitMonth;delete m.exitCause;}
 }return copy;}
