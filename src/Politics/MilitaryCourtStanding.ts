import {deriveMilitaryLifeSchedule} from './MilitaryLifeRules';
import type {MilitaryPerson} from './MilitaryCommandRegistry';
import type {Dynasty} from './Dynasty';
import type {CourtCoupRecord} from './CourtCoup';
import type {WorldEvent} from '../History/WorldHistory';
import {nobleEpochForRuler} from './MilitaryNobility';
import {honorAuthority} from './MilitaryHonors';
export interface MilitaryCourtAct {
 version:1;stability:number;eventId:string;kind:'COURT_BAN'|'COURT_PARDONED';month:number;personId:string;sourceUserId:number;bornMonth:number;personalName:string;
 factionId:string;epochFounderId:string;rulerId:string;rulerTitle:string;countryName:string;victimRulerId:string;
 courtCoupEventId:string;courtResultEventId:string;banEventId?:string;severity:'DISMISSAL'|'FORFEITURE';sourceEventIds:string[];
}
const at=(e:WorldEvent)=>e.monthIndex??e.year;
/** A later accession never erases the ban. Only a sourced pardon cancels this authority's disability. */
export function unresolvedCourtBans(p:Pick<MilitaryPerson,'politicalHistory'>,factionId:string,month:number,epochFounderId?:string){
 const acts=p.politicalHistory??[];return acts.filter(a=>a.kind==='COURT_BAN'&&a.factionId===factionId&&a.month<=month&&(!epochFounderId||a.epochFounderId===epochFounderId)&&!acts.some(b=>b.kind==='COURT_PARDONED'&&b.banEventId===a.eventId&&b.month<=month));
}
/** Severity comes from actual command reach, not ambition, peerage or a new punishment draw. */
export function courtFailureSeverity(r:CourtCoupRecord):MilitaryCourtAct['severity']{return r.participant.unitCount>=3&&['JIANGJUN','SHANGJIANGJUN'].includes(r.participant.officeStanding?.office??'')?'FORFEITURE':'DISMISSAL';}
export function planCourtBan(p:MilitaryPerson,team:any,dy:Dynasty,attempt:WorldEvent,result:WorldEvent):MilitaryCourtAct|undefined{
 let r:CourtCoupRecord;try{r=JSON.parse(String(attempt.metadata?.courtCoup));}catch{return;}
 const authority=honorAuthority(team,dy,r.month);
 if(r.outcome!=='FAILED'||attempt.type!=='court-coup-attempt'||result.type!=='court-coup-result'||r.outcomeEventId!==result.id||result.metadata?.courtCoupEventId!==attempt.id||r.participant.personId!==p.personId||r.participant.sourceUserId!==p.sourceUserId||r.participant.bornMonth!==p.bornMonth||!authority||authority.rulerId!==r.previousRulerId||authority.factionId!==r.factionId||p.deathMonth!==undefined||p.factionId!==team.name||p.politicalHistory?.some(a=>a.courtCoupEventId===attempt.id))return;
 return {...authority,version:1,stability:r.stability,eventId:`${attempt.id}-ban`,kind:'COURT_BAN',month:r.month,personId:p.personId,sourceUserId:p.sourceUserId,bornMonth:p.bornMonth,personalName:p.personalName,victimRulerId:r.previousRulerId,courtCoupEventId:attempt.id,courtResultEventId:result.id,severity:courtFailureSeverity(r),sourceEventIds:[attempt.id,result.id]};
}
/** A stable new sovereign may pardon the real officer who once sought to enthrone him.
 * The victim must have truly lost political office or died; the named claimant is not deemed complicit. */
export function planCourtPardon(p:MilitaryPerson,team:any,dy:Dynasty,month:number,events:readonly WorldEvent[],stability:number):MilitaryCourtAct|undefined{
 const a=honorAuthority(team,dy,month),king=dy.rulers.find(r=>r.id===dy.currentRulerId);if(month>=deriveMilitaryLifeSchedule(p).naturalDeathMonth||!Number.isFinite(stability)||stability<55||stability>100||!a||!king||month%12!==0||month-(king.accessionYear??month)<12||p.status!=='RETIRED'||p.deathMonth!==undefined||p.politicalRulerId||p.factionId!==team.name)return;
 for(const ban of unresolvedCourtBans(p,team.name,month,a.epochFounderId)){
  const victim=dy.rulers.find(r=>r.id===ban.victimRulerId),attempt=events.find(e=>e.id===ban.courtCoupEventId);let record:CourtCoupRecord;try{record=JSON.parse(String(attempt?.metadata?.courtCoup));}catch{continue;}
  const death=events.find(e=>['ruler-died','heir-died','military-person-died'].includes(e.type)&&at(e)<=month&&(e.type==='military-person-died'?e.metadata?.personId===victim?.militaryIdentity?.personId:e.type==='heir-died'?e.metadata?.heirId===victim?.id:e.rulerId===victim?.id||e.metadata?.rulerId===victim?.id));
  const accession=events.find(e=>['ruler-succession','ruler-deposed'].includes(e.type)&&at(e)===(king.accessionYear??-1)&&(e.rulerId===king.id||e.metadata?.nextRulerId===king.id));
  const politicalEnd=events.find(e=>e.type==='ruler-deposed'&&e.metadata?.previousRulerId===victim?.id&&e.rulerId===king.id&&at(e)<=month),endSource=death??politicalEnd;
  if(!victim||!endSource||!(victim.deathMonth!==undefined&&victim.deathMonth<=month||victim.endYear!==undefined&&victim.endYear<=month&&politicalEnd)||!accession||record.targetRulerId!==king.id||king.id===ban.victimRulerId||month-ban.month<24||nobleEpochForRuler(dy,king.id)?.foundingRulerId!==ban.epochFounderId||p.politicalHistory?.some(x=>x.kind==='COURT_BAN'&&x.month>ban.month))continue;
  return {...ban,...a,eventId:`${ban.eventId}-pardon`,kind:'COURT_PARDONED',month,stability,banEventId:ban.eventId,sourceEventIds:[...new Set([ban.eventId,endSource.id,accession.id])]};
 }
 return undefined;
}
export function militaryCourtText(a:MilitaryCourtAct){return a.kind==='COURT_BAN'?`${a.rulerTitle}以${a.personalName}谋废之罪罢其军职，禁其在本朝复仕。`:`${a.rulerTitle}赦${a.personalName}旧罪，准其复仕。`;}
export function militaryCourtLabels(p:MilitaryPerson,factionId:string,month:number,epochFounderId?:string){
 const acts=p.politicalHistory?.filter(a=>a.factionId===factionId&&a.month<=month)??[];if(!acts.length)return [];
 const open=unresolvedCourtBans(p,factionId,month,epochFounderId),last=acts.at(-1)!;
 return [open.length?'因谋逆罢官 · 禁仕':last.kind==='COURT_PARDONED'?'曾因谋逆罢官 · 后获赦免':'曾因谋逆罢官',...((p.honorHistory??[]).filter(h=>h.kind==='REVOKED'&&h.reason==='COURT_COUP_FAILED'&&h.factionId===factionId&&h.month<=month).map(h=>`原${({BO:'伯爵',HOU:'侯爵',GONG:'公爵'} as const)[h.rank]} · 因谋逆已追夺`))];
}
