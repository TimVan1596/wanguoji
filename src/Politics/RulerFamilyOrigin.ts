import type {Ruler} from './Dynasty';
import type {MilitaryFamily} from './MilitaryFamily';
import type {MilitaryPerson} from './MilitaryCommandRegistry';
/** Reverse the already saved permanent identity links. Names/surnames are never matching keys. */
export function rulerFamilyOrigin(r:Ruler,families:readonly MilitaryFamily[],people:readonly MilitaryPerson[],month:number){
 if((r.accessionYear??Infinity)>month)return;
 const ids=[r.militaryIdentity?.personId,r.militaryUsurperIdentity?.personId,r.residentIdentity?.military?.personId].filter(Boolean);
 const matches=families.flatMap(f=>f.members.filter(m=>m.enteredMonth<=month&&m.bornMonth===r.bornYear&&(m.sourceUserId!==undefined&&r.residentIdentity?.sourceUserId===m.sourceUserId||m.militaryPersonId&&ids.includes(m.militaryPersonId)&&people.some(p=>p.personId===m.militaryPersonId&&p.sourceUserId===m.sourceUserId&&p.bornMonth===m.bornMonth))).map(member=>({family:f,member})));
 return matches.length===1?matches[0]:undefined;
}
