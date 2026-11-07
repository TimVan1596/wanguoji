import type {MilitaryPerson} from '../Politics/MilitaryCommandRegistry';
import type {WorldEvent} from '../History/WorldHistory';
import type {RulerSaveV17} from './WorldSaveSchema';
const accessions=new Set(['ruler-acceded','ruler-succession','ruler-deposed','dynasty-usurped','rebel-faction-founded','empire-split','frontier-faction-founded']);
/** Reconstruct eligibility at the actual merit write boundary, never from a
 * later death/accession. Unknown or already-effective political identity fails closed. */
export function familyMeritPersonAtBoundary(person:MilitaryPerson,factionId:string,month:number,boundary:number,events:readonly WorldEvent[],rulers:readonly RulerSaveV17[]){
 if(boundary<0)return;
 if(person.deathMonth!==undefined){const death=events.findIndex(e=>e.type==='military-person-died'&&e.metadata?.personId===person.personId&&(e.monthIndex??e.year)===person.deathMonth);if(death<0||death<boundary||person.deathMonth<month)return;}
 if(person.politicalRulerId){
  const r=rulers.find(r=>r.rulerId===person.politicalRulerId&&r.bornMonth===person.bornMonth&&(r.residentIdentity?.sourceUserId===person.sourceUserId||r.militaryIdentity?.personId===person.personId||r.militaryUsurperIdentity?.personId===person.personId));
  const accession=r&&events.findIndex(e=>accessions.has(e.type)&&(e.rulerId===r.rulerId||e.metadata?.nextRulerId===r.rulerId||e.metadata?.foundingRulerId===r.rulerId));
  if(!r||accession===undefined||accession<0)return;
  const at=events[accession].monthIndex??events[accession].year;
  if(accession<boundary||at<month)return;
 }
 return {...person,deathMonth:undefined,politicalRulerId:undefined,factionId};
}
