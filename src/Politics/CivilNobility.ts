import type {CivilGovernorTerm} from './CivilAdministrationSchema';
import {civilOfficeLevel} from './CivilOffice';
import {militaryAbilities} from './PersonAbilities';
import type {MilitaryPerson} from './MilitaryCommandRegistry';
import type {NobleRank} from './MilitaryNobility';
import {WorldRandom} from '../Simulation/WorldRandom';

/** A grant advances at most one effective rank and spends each recovery or appraisal once. */
export function civilNobleMerit(person:MilitaryPerson,terms:readonly CivilGovernorTerm[],month:number,loyalty:number,previous?:NobleRank,retirementEventId?:string){
 const local=terms.filter(t=>t.personId===person.personId&&t.startMonth<=month);
 const current=retirementEventId?local.find(t=>t.endReason==='RETIREMENT'&&t.endMonth===month&&t.endEventId===retirementEventId):local.find(t=>(t.endMonth??Infinity)>month);
 if(!current||civilOfficeLevel(current.office)<1||person.deathMonth!==undefined||person.politicalRulerId||loyalty<65||militaryAbilities(person).strategy<65||previous==='HOU'||previous==='GONG')return;
 const history=(person.nobilityHistory??[]).filter(g=>g.basis==='CIVIL');
 if(retirementEventId&&history.some(g=>g.civilRetirementEventId))return;
 const rank:NobleRank=previous==='BO'?'HOU':previous==='ZI'?'BO':previous==='NAN'?'ZI':'NAN';
 const used=new Set(history.flatMap(g=>[...(g.civilMeritEventIds??[]),...(g.civilStewardshipEventIds??[])]));
 const receipts=local.flatMap(t=>t.receipts??[]).filter(r=>r.month<=month&&!used.has(r.eventId));
 const assessments=local.flatMap(t=>t.stewardshipAssessments??[]).filter(a=>a.month<=month&&!used.has(a.eventId));
 const tenure=(t:CivilGovernorTerm)=>Math.max(0,Math.min(month,t.endMonth??month)-t.startMonth);
 const serviceMonths=local.reduce((n,t)=>n+tenure(t),0),centralMonths=local.filter(t=>civilOfficeLevel(t.office)>=2).reduce((n,t)=>n+tenure(t),0);
 const contribution=receipts.reduce((n,r)=>n+r.loyalty+r.devastation,0);
 const higher=rank==='BO'||rank==='HOU';
 if(higher){
  const marquis=rank==='HOU';
  if(loyalty<(marquis?85:75)||serviceMonths<(marquis?300:216)||centralMonths<(marquis?120:72)||marquis&&!local.some(t=>t.office==='CHENGXIANG'&&tenure(t)>=72)||
   receipts.length<(marquis?12:9)||contribution<(marquis?20:13)||assessments.length<(marquis?4:2)||new Set(receipts.map(r=>r.cityId)).size<2)return;
 }else if(serviceMonths<(rank==='ZI'?180:96)||receipts.length<(rank==='ZI'?8:6)||contribution<(rank==='ZI'?12:8))return;
 if(retirementEventId&&(serviceMonths<144||loyalty<75||contribution<12))return;
 const minimumCount=rank==='HOU'?12:rank==='BO'?9:rank==='ZI'?8:6;
 const minimumContribution=Math.max(retirementEventId?12:0,rank==='HOU'?20:rank==='BO'?13:rank==='ZI'?12:8);
 const selected:typeof receipts=[];
 let points=0;
 const cities=new Set<string>();
 for(const receipt of receipts){
  if(selected.length>=minimumCount&&points>=minimumContribution&&(!higher||cities.size>=2))break;
  selected.push(receipt);
  points+=receipt.loyalty+receipt.devastation;
  cities.add(receipt.cityId);
 }
 return {rank,serviceMonths,civilTermId:current.assignmentId,civilMeritEventIds:selected.map(r=>r.eventId),civilLoyalty:loyalty,
  ...(higher?{civilStewardshipEventIds:assessments.slice(0,rank==='HOU'?4:2).map(a=>a.eventId)}:{}),...(retirementEventId?{civilRetirementEventId:retirementEventId}:{})};
}

export function civilPeerageDraw(seed:string,personId:string,factionId:string,month:number,rank:NobleRank,retirement:boolean){
 const rng=new WorldRandom();
 rng.initialize(`${retirement?'civil-retirement-peerage-v1':'civil-peerage-v1'}:${seed}:${personId}:${factionId}:${month}`);
 return rng.next()<(retirement?.12:rank==='HOU'?.025:rank==='BO'?.04:.08);
}
