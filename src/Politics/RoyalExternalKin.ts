import type {Dynasty} from './Dynasty';
import type {MilitaryFamily} from './MilitaryFamily';
import type {MilitaryPerson} from './MilitaryCommandRegistry';
import type {WorldEvent} from '../History/WorldHistory';
import {rulerFamilyOrigin} from './RulerFamilyOrigin';
import {familyResidenceAt} from './FamilyNobleSuccession';
/** Cross-view links only. These records never become Rulers or succession candidates. */
export function royalExternalKin(d:Dynasty,families:readonly MilitaryFamily[],people:readonly MilitaryPerson[],events:readonly WorldEvent[],month:number){
 const byEvent=new Map(events.map(e=>[e.id,e])),byPerson=new Map(people.map(p=>[p.personId,p])),rows=[];
 for(const r of d.rulers){
  const origin=rulerFamilyOrigin(r,families,people,month);if(!origin)continue;
  const {family,member}=origin;
  for(const child of family.members.filter(m=>m.parentMemberId===member.memberId&&m.enteredMonth<=month&&m.bornMonth<=month).sort((a,b)=>a.bornMonth-b.bornMonth||a.memberId.localeCompare(b.memberId))){
   const e=byEvent.get(child.birth?.eventId??`${child.memberId}-entered`),person=child.militaryPersonId?byPerson.get(child.militaryPersonId):undefined;
   if(!e||(child.birth?e.type!=='family-child-born'||e.metadata?.familyBirth!==JSON.stringify(child.birth):e.type!=='military-family-member-entered'||e.metadata?.sourceUserId!==child.sourceUserId)||e.metadata?.familyId!==family.familyId||e.metadata?.parentMemberId!==member.memberId||(!child.birth&&e.metadata?.bornMonth!==child.bornMonth)||(e.monthIndex??e.year)!==child.enteredMonth)continue;
   // A real royal record already representing this resident must not appear twice.
   if(d.rulers.some(other=>other.bornYear===child.bornMonth&&(child.sourceUserId!==undefined&&other.residentIdentity?.sourceUserId===child.sourceUserId||person&&(other.militaryIdentity?.personId===person.personId||other.militaryUsurperIdentity?.personId===person.personId||other.residentIdentity?.military?.personId===person.personId))))continue;
   rows.push({id:`external:${family.familyId}/${child.memberId}`,parentId:r.id,family,member:child,origin:member,person:person&&person.sourceUserId===child.sourceUserId&&person.bornMonth===child.bornMonth?person:undefined,factionId:familyResidenceAt(family,child,month),sourceEventId:e.id});
   if(rows.length>=32)return rows;
  }
 }
 return rows;
}
