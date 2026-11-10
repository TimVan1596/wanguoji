import type City from '../Components/City';
import type Team from '../Components/Team';
import type User from '../Components/User';
import type {MilitaryFamily,MilitaryFamilyMember} from './MilitaryFamily';
import type {MilitaryPerson} from './MilitaryCommandRegistry';
import {personAbilities,militaryAbilities} from './PersonAbilities';
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
 const source=term.royalRulerId?{kind:'ROYAL' as const,rulerId:term.royalRulerId,bornMonth:term.bornMonth}:{kind:'RESIDENT' as const,sourceUserId:term.sourceUserId,bornMonth:term.bornMonth};
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
export function civilGovernorCandidates(month:number,team:Team,people:readonly MilitaryPerson[],terms:readonly CivilGovernorTerm[],epochFounderId:string,lookup:(id:number,bornMonth:number)=>FamilyLink|undefined,formations:readonly import('./MilitaryCommandRegistry').MilitaryFormation[]=[]){
 const occupied=new Set(terms.filter(term=>term.startMonth<=month&&term.endMonth===undefined).map(term=>term.personId)),rows:CivilGovernorCandidate[]=[];
 for(const user of team.users){
  if(user.isDestroyed||user.role!=='NORMAL'||user.rulerId||user.player.rulerId||month-user.bornMonth<18*12||month-user.bornMonth>75*12||occupied.has(civilGovernorPersonId(user)))continue;
  const person=user.militaryPersonId?people.find(candidate=>candidate.personId===user.militaryPersonId):undefined;
  if(person&&(person.politicalRulerId||person.status==='DEAD'||person.deathMonth!==undefined||person.appointments.some(appointment=>appointment.factionId===team.name&&appointment.startMonth<=month&&(appointment.endMonth??Infinity)>month)||formations.some(formation=>formation.status==='ACTIVE'&&formation.commanderPersonId===person.personId)))continue;
  if(person&&unresolvedCourtBans(person,team.name,month,epochFounderId).length)continue;
  const familyLink=familyLinkAt(user,person,lookup);
  if(familyLink&&(!familyMemberPresent(familyLink.member,month)||familyResidenceAt(familyLink.family,familyLink.member,month)!==team.name))continue;
  const nobleRank=higherRank(person?currentNobleGrant(person,team.name,month,epochFounderId)?.rank:undefined,familyLink?familyNobleRankAt(familyLink.family,familyLink.member,month):undefined);
  const retired=!!person&&person.status==='RETIRED',royal=!!person?.royalIdentity;
  const identitySource:CivilGovernorSource=royal?'ROYAL':retired?'RETIRED_MILITARY':nobleRank?'NOBLE':familyLink?'FAMILY':'ORDINARY_RESIDENT';
  const abilities=person?militaryAbilities(person):personAbilities({kind:'RESIDENT',sourceUserId:user.id,bornMonth:user.bornMonth});
  const sourceWeight=identitySource==='ORDINARY_RESIDENT'?1:identitySource==='FAMILY'?1.08:identitySource==='NOBLE'?1.04+Math.max(0,NOBLE_RANKS.indexOf(nobleRank??'NAN'))*.02:identitySource==='ROYAL'?1.12:1.06;
  const personId=person?.personId??civilGovernorPersonId(user,familyLink),weight=(.72+abilities.strategy/100*.55)*sourceWeight;
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
 const total=pool.reduce((sum,candidate)=>sum+candidate.weight,0);
 if(!pool.length||!Number.isFinite(roll)||roll<0||roll>=1||total<=0)return;
 let target=roll*total;for(const candidate of pool){target-=candidate.weight;if(target<0)return candidate;}
 return pool.at(-1);
}
const higherRank=(a?:NobleRank,b?:NobleRank)=>a&&b?(NOBLE_RANKS.indexOf(a)>=NOBLE_RANKS.indexOf(b)?a:b):a??b;
