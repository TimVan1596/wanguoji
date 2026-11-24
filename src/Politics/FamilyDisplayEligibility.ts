import type {MilitaryFamily} from './MilitaryFamily';
import type {MilitaryPerson} from './MilitaryCommandRegistry';
import type {Dynasty} from './Dynasty';
import {currentNobleGrant} from './MilitaryNobility';
/** Presentation only; never removes a charter, resident, child or political history. */
export function familyDisplayEligible(f:MilitaryFamily,month:number,people:readonly MilitaryPerson[],dynasties:readonly Dynasty[]){
 const members=f.members.filter(m=>m.enteredMonth<=month),acts=f.nobleSuccession?.filter(a=>a.month<=month)??[];
 if(f.preparatory&&!acts.length)return false;
 if(members.length!==1||acts.at(-1)?.kind!=='ENDED'||acts.some(a=>a.kind==='SUCCEEDED'))return true;
 const m=members[0],p=people.find(p=>p.personId===m.militaryPersonId),epoch=dynasties.find(d=>d.factionId===f.factionId)?.houseEpochs?.find(e=>e.foundingRulerId===f.epochFounderId);
 if(p&&p.deathMonth===undefined&&!p.politicalRulerId&&p.factionId===f.factionId&&epoch&&epoch.startMonth<=month&&(epoch.endMonth??Infinity)>=month&&currentNobleGrant(p,f.factionId,month,f.epochFounderId))return true;
 return false;
}
