import type {WorldEvent} from '../History/WorldHistory';
import type {NobleGrant} from './MilitaryNobility';
import {NOBLE_NAMES} from './MilitaryNobility';
import type {MilitaryAppanage} from './MilitaryAppanage';
import type {MilitaryHonor} from './MilitaryHonors';
export const militaryDeathWording=(cause?:string)=>cause==='NATURAL_DEATH'?'自然去世':cause==='BATTLE_DEATH'?'战死':cause==='SIEGE_LOSS'?'围城战乱中去世':'去世';
const month=(e:WorldEvent)=>e.monthIndex??e.year;
function read<T>(value:unknown):T|undefined{try{return typeof value==='string'?JSON.parse(value):undefined;}catch{return;}}
export interface MilitaryLifePair {anchor:WorldEvent;other:WorldEvent;text:string;kind:'GRANT_APPANAGE'|'DEATH_POSTHUMOUS'}
/** Frozen cross-references, never names or mere temporal proximity. No registry or simulation mutation. */
export function militaryLifePairs(events:readonly WorldEvent[]):MilitaryLifePair[]{
 const byId=new Map(events.map(e=>[e.id,e])),pairs:MilitaryLifePair[]=[],used=new Set<string>();
 for(const e of events){
  if(e.type==='military-appanage'){
   const a=read<MilitaryAppanage>(e.metadata?.appanage),n=a&&byId.get(a.nobleGrantEventId),g=n&&read<NobleGrant>(n.metadata?.nobility);
   if(!a||!n||!g||a.kind!=='GRANTED'||a.eventId!==e.id||a.grantEventId!==e.id||g.eventId!==n.id||n.type!=='military-ennobled'||used.has(n.id)||
    !a.personId||e.metadata?.personId!==a.personId||n.metadata?.personId!==a.personId||g.personId!==a.personId||month(n)!==month(e)||a.month!==month(e)||g.month!==month(n)||
    e.actorFactionId!==a.factionId||n.actorFactionId!==a.factionId||g.factionId!==a.factionId||g.epochFounderId!==a.epochFounderId||g.rulerId!==a.rulerId||!a.rulerId||e.rulerId!==a.rulerId||n.rulerId!==a.rulerId||
    g.rulerTitle!==a.rulerTitle||!g.rulerTitle||g.rank!==a.rank||!NOBLE_NAMES[g.rank]||g.countryName!==a.countryName||e.cityId!==a.cityId||!a.cityName)continue;
   pairs.push({anchor:n,other:e,kind:'GRANT_APPANAGE',text:`${g.rulerTitle}以军功${g.previousRank==='NONE'?'封':'进封'}${g.personalName}为${NOBLE_NAMES[g.rank]}，并赐${a.cityName}为食邑。`});used.add(n.id);
  }
  if(e.type==='military-posthumous'){
   // Authority is frozen by the committed honor transaction. Its older peerage may be outside a bounded history page.
   const h=read<MilitaryHonor>(e.metadata?.honor),death=h&&byId.get(h.sourceEventId),grant=h&&byId.get(h.grantEventId),g=grant&&read<NobleGrant>(grant.metadata?.nobility);
   if(!h||!death||h.kind!=='POSTHUMOUS'||h.eventId!==e.id||!h.epithet||!h.rulerTitle||!h.rulerId||e.rulerId!==h.rulerId||h.month!==month(e)||
    death.type!=='military-person-died'||month(death)!==month(e)||h.deathMonth!==month(death)||death.metadata?.personId!==h.personId||e.metadata?.personId!==h.personId||
    e.actorFactionId!==h.factionId||death.actorFactionId!==h.factionId||(grant&&(!g||g.eventId!==grant.id||g.personId!==h.personId||g.factionId!==h.factionId||g.epochFounderId!==h.epochFounderId||grant.type!=='military-ennobled'||g.month>month(death)))||used.has(death.id))continue;
   pairs.push({anchor:death,other:e,kind:'DEATH_POSTHUMOUS',text:`${h.personalName}${militaryDeathWording(typeof death.metadata?.deathCause==='string'?death.metadata.deathCause:undefined)}，同月获${h.rulerTitle}追谥“${h.epithet}”。`});used.add(death.id);
  }
 }
 return pairs;
}
export function mergeMilitaryLifeEvents(events:WorldEvent[]):WorldEvent[]{
 const pairs=militaryLifePairs(events),bySource=new Map(pairs.flatMap(p=>[[p.anchor.id,p],[p.other.id,p]] as const)),emitted=new Set<MilitaryLifePair>();
 return events.flatMap<WorldEvent>(e=>{const p=bySource.get(e.id);if(!p)return [e];if(emitted.has(p))return [];emitted.add(p);return [{...p.anchor,id:`history-military-${p.anchor.id}`,title:p.text,description:undefined,importance:p.anchor.importance==='major'||p.other.importance==='major'?'major':p.anchor.importance,cityId:p.anchor.cityId??p.other.cityId,cityName:p.anchor.cityName??p.other.cityName,metadata:{...p.anchor.metadata,historyNarrativeKind:'MILITARY_LIFE',sourceEventIds:[p.anchor.id,p.other.id].join(',')}}];});
}
