import type {CivilGovernorTerm} from './CivilAdministrationSchema';
import {civilOfficeLevel} from './CivilOffice';
import {militaryAbilities} from './PersonAbilities';
import type {MilitaryPerson} from './MilitaryCommandRegistry';
import type {NobleRank} from './MilitaryNobility';
/** Low civil peerages use actual, unconsumed recovery receipts. They carry no military authority. */
export function civilNobleMerit(person:MilitaryPerson,terms:readonly CivilGovernorTerm[],month:number,loyalty:number,previous?:NobleRank){
 const local=terms.filter(t=>t.personId===person.personId&&t.startMonth<=month),current=local.find(t=>t.startMonth<=month&&(t.endMonth??Infinity)>month);
 if(!current||civilOfficeLevel(current.office)<1||person.deathMonth!==undefined||person.politicalRulerId||loyalty<65||militaryAbilities(person).strategy<65||previous&&previous!=='NAN')return;
 const rank=previous==='NAN'?'ZI':'NAN',used=new Set((person.nobilityHistory??[]).filter(g=>g.basis==='CIVIL').flatMap(g=>g.civilMeritEventIds??[])),receipts=local.flatMap(t=>t.receipts??[]).filter(r=>r.month<=month&&!used.has(r.eventId)),serviceMonths=local.reduce((n,t)=>n+Math.max(0,Math.min(month,t.endMonth??month)-t.startMonth),0),contribution=receipts.reduce((n,r)=>n+r.loyalty+r.devastation,0);
 if(serviceMonths<(rank==='ZI'?180:96)||receipts.length<(rank==='ZI'?8:6)||contribution<(rank==='ZI'?12:8))return;
 return {rank:rank as NobleRank,serviceMonths,civilTermId:current.assignmentId,civilMeritEventIds:receipts.map(r=>r.eventId),civilLoyalty:loyalty};
}
