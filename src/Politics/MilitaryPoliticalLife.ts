import type {Dynasty} from './Dynasty';
import type {MilitaryPerson} from './MilitaryCommandRegistry';
import type {WorldEvent} from '../History/WorldHistory';
import type {HistoryFactionLike} from '../History/HistoryRenderRules';
import type {MilitaryChronicleEntry} from './MilitaryChronicle';
import {royalMilitaryArchive} from './RoyalArchiveIdentity';
import {getFactionDisplayNameAtMonth} from '../Simulation/FactionIdentity';
import {getRulerTitleAtMonth} from './RulerTitleRules';

/** Read-only bridge. A title alone, a shared name, or a military participation event is never accession proof. */
export function militaryPoliticalLife(person:MilitaryPerson,dynasties:readonly Dynasty[],events:readonly WorldEvent[],factions:ReadonlyMap<string,HistoryFactionLike>,month:number){
 if(!person.politicalRulerId)return undefined;
 const linked=dynasties.flatMap(d=>d.rulers.map(r=>({d,r}))).find(({d,r})=>r.id===person.politicalRulerId&&r.bornYear===person.bornMonth&&
  (r.militaryIdentity?.personId===person.personId&&royalMilitaryArchive(d,[person],events).has(r.id)||r.residentIdentity?.personId===person.personId&&r.residentIdentity.sourceUserId===person.sourceUserId&&r.residentIdentity.bornMonth===person.bornMonth&&r.residentIdentity.military?.personId===person.personId));
 if(!linked||linked.r.accessionYear===undefined||linked.r.accessionYear>month)return undefined;
 const {d,r}=linked,at=r.accessionYear!;
 const accession=events.find(e=>(e.monthIndex??e.year)===at&&e.actorFactionId===d.factionId&&
  (e.type==='ruler-acceded'&&e.rulerId===r.id||['ruler-succession','ruler-deposed'].includes(e.type)&&e.metadata?.nextRulerId===r.id||e.type==='dynasty-usurped'&&e.rulerId===r.id));
 const f=factions.get(d.factionId);if(!accession||!f)return undefined;
 const title=typeof accession.metadata?.rulerPoliticalTitle==='string'&&['首领','王','帝'].includes(accession.metadata.rulerPoliticalTitle)?accession.metadata.rulerPoliticalTitle:getRulerTitleAtMonth({...f,sovereigntyRank:f.sovereigntyRank as any},at);
 const country=getFactionDisplayNameAtMonth({name:f.name,displayName:f.name,nameHistory:f.nameHistory??[]},at),name=person.personalName??person.name;
 const text=`${name}${title==='首领'?'继任':'继位为'}${country}${title==='首领'?'首领':title==='王'?'王':'皇帝'}。`;
 const entry:MilitaryChronicleEntry={eventId:accession.id,worldMonth:at,factionId:d.factionId,text,source:accession.type+' · '+accession.id,victory:false};
 return {rulerId:r.id,factionId:d.factionId,entry};
}

/** One source event remains one visible entry even if the person both participates and accedes. */
export function appendMilitaryPoliticalLife(entries:MilitaryChronicleEntry[],life:ReturnType<typeof militaryPoliticalLife>){
 if(!life)return entries;
 const previous=entries.find(e=>e.eventId===life.entry.eventId);
 return [...entries.filter(e=>e.eventId!==life.entry.eventId),{...life.entry,text:(previous?previous.text:'')+life.entry.text}].sort((a,b)=>a.worldMonth-b.worldMonth||a.eventId.localeCompare(b.eventId));
}
