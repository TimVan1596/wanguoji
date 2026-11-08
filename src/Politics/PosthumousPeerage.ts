import type {MilitaryPerson} from './MilitaryCommandRegistry';
import type {MilitaryFamily} from './MilitaryFamily';
import type {Dynasty} from './Dynasty';
import type {WorldEvent} from '../History/WorldHistory';
/** Read existing authoritative death settlements; no duplicate history and no posthumous military actions. */
export function posthumousPeerage(p:MilitaryPerson,families:readonly MilitaryFamily[],dynasties:readonly Dynasty[],events:readonly WorldEvent[],month:number){
 if(p.deathMonth===undefined||p.deathMonth>month)return [];
 const byId=new Map(events.map(e=>[e.id,e])),result:WorldEvent[]=[];
 for(const f of families){const m=f.members.find(m=>m.militaryPersonId===p.personId&&m.sourceUserId===p.sourceUserId&&m.bornMonth===p.bornMonth);if(!m)continue;
  for(const a of f.nobleSuccession??[]){const e=byId.get(a.eventId);if(a.previousMemberId===m.memberId&&a.month>=p.deathMonth&&a.month<=month&&['DEATH','NO_HEIR','RANK_EXHAUSTED'].includes(a.reason)&&e?.metadata?.familyNobleAct===JSON.stringify(a))result.push(e);}
 }
 const native=p.royalIdentity,d=native&&dynasties.find(d=>d.factionId===native.factionId),r=d?.rulers.find(r=>r.id===native!.rulerId&&r.militaryIdentity?.personId===p.personId&&r.bornYear===p.bornMonth);
 if(r)for(const a of d!.royalNobility??[]){const e=byId.get(a.eventId);if(a.previousRulerId===r.id&&a.month>=p.deathMonth&&a.month<=month&&a.deathEventId&&['DEATH','NO_HEIR','RANK_EXHAUSTED'].includes(a.reason)&&e?.metadata?.royalNobleAct===JSON.stringify(a))result.push(e);}
 return [...new Map(result.map(e=>[e.id,e])).values()].sort((a,b)=>(a.monthIndex??a.year)-(b.monthIndex??b.year)||events.indexOf(a)-events.indexOf(b));
}
