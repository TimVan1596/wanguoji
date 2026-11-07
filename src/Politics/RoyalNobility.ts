import type {Dynasty,Ruler} from './Dynasty';
import type {MilitaryPerson} from './MilitaryCommandRegistry';
import type {WorldEvent} from '../History/WorldHistory';
import {currentNobleGrant} from './MilitaryNobility';
import {FAMILY_NOBLE_NAMES as NAMES,FAMILY_NOBLE_RANKS as RANKS,type FamilyNobleRank} from './FamilyNobleSuccession';
import {verifiedRoyalRegistration} from './RoyalPersonRegistration';
export interface RoyalNobleAct {
 version:1;eventId:string;chainId:string;step:number;month:number;factionId:string;countryName:string;epochFounderId:string;
 kind:'GRANTED'|'UPGRADED'|'SUCCEEDED'|'ENDED';reason:'MERIT'|'DEATH'|'NO_HEIR'|'RANK_EXHAUSTED'|'REVOKED'|'FORFEITED'|'ACCESSION'|'FOREIGN'|'REGIME_ENDED';
 sourceGrantEventId:string;previousEventId:string;previousRulerId:string;holderRulerId?:string;previousRank:FamilyNobleRank|'NONE';rank?:FamilyNobleRank;sourceEventIds:string[];
 /** Candidate cut-off is the actual death event, not the later monthly settlement. */
 deathEventId?:string;
}
const at=(e:WorldEvent)=>e.monthIndex??e.year;
const accessionTypes=new Set(['ruler-acceded','ruler-succession','ruler-deposed','dynasty-usurped','rebel-faction-founded','empire-split','frontier-faction-founded']);
export function royalNoblePerson(r:Ruler,people:readonly MilitaryPerson[]){return people.find(p=>p.bornMonth===r.bornYear&&p.royalIdentity?.rulerId===r.id&&p.royalIdentity.factionId===r.registration?.factionId&&r.militaryIdentity?.personId===p.personId&&r.militaryIdentity.sourceUserId===p.sourceUserId);}
function sourceGrant(r:Ruler,d:Dynasty,people:readonly MilitaryPerson[],events:readonly WorldEvent[],month:number,epoch:string){
 const p=royalNoblePerson(r,people);if(!p)return;
 const byId=new Set(events.map(e=>e.id)),g=currentNobleGrant({...p,nobilityHistory:p.nobilityHistory?.filter(g=>byId.has(g.eventId)),honorHistory:p.honorHistory?.filter(h=>byId.has(h.eventId))},d.factionId,Math.min(month,r.deathMonth??Infinity),epoch);
 return g&&!g.basis&&events.some(e=>e.id===g.eventId&&e.type==='military-ennobled'&&e.metadata?.nobility===JSON.stringify(g))?g:undefined;
}
function deathEvent(r:Ruler,people:readonly MilitaryPerson[],events:readonly WorldEvent[],month:number){
 if(r.deathMonth===undefined||r.deathMonth>month)return;
 const p=royalNoblePerson(r,people);
 return events.find(e=>at(e)===r.deathMonth&&(['ruler-died','heir-died','royal-kin-died'].includes(e.type)&&(e.rulerId===r.id||e.metadata?.heirId===r.id)||e.type==='military-person-died'&&p&&e.metadata?.personId===p.personId));
}
function incompatibility(r:Ruler,d:Dynasty,epoch:string,people:readonly MilitaryPerson[],events:readonly WorldEvent[],month:number){
 const p=royalNoblePerson(r,people),pid=p?.personId;
 if(events.some(e=>at(e)<=month&&accessionTypes.has(e.type)&&(e.rulerId===r.id||e.metadata?.nextRulerId===r.id||e.metadata?.foundingRulerId===r.id||pid&&e.metadata?.militaryPersonId===pid)))return 'ACCESSION' as const;
 if(p?.politicalHistory?.some(a=>a.kind==='COURT_BAN'&&['FORFEITURE','EXECUTION'].includes(a.severity)&&a.factionId===d.factionId&&a.epochFounderId===epoch&&a.month<=month&&events.some(e=>e.id===a.eventId)))return 'FORFEITED' as const;
 if(events.some(e=>e.type==='royal-person-transferred'&&e.rulerId===r.id&&e.actorFactionId===d.factionId&&at(e)<=month))return 'FOREIGN' as const;
 return undefined;
}
function activeEpoch(d:Dynasty,epoch:string,events:readonly WorldEvent[],month:number){
 const ep=d.houseEpochs?.find(e=>e.foundingRulerId===epoch);if(!ep||ep.startMonth>month||(ep.endMonth??Infinity)<month)return false;
 // A same-month replacement is authoritative only once its accession event exists.
 if(ep.endMonth===month&&events.some(e=>at(e)===month&&accessionTypes.has(e.type)&&d.houseEpochs?.some(n=>n.startMonth===month&&n.foundingRulerId!==epoch&&(e.rulerId===n.foundingRulerId||e.metadata?.nextRulerId===n.foundingRulerId))))return false;
 const end=events.filter(e=>at(e)<=month&&(['faction-exiled','faction-extinct','dynasty-line-ended','faction-restored','dynasty-restored'].includes(e.type)&&(e.actorFactionId===d.factionId||e.targetFactionId===d.factionId)||['faction-merged','faction-submitted'].includes(e.type)&&(e.metadata?.absorbedFactionId===d.factionId||e.metadata?.submittedFactionId===d.factionId))).at(-1);
 return !end||['faction-restored','dynasty-restored'].includes(end.type);
}
export function royalNobleHeirAssessments(d:Dynasty,holder:Ruler,epoch:string,people:readonly MilitaryPerson[],events:readonly WorldEvent[],month:number){
 const ids=new Set(events.map(e=>e.id)),held=new Map<string,RoyalNobleAct>();for(const a of d.royalNobility??[])if(ids.has(a.eventId))held.set(a.chainId,a);
 return d.rulers.filter(r=>r.parentId===holder.id).map(r=>{
  let reason:string|undefined;
  if(r.bornYear>month)reason='当时尚未出生';
  else if(!verifiedRoyalRegistration(r,d.factionId,events,month))reason='当时尚未完成可核验的王室亲缘登记';
  else if(r.houseName!==holder.houseName)reason='不属原授爵王统的直接亲缘记录';
  else if(deathEvent(r,people,events,month))reason='已在结算前去世';
  else {const block=incompatibility(r,d,epoch,people,events,month);if(block)reason={ACCESSION:'此前已正式登位，不能兼领原臣爵',FORFEITED:'本人已有阻断袭爵的正式重处分',FOREIGN:'本人此前已转属其他政权'}[block];}
  if(!reason&&[...held.values()].some(a=>a.kind!=='ENDED'&&a.holderRulerId===r.id))reason='已持另一条宗室爵链，单链制度不并袭';
  return {ruler:r,eligible:!reason,reason:reason??'符合当时直接承袭资格'};
 }).sort((a,b)=>a.ruler.bornYear-b.ruler.bornYear||a.ruler.id.localeCompare(b.ruler.id));
}
export function eligibleRoyalNobleHeirs(d:Dynasty,holder:Ruler,epoch:string,people:readonly MilitaryPerson[],events:readonly WorldEvent[],month:number){return royalNobleHeirAssessments(d,holder,epoch,people,events,month).filter(row=>row.eligible).map(row=>row.ruler);}
/** Pure, deterministic and one active chain per holder. No population, offices or RNG. */
export function nextRoyalNobleAct(d:Dynasty,people:readonly MilitaryPerson[],events:readonly WorldEvent[],month:number,status?:string,countryName?:string):RoyalNobleAct|undefined{
 const byId=new Map(events.map(e=>[e.id,e])),history=d.royalNobility??[],lasts=new Map<string,RoyalNobleAct>();for(const a of history)lasts.set(a.chainId,a);
 const make=(last:RoyalNobleAct,extra:Partial<RoyalNobleAct>):RoyalNobleAct=>({...last,step:last.step+1,eventId:`${last.chainId}-${last.step+1}`,month,previousEventId:last.eventId,previousRulerId:last.holderRulerId??last.previousRulerId,sourceEventIds:[last.eventId,last.sourceGrantEventId],deathEventId:undefined,...extra});
 for(const last of lasts.values()){
  if(last.kind==='ENDED')continue;
  const r=d.rulers.find(r=>r.id===last.holderRulerId);if(!r)continue;
  const source=people.flatMap(p=>p.nobilityHistory??[]).find(g=>g.eventId===last.sourceGrantEventId),sourcePerson=source&&people.find(p=>p.personId===source.personId);
  let reason:RoyalNobleAct['reason']|undefined;
  if(!activeEpoch(d,last.epochFounderId,events,month)||status==='EXTINCT')reason='REGIME_ENDED';
  else if(sourcePerson?.honorHistory?.some(h=>h.kind==='REVOKED'&&h.factionId===d.factionId&&h.epochFounderId===last.epochFounderId&&h.month>=source!.month&&h.month<=month&&byId.has(h.eventId)))reason='REVOKED';
  else reason=incompatibility(r,d,last.epochFounderId,people,events,month);
  if(reason)return make(last,{kind:'ENDED',reason,holderRulerId:undefined,rank:undefined,previousRank:last.rank!});
  const own=sourceGrant(r,d,people,events,month,last.epochFounderId);
  if(own&&RANKS.indexOf(own.rank)>RANKS.indexOf(last.rank!))return make(last,{kind:'UPGRADED',reason:'MERIT',sourceGrantEventId:own.eventId,rank:own.rank,previousRank:last.rank!,sourceEventIds:[last.eventId,own.eventId]});
  const death=deathEvent(r,people,events,month);if(!death)continue;
  const cutoff=events.slice(0,events.indexOf(death)+1),heir=eligibleRoyalNobleHeirs(d,r,last.epochFounderId,people,cutoff,at(death)).find(h=>![...lasts.values()].some(a=>a.chainId!==last.chainId&&a.kind!=='ENDED'&&a.holderRulerId===h.id)),rank=RANKS[RANKS.indexOf(last.rank!)-1];
  return make(last,{countryName:rank&&heir?(countryName??last.countryName):last.countryName,kind:rank&&heir?'SUCCEEDED':'ENDED',reason:!rank?'RANK_EXHAUSTED':heir?'DEATH':'NO_HEIR',holderRulerId:rank?heir?.id:undefined,rank:heir?rank:undefined,previousRank:last.rank!,deathEventId:death.id,sourceEventIds:[last.eventId,last.sourceGrantEventId,death.id,...rank&&heir?.registration?[heir.registration.eventId]:[]]});
 }
 for(const r of d.rulers.filter(r=>r.militaryIdentity&&people.some(p=>p.personId===r.militaryIdentity!.personId&&p.nobilityHistory?.some(g=>!g.basis)))){
  if(!verifiedRoyalRegistration(r,d.factionId,events,month))continue;
  for(const ep of d.houseEpochs??[]){
   if(lasts.has(`royal-noble-${r.id}-${ep.foundingRulerId}`))continue;
   if(!activeEpoch(d,ep.foundingRulerId,events,month)||status==='EXTINCT'||incompatibility(r,d,ep.foundingRulerId,people,events,month))continue;
   const g=sourceGrant(r,d,people,events,month,ep.foundingRulerId);if(!g||g.month<r.registration!.month)continue;
   const chainId=`royal-noble-${r.id}-${ep.foundingRulerId}`;
   if(lasts.has(chainId)||[...lasts.values()].some(a=>a.kind!=='ENDED'&&a.holderRulerId===r.id))continue;
   return {version:1,eventId:`${chainId}-1`,chainId,step:1,month,factionId:d.factionId,countryName:g.countryName,epochFounderId:ep.foundingRulerId,kind:'GRANTED',reason:'MERIT',sourceGrantEventId:g.eventId,previousEventId:g.eventId,previousRulerId:r.id,holderRulerId:r.id,previousRank:'NONE',rank:g.rank,sourceEventIds:[g.eventId,r.registration!.eventId]};
  }
 }
 return undefined;
}
export function royalNobleText(a:RoyalNobleAct,rulers:readonly Ruler[]){
 const name=(id?:string)=>{const r=rulers.find(r=>r.id===id);return r?r.houseName.replace(/氏$/,'')+r.givenName:'原持爵者';},prefix=/国$|朝$|义军$/.test(a.countryName)?a.countryName:`${a.countryName}国`;
 if(a.kind==='GRANTED')return `${prefix}${name(a.holderRulerId)}所受军功${NAMES[a.rank!]}立为宗室世降权源。`;
 if(a.kind==='UPGRADED')return `${prefix}${name(a.holderRulerId)}凭本人新军功进封${NAMES[a.rank!]}，原爵链升等。`;
 if(a.kind==='SUCCEEDED')return `${prefix}${NAMES[a.previousRank as FamilyNobleRank]}${name(a.previousRulerId)}去世，其子${name(a.holderRulerId)}袭${NAMES[a.rank!]}。`;
 const reason={NO_HEIR:'当时无已登记合格直接子嗣，爵位断袭',RANK_EXHAUSTED:'世降已尽，不再承袭',REVOKED:'原爵已被正式追夺',FORFEITED:'本人受正式重处分，承袭终止',ACCESSION:'已正式登位，原臣属爵位终止',FOREIGN:'已离开原政权，原爵终止',REGIME_ENDED:'原王统政治权威终结，旧爵失效',DEATH:'承袭终止',MERIT:'承袭终止'}[a.reason];
 return `${prefix}${name(a.previousRulerId)}${reason}。`;
}
