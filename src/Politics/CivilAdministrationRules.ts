import {createRoyalPopulationLookup} from './RoyalPopulationIdentity';
import type {Dynasty} from './Dynasty';
import {familyExpansionOpen} from './MilitaryFamily';
import type City from '../Components/City';
import type Team from '../Components/Team';
import type User from '../Components/User';
import type {MilitaryFamily,MilitaryFamilyMember} from './MilitaryFamily';
import type {MilitaryPerson} from './MilitaryCommandRegistry';
import {civilAbilitySource,residentAbilitySource,appointmentHealthFactor,personAbilities,militaryAbilities} from './PersonAbilities';
import {currentNobleGrant,NOBLE_RANKS,type NobleRank} from './MilitaryNobility';
import {familyNobleRankAt,familyResidenceAt,familyMemberPresent} from './FamilyNobleSuccession';
import {unresolvedCourtBans} from './MilitaryCourtStanding';
import {CIVIL_CITY_STABILITY_MONTHS,civilGovernanceThreshold,type CivilGovernancePolicy,type CivilGovernorCandidate,type CivilGovernorSource,type CivilGovernorTerm} from './CivilAdministrationSchema';

export const civilGovernorPersonId=(user:Pick<User,'id'|'bornMonth'|'militaryPersonId'>,family?:{member:MilitaryFamilyMember})=>user.militaryPersonId??family?.member.memberId??`resident-${user.id}-${user.bornMonth}`;
type FamilyLink={family:MilitaryFamily;member:MilitaryFamilyMember};
export function familyLinkAt(user:User,person:MilitaryPerson|undefined,lookup:(id:number,bornMonth:number)=>FamilyLink|undefined){return person?lookup(person.sourceUserId,person.bornMonth):lookup(user.id,user.bornMonth);}
export function civilGovernorStatus(term:CivilGovernorTerm,city:City|undefined,month:number){
 if(term.endMonth!==undefined)return '已离任';
 if(!city||city.destroyed)return '城市档案结束';
 if(city.underSiege||city.isInCaptureGrace(month))return '困难';
 if(term.meritEventId)return '治理有绩';
 if(city.loyalty<40||city.devastation>=60)return '困难';
 if(month-term.startMonth<24||city.devastation>=25||city.loyalty<60)return '恢复中';
 return '稳定';
}
export function civilGovernanceEffect(term:CivilGovernorTerm,city:City,month:number,policy:CivilGovernancePolicy='MEDIUM'){
 if(term.endMonth!==undefined||city.destroyed||city.underSiege||city.isInCaptureGrace(month)||month<=term.startMonth||(month-term.startMonth)%12!==0)return {loyalty:0,devastation:0};
 const source=civilAbilitySource(term);
 const value=personAbilities(source).strategy,threshold=civilGovernanceThreshold(policy);
 return {loyalty:value>=threshold&&city.loyalty<80?1:0,devastation:value>=Math.max(0,threshold-12)&&city.devastation>0?1:0};
}
export function civilControlledSince(city:Pick<City,'ownerFactionId'|'foundedYear'|'lastCapturedYear'|'history'>,team:Pick<Team,'name'|'currentActiveSinceYear'>,month:number){
 const acquired=[city.foundedYear,city.lastCapturedYear??city.foundedYear,...(city.history??[]).filter(event=>event.newOwnerFactionId===city.ownerFactionId&&event.year<=month).map(event=>event.year)]
   .filter((value):value is number=>typeof value==='number'&&Number.isFinite(value));
 return Math.max(team.currentActiveSinceYear??0,...acquired);
}
export function eligibleCivilCities(month:number,team:Team,terms:readonly CivilGovernorTerm[]){
 if(team.status!=='ACTIVE'||team.identityStage!=='STATE'||team.stateFoundedMonth===undefined||team.stateFoundedMonth>month||team.cities.length<2)return [];
 const occupied=new Set(terms.filter(term=>term.startMonth<=month&&term.endMonth===undefined).map(term=>term.cityId));
 return team.cities.filter(city=>!city.destroyed&&city.ownerFactionId===team.name&&!occupied.has(city.id)&&!city.underSiege&&!city.isInCaptureGrace(month)&&month-civilControlledSince(city,team,month)>=CIVIL_CITY_STABILITY_MONTHS);
}
export function civilGovernorCandidates(month:number,team:Team,people:readonly MilitaryPerson[],terms:readonly CivilGovernorTerm[],epochFounderId:string,lookup:(id:number,bornMonth:number)=>FamilyLink|undefined,formations:readonly import('./MilitaryCommandRegistry').MilitaryFormation[]=[],dynasties:readonly Dynasty[]=[]){
 const occupied=new Set(terms.filter(term=>term.startMonth<=month&&term.endMonth===undefined).map(term=>term.personId)),rows:CivilGovernorCandidate[]=[];
 const royalOwner=createRoyalPopulationLookup(dynasties);
 const populationKey=(id:number,bornMonth:number)=>`${id}:${bornMonth}`;
 const termsByPopulation=new Map<string,CivilGovernorTerm[]>();
 for(const term of terms){
  const key=populationKey(term.sourceUserId,term.bornMonth),history=termsByPopulation.get(key);
  if(history)history.push(term);else termsByPopulation.set(key,[term]);
 }
 const peopleById=new Map(people.map(person=>[person.personId,person]));
 const commanders=new Set(formations.filter(f=>f.status==='ACTIVE').map(f=>f.commanderPersonId));
 for(const user of team.users){
  const history=termsByPopulation.get(populationKey(user.id,user.bornMonth))??[];
  const royalPerson=royalOwner(user);if(user.nativeRoyalRulerId||royalPerson&&(royalPerson.reignOrdinal!==undefined||royalPerson.status==='ruling'||royalPerson.accessionYear!==undefined&&royalPerson.accessionYear<=month))continue;
  if(history.some(t=>t.endMonth===undefined)||user.isDestroyed||user.role!=='NORMAL'||user.rulerId||user.player.rulerId||month-user.bornMonth<18*12||month-user.bornMonth>75*12||occupied.has(civilGovernorPersonId(user)))continue;
  if(history.some(t=>t.endReason==='RETIREMENT'&&(month-t.endMonth!<60||month-user.bornMonth>=72*12)))continue;
  const person=user.militaryPersonId?peopleById.get(user.militaryPersonId):undefined;
  if(user.historicalPersonId&&user.historicalPersonId!==person?.personId)continue;
  if(person&&(person.politicalRulerId||person.status==='DEAD'||person.deathMonth!==undefined||person.appointments.some(appointment=>appointment.factionId===team.name&&appointment.startMonth<=month&&(appointment.endMonth??Infinity)>month)||commanders.has(person.personId)))continue;
  if(person&&unresolvedCourtBans(person,team.name,month,epochFounderId).length)continue;
  const familyLink=familyLinkAt(user,person,lookup);
  if(familyLink&&(!familyMemberPresent(familyLink.member,month)||familyResidenceAt(familyLink.family,familyLink.member,month)!==team.name))continue;
  const nobleRank=higherRank(person?currentNobleGrant(person,team.name,month,epochFounderId)?.rank:undefined,familyLink?familyNobleRankAt(familyLink.family,familyLink.member,month,team.name,epochFounderId):undefined);
  const retired=!!person&&person.status==='RETIRED'&&person.appointments.length>0,royal=!!person?.royalIdentity;
  const identitySource:CivilGovernorSource=royal?'ROYAL':retired?'RETIRED_MILITARY':nobleRank?'NOBLE':familyLink&&familyExpansionOpen(familyLink.family,month,team.name,epochFounderId)?'FAMILY':'ORDINARY_RESIDENT';
  const abilities=person?militaryAbilities(person):personAbilities(residentAbilitySource(user.id,user.bornMonth,familyLink?.member));
  const sourceWeight=identitySource==='ORDINARY_RESIDENT'?1:identitySource==='FAMILY'?1.08:identitySource==='NOBLE'?1.04+Math.max(0,NOBLE_RANKS.indexOf(nobleRank??'NAN'))*.02:identitySource==='ROYAL'?1.12:1.06;
  const personId=history[0]?.personId??person?.personId??civilGovernorPersonId(user,familyLink),prior=history.filter(t=>t.factionId===team.name&&t.epochFounderId===epochFounderId&&t.endReason==='CITY_LOST'&&t.endMonth!==undefined&&t.endMonth<=month).at(-1),returnBonus=prior?.meritEventId?1+Math.min(.15,(prior.loyaltyRecovered+prior.devastationRecovered)/100):1,weight=(.72+(.85*abilities.strategy+.15*abilities.command)/100*.55)*sourceWeight*returnBonus*appointmentHealthFactor(abilities.source,month);
  rows.push({personId,sourceUserId:user.id,bornMonth:user.bornMonth,personalName:person?.personalName??user.name,identitySource,familyId:familyLink?.family.familyId,familyMemberId:familyLink?.member.memberId,royalRulerId:person?.royalIdentity?.rulerId,nobleRank,strategy:abilities.strategy,weight});
 }
 return rows.sort((a,b)=>b.weight-a.weight||b.strategy-a.strategy||a.bornMonth-b.bornMonth||a.personId.localeCompare(b.personId));
}
export function selectCivilGovernorCandidate(candidates:readonly CivilGovernorCandidate[],roll:number){
 const pool=candidates.slice(0,Math.min(8,candidates.length));
 for(const source of ['ROYAL','NOBLE','FAMILY','RETIRED_MILITARY','ORDINARY_RESIDENT'] as const){
  if(pool.some(candidate=>candidate.identitySource===source))continue;
  const representative=candidates.find(candidate=>candidate.identitySource===source);if(representative&&pool.length<12)pool.push(representative);
 }
 if(!pool.length||!Number.isFinite(roll)||roll<0||roll>=1)return;
 // Keep most selections in the existing shortlist. A small share of the
 // same draw gives all other eligible candidates a genuine route into office.
 const shortlisted=new Set(pool);
 const reserve=candidates.filter(candidate=>!shortlisted.has(candidate));
 const reserveShare=.10;
 const eligible=reserve.length&&roll>=1-reserveShare?reserve:pool;
 const ticket=reserve.length?(eligible===reserve?(roll-(1-reserveShare))/reserveShare:roll/(1-reserveShare)):roll;
 const total=eligible.reduce((sum,candidate)=>sum+candidate.weight,0);
 if(total<=0)return;
 let target=ticket*total;for(const candidate of eligible){target-=candidate.weight;if(target<0)return candidate;}
 return eligible.at(-1);
}
const higherRank=(a?:NobleRank,b?:NobleRank)=>a&&b?(NOBLE_RANKS.indexOf(a)>=NOBLE_RANKS.indexOf(b)?a:b):a??b;
