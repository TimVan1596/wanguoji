import type {Ruler} from '../../../Politics/Dynasty';
import type {MilitaryPerson,MilitaryFormation} from '../../../Politics/MilitaryCommandRegistry';
import type {WorldEvent} from '../../../History/WorldHistory';
import type {MilitaryHistoryContext} from '../../../Politics/MilitaryChronicle';
import {deriveRulerAssessment,type RulerHistoriographyContext} from '../../../Politics/RulerHistoriography';
import {projectRulerHistoricalEvents,getRulerDiplomaticEvents} from '../../../Politics/RulerChronicle';
import {personServiceLinks,preAccessionMilitary} from '../../../Politics/PersonServiceLinks';
export interface RoyalReadingInput {
 ruler:Ruler&{accessionYear:number;chronicle:NonNullable<Ruler['chronicle']>};rulers:Ruler[];team:RulerHistoriographyContext['faction'];
 events:WorldEvent[];allEvents:WorldEvent[];worldMonth:number;people:MilitaryPerson[];formations:MilitaryFormation[];factions:NonNullable<MilitaryHistoryContext['factions']>;
}
function build(a:RoyalReadingInput){
 const {ruler,team,events,worldMonth}=a,plan=projectRulerHistoricalEvents(events,ruler,team.name,worldMonth,ruler.chronicle.notableEventIds);
 let diplomacy:WorldEvent[]|undefined,reignEvents:WorldEvent[]|undefined;
 return {evidence:deriveRulerAssessment({ruler,dynasty:{rulers:a.rulers},faction:team,events,worldMonth}).evidence,full:plan.all,selected:plan.select(8),
  service:personServiceLinks(team.name,[ruler],a.people,a.formations,a.allEvents,worldMonth),earlier:preAccessionMilitary(ruler,a.people,a.formations,a.allEvents,{factions:a.factions}),
  get diplomacy(){return diplomacy??=getRulerDiplomaticEvents(events,ruler,team.name,worldMonth);},
  get reignEvents(){return reignEvents??=events.filter(e=>{const at=e.monthIndex??e.year;return at>=ruler.accessionYear&&at<=Math.min(ruler.endYear??worldMonth,worldMonth)&&(e.actorFactionId===team.name||e.targetFactionId===team.name||e.factionIds?.includes(team.name));});}};
}
/** UI-owned bounded cache. Stable history is independent of the current month after a reign/life ends.
 * Immutable source references detect hydration/replacements; content signatures detect mutable registries.
 * No persistent fields, RNG calls or cross-world singleton. */
export function createRoyalReadingProjection(){
 const rows=new Map<string,{owner:Ruler;key:string;refs:WorldEvent[];value:ReturnType<typeof build>}>();let builds=0,hits=0;
 return {get(a:RoyalReadingInput){
  const r=a.ruler,end=Math.min(a.worldMonth,Math.max(r.endYear??a.worldMonth,r.deathMonth??-Infinity)),scope=JSON.stringify([a.team.name,r.id]);
  const localRefs=a.events.filter(e=>(e.monthIndex??e.year)<=end),refs=[...a.allEvents.filter(e=>(e.monthIndex??e.year)<=end),...localRefs];
  const people=a.people.filter(p=>p.personId===(r.militaryIdentity?.personId??r.residentIdentity?.personId)||p.appointments.some(x=>x.factionId===a.team.name&&x.startMonth<=end&&(x.endMonth??end)>=r.accessionYear));
  const personIds=new Set(people.map(p=>p.personId));
  const family=a.rulers.filter(x=>x.bornYear<=end||x.accessionYear!==undefined).map(x=>({id:x.id,parentId:x.parentId,houseName:x.houseName,givenName:x.givenName,bornYear:x.bornYear,accessionYear:x.accessionYear,reignOrdinal:x.reignOrdinal,deathMonth:x.deathMonth,deathReason:x.deathReason,relationType:x.relationType}));
  const forms=a.formations.filter(f=>personIds.has(f.commanderPersonId)).map(f=>({commandId:f.commandId,factionId:f.factionId,commanderPersonId:f.commanderPersonId,captures:f.captures.filter(c=>c.month<=end)}));
  const key=JSON.stringify([r,family,a.team.name,a.team.origin,a.team.stateFoundedMonth,end,people,forms,localRefs.map(e=>e.id),r.militaryIdentity||r.residentIdentity?.military?[...a.factions].map(([id,f])=>[id,f.displayName,f.nameHistory,f.stateFoundedMonth,f.sovereigntyHistory,f.colorHistory]):null]);
  const old=rows.get(scope);if(old&&old.owner===r&&old.key===key&&old.refs.length===refs.length&&refs.every((e,i)=>e===old.refs[i])){hits++;rows.delete(scope);rows.set(scope,old);return old.value;}
  builds++;const value=build(a);rows.delete(scope);rows.set(scope,{owner:r,key,refs,value});if(rows.size>24)rows.delete(rows.keys().next().value!);return value;
 },diagnostics(){return {builds,hits,entries:rows.size};}};
}
