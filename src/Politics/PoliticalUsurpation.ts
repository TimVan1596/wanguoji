import type {MilitaryPoliticalParticipant} from './MilitaryPoliticalInfluence';
import type {MilitaryPerson} from './MilitaryCommandRegistry';
import type {CivilGovernorTerm} from './CivilAdministrationSchema';
import type {WorldEvent} from '../History/WorldHistory';
import {militaryAbilities,personAbilities} from './PersonAbilities';
import {unresolvedCourtBans} from './MilitaryCourtStanding';
import {NOBLE_RANKS} from './MilitaryNobility';

export interface CivilPoliticalSupport {
 assignmentId:string;personId:string;personalName:string;cityId:string;cityName:string;
 appointEventId:string;meritEventId:string;captureEventId:string;serviceMonths:number;contribution:number;bonus:number;
}
export interface PoliticalContestRow {
 personId:string;resources:number;merit:number;nobility:number;abilities:number;service:number;
 civilSupport:CivilPoliticalSupport[];capital:number;
}
/** Verified local governance contributes bounded political resources, not allegiance, a coup attempt, troop authority or city ownership. */
export function civilPoliticalSupport(candidate:MilitaryPoliticalParticipant,people:readonly MilitaryPerson[],terms:readonly CivilGovernorTerm[],events:readonly WorldEvent[],month:number,epoch:string):CivilPoliticalSupport[]{
 const byId=new Map(events.map(e=>[e.id,e])),rows:CivilPoliticalSupport[]=[];
 for(const t of terms){
  if(t.factionId!==candidate.factionId||t.epochFounderId!==epoch||t.royalRulerId||month-t.startMonth<120||t.bornMonth>month-18*12||t.endMonth!==undefined&&(t.endMonth<month||t.endMonth===month&&t.endReason!=='REGIME_ENDED')||!t.meritEventId)continue;
  if(terms.some(o=>o!==t&&o.sourceUserId===t.sourceUserId&&o.bornMonth===t.bornMonth&&o.startMonth<=month&&(o.endMonth??Infinity)>month))continue;
  const p=people.find(p=>p.sourceUserId===t.sourceUserId&&p.bornMonth===t.bornMonth);
  if(p&&(p.royalIdentity||(p.deathMonth??Infinity)<=month||unresolvedCourtBans(p,t.factionId,month,epoch).length||p.appointments.some(a=>a.startMonth<=month&&(a.endMonth??Infinity)>month)))continue;
  const merit=byId.get(t.meritEventId),appoint=byId.get(t.appointEventId),contribution=(t.meritLoyaltyRecovered??0)+(t.meritDevastationRecovered??0);
  if(!appoint||appoint.type!=='civil-governor-appointed'||appoint.metadata?.assignmentId!==t.assignmentId||!merit||merit.type!=='civil-governor-merit'||merit.metadata?.assignmentId!==t.assignmentId||merit.metadata?.personId!==t.personId||merit.actorFactionId!==t.factionId||(merit.monthIndex??merit.year)>month||contribution<3)continue;
  const source=p?militaryAbilities(p).source:{kind:'RESIDENT' as const,sourceUserId:t.sourceUserId,bornMonth:t.bornMonth};
  if(personAbilities(source).strategy<60)continue;
  const capture=candidate.capturedEventIds.map(id=>byId.get(id)).find(e=>e&&e.cityId===t.cityId&&e.actorFactionId===t.factionId&&(e.monthIndex??e.year)<=t.startMonth);
  const lost=events.some(e=>e.cityId===t.cityId&&e.type==='city-captured'&&e.actorFactionId!==t.factionId&&(e.monthIndex??e.year)>=t.startMonth&&(e.monthIndex??e.year)<=month);
  if(!capture||lost)continue;
  rows.push({assignmentId:t.assignmentId,personId:t.personId,personalName:t.personalName,cityId:t.cityId,cityName:t.cityName,appointEventId:t.appointEventId,meritEventId:t.meritEventId,captureEventId:capture.id,serviceMonths:month-t.startMonth,contribution,bonus:Math.min(4,Math.floor((month-t.startMonth)/120)+Math.floor(contribution/3))});
 }
 return rows.sort((a,b)=>b.bonus-a.bonus||a.assignmentId.localeCompare(b.assignmentId)).slice(0,2);
}
/** Bounded political capital competes only after the unchanged country-level draw succeeds. */
export function politicalContest(candidates:readonly MilitaryPoliticalParticipant[],people:readonly MilitaryPerson[],terms:readonly CivilGovernorTerm[],events:readonly WorldEvent[],month:number,epoch:string):PoliticalContestRow[]{
 return candidates.map(c=>{
  const p=people.find(p=>p.personId===c.personId)!,a=militaryAbilities(p),civilSupport=civilPoliticalSupport(c,people,terms,events,month,epoch);
  const row={personId:c.personId,resources:Math.min(30,Math.max(0,['XIAOWEI','PIJIANG','JIANGJUN','SHANGJIANGJUN'].indexOf(c.officeStanding?.office??'XIAOWEI')+1)*4+Math.min(14,c.unitCount*3.5)),merit:Math.min(20,c.capturedEventIds.length*5+(c.defenseEventIds?.length??0)*2),nobility:c.nobility?(NOBLE_RANKS.indexOf(c.nobility.rank)+1)*3:0,abilities:Math.round((a.command+a.strategy)*.075),service:Math.min(10,Math.floor(c.serviceMonths/24)),civilSupport};
  return {...row,capital:row.resources+row.merit+row.nobility+row.abilities+row.service+civilSupport.reduce((n,r)=>n+r.bonus,0)};
 }).sort((a,b)=>b.capital-a.capital||a.personId.localeCompare(b.personId));
}
