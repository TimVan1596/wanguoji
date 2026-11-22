import type {MilitaryPerson} from './MilitaryCommandRegistry';
import type {CivilGovernorTerm} from './CivilAdministrationSchema';
import type {WorldEvent} from '../History/WorldHistory';
import {militaryAbilities} from './PersonAbilities';
import {currentNobleGrant,NOBLE_RANKS} from './MilitaryNobility';
import {unresolvedCourtBans} from './MilitaryCourtStanding';
import {splitEstablishedPersonalName} from './NameCulture';
import {civilOfficeLevel} from './CivilOffice';
export interface PoliticalSuccessorRow {personId:string;sourceUserId:number;bornMonth:number;loyalty:number;source:'CIVIL'|'MILITARY'|'NOBLE';eventIds:string[];serviceMonths:number;weight:number;}
export interface LawfulPoliticalSuccession {version:1;kind:'EXTINCT_HOUSE_CONTINUATION';predecessorRulerId:string;epochFounderId:string;month:number;royalCandidateIds:string[];candidate:PoliticalSuccessorRow;}
/** Existing political people compete only at a real vacant royal succession. No army, history or RNG is created here. */
export function politicalSuccessionCandidates(people:readonly MilitaryPerson[],terms:readonly CivilGovernorTerm[],events:readonly WorldEvent[],factionId:string,epoch:string,month:number,oldHouse:string,residents:readonly {id:number;bornMonth:number;loyalty:number}[]):PoliticalSuccessorRow[]{
 const byId=new Map(events.map(e=>[e.id,e]));
 return people.flatMap(p=>{
  const u=residents.find(u=>u.id===p.sourceUserId&&u.bornMonth===p.bornMonth),name=splitEstablishedPersonalName(p.personalName);
  if(!u||p.factionId!==factionId||p.deathMonth!==undefined&&p.deathMonth<=month||p.politicalRulerId||p.royalIdentity||month-p.bornMonth<216||!name||name.houseName===oldHouse||u.loyalty<40||unresolvedCourtBans(p,factionId,month,epoch).length||people.filter(o=>o.personId===p.personId||o.sourceUserId===p.sourceUserId&&o.bornMonth===p.bornMonth).length!==1)return [];
  const civil=terms.filter(t=>t.personId===p.personId&&t.factionId===factionId&&t.epochFounderId===epoch&&t.startMonth<=month&&(t.endMonth??Infinity)>=month&&civilOfficeLevel(t.office)>=1&&t.meritEventId&&byId.has(t.meritEventId)&&byId.has(t.appointEventId)&&month-t.startMonth>=60).at(-1);
  const military=p.appointments.filter(a=>a.factionId===factionId&&a.startMonth<=month&&(a.endMonth??Infinity)>=month-120&&month-a.startMonth>=60).find(a=>a.officeHistory?.some(o=>['JIANGJUN','SHANGJIANGJUN'].includes(o.office)&&o.month<=month&&byId.has(o.eventId)));
  const grant=currentNobleGrant(p,factionId,month,epoch),noble=grant&&byId.has(grant.eventId)&&p.appointments.some(a=>a.factionId===factionId&&a.startMonth<=month&&month-a.startMonth>=60);
  if(!civil&&!military&&!noble)return [];
  const source=civil?'CIVIL' as const:military?'MILITARY' as const:'NOBLE' as const,serviceMonths=civil?month-civil.startMonth:month-(military??p.appointments.find(a=>a.factionId===factionId)!).startMonth;
  const eventIds=civil?[civil.appointEventId,civil.meritEventId!]:military?[`military-appointment-${military.commandId}`,...(military.officeHistory??[]).filter(o=>o.month<=month&&byId.has(o.eventId)).map(o=>o.eventId)]:[grant!.eventId];
  if(eventIds.some(id=>!byId.has(id)))return [];
  const a=militaryAbilities(p),weight=20+Math.min(20,serviceMonths/24)+(civil?Math.min(20,civil.loyaltyRecovered+civil.devastationRecovered):10)+(grant?(NOBLE_RANKS.indexOf(grant.rank)+1)*3:0)+(a.command+a.strategy)/10+u.loyalty/10;
  return [{personId:p.personId,sourceUserId:p.sourceUserId,bornMonth:p.bornMonth,loyalty:u.loyalty,source,eventIds,serviceMonths,weight}];
 }).sort((a,b)=>b.weight-a.weight||a.personId.localeCompare(b.personId));
}
