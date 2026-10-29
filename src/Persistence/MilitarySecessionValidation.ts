import {evaluatePopularPoliticalCrisis} from "../Simulation/PopularPoliticalCrisis";
import {CITY_CAPTURE_GRACE_MONTHS,MAX_ACTIVE_FACTIONS,REBELLION_CITY_COOLDOWN_MONTHS} from "../config/simulation";
import {militaryPoliticalDefense} from '../Politics/MilitaryPoliticalInfluence';
import type {WorldSaveV1} from "./WorldSaveSchema";
import {deriveMilitaryLifeSchedule} from "../Politics/MilitaryLifeRules";
import {deriveMilitaryCareer} from "../Politics/MilitaryCareerEvidence";
import {militaryPoliticalStrength} from "../Politics/MilitaryPoliticalInfluence";
import {MILITARY_OFFICE_NAMES} from "../Politics/MilitaryOffice";
const object=(v:any)=>v&&typeof v==="object"&&!Array.isArray(v);
export function validateMilitarySecessions(save:WorldSaveV1){
 const errors:string[]=[],state=save.registries?.militaryCommandRegistry;
 if(!state||!Array.isArray(state.people)||!Array.isArray(state.formations)||!Array.isArray(save.dynasties)||!Array.isArray(save.worldHistory?.events))return errors;
 const records=save.dynasties.flatMap(d=>Array.isArray(d?.rulers)?d.rulers:[]).filter(object) as any[];
 const events=(save.worldHistory.events as any[]).filter(object);
 for(const event of events){
  const m=event.metadata;if(!object(m)||!m.leaderPersonId)continue;
  if(!["empire-split","rebel-faction-founded","frontier-faction-founded"].includes(event.type))continue;
  const r=records.find(r=>r.rulerId===m.foundingRulerId),i=r?.residentIdentity;
  if(!i||typeof r?.houseName!=="string"||typeof r?.givenName!=="string"||m.leaderPersonId!==i.personId||m.leaderSourceUserId!==i.sourceUserId||m.leaderBornMonth!==i.bornMonth||m.leaderOriginalFactionId!==i.sourceFactionId||m.leaderOriginalFactionName!==i.sourceFactionName||m.leaderSourceCityId!==i.cityId||m.leaderSourceCityName!==i.cityName||m.foundingRulerName!==`${r.houseName?.replace(/氏$/,"")}${r.givenName}`||(event.monthIndex??event.year)!==i.foundedMonth||!["PROVISIONAL","STATE"].includes(m.foundingIdentityStage)||!["LEADER","KING","EMPEROR"].includes(m.foundingSovereigntyRank))errors.push("founding narrative source identity mismatch");
 }
 for(const r of records){
  const i=r.residentIdentity,e=i?.military;if(e===undefined)continue;
  const p=state.people.filter(object).find(p=>p.personId===e?.personId),f=state.formations.filter(object).find(f=>f.commandId===e?.commandId);
  const a=Array.isArray(p?.appointments)?p!.appointments.filter(object).find(a=>a.commandId===e.commandId&&a.factionId===i.sourceFactionId):undefined;
  const grant=Array.isArray(a?.officeHistory)?a!.officeHistory!.filter(g=>object(g)&&g.month<=i.foundedMonth).at(-1):undefined;
  let valid=Boolean(object(e)&&p&&f&&a&&grant&&typeof r.houseName==="string"&&typeof r.givenName==="string"&&Array.isArray(f.memberUnitIds)&&p.politicalRulerId===r.rulerId&&p.personId===i.personId&&p.sourceUserId===i.sourceUserId&&p.name===i.sourceUserLabel&&p.bornMonth===r.bornMonth&&
   `${r.houseName?.replace(/氏$/,"")}${r.givenName}`===p.personalName&&e.personalName===p.personalName&&p.status!=="ACTIVE"&&
   r.naturalDeathMonth===deriveMilitaryLifeSchedule(p).naturalDeathMonth&&r.deathMonth===p.deathMonth&&
   a.endMonth===i.foundedMonth&&a.endReason==="TRANSFERRED"&&grant.office===e.office&&e.office in MILITARY_OFFICE_NAMES&&
   e.sourceFactionId===i.sourceFactionId&&e.sourceFactionName===i.sourceFactionName&&e.worldMonth===i.foundedMonth&&e.cityId===i.cityId&&
   f.commanderPersonId===p.personId&&f.factionId===i.sourceFactionId&&f.status==="DISBANDED"&&Array.isArray(e.originalMemberUnitIds)&&Array.isArray(e.participants)&&
   e.originalMemberUnitIds.length>=2&&e.originalMemberUnitIds.length<=12&&new Set(e.originalMemberUnitIds).size===e.originalMemberUnitIds.length&&
   e.originalMemberUnitIds.length===f.memberUnitIds.length&&e.originalMemberUnitIds.every((id:string)=>f.memberUnitIds.includes(id))&&
   e.participants.length>=2&&e.participants.length<=1+Math.max(1,Math.floor((e.originalMemberUnitIds.length-1)/2)));
  if(valid){
   if(!['EMPIRE_SPLIT','LOCAL_CRISIS'].includes(e.entryKind))valid=false;
   if(e.entryKind==='EMPIRE_SPLIT'&&e.localCrisis!==undefined)valid=false;
   if(e.entryKind==='LOCAL_CRISIS'){
    const c=e.localCrisis,facts=c?.facts,u=c?.supporter;
    if(!object(c)||!object(facts)||!object(u)||facts.worldMonth!==i.foundedMonth||
      !['loyalty','devastation','stability','strain'].every(k=>Number.isFinite(facts[k])&&facts[k]>=0&&facts[k]<=100)||
      !Number.isSafeInteger(facts.captureCount)||facts.captureCount<0||facts.lastCapturedMonth!==undefined&&(!Number.isSafeInteger(facts.lastCapturedMonth)||facts.lastCapturedMonth<0||i.foundedMonth-facts.lastCapturedMonth<CITY_CAPTURE_GRACE_MONTHS)||
      !evaluatePopularPoliticalCrisis(facts).eligible||evaluatePopularPoliticalCrisis(facts).reason!==c.reason||
      !Number.isFinite(c.chance)||c.chance<=0||c.chance>.09||!Number.isFinite(c.roll)||c.roll<0||c.roll>c.chance||
      c.lastRebellionMonth!==undefined&&(!Number.isSafeInteger(c.lastRebellionMonth)||i.foundedMonth-c.lastRebellionMonth<REBELLION_CITY_COOLDOWN_MONTHS)||
      !Number.isSafeInteger(c.sourceCityCount)||c.sourceCityCount<2||!Number.isSafeInteger(c.activeFactionCount)||c.activeFactionCount<1||c.activeFactionCount>=MAX_ACTIVE_FACTIONS||
      !Number.isSafeInteger(u.userId)||!Number.isSafeInteger(u.bornMonth)||u.bornMonth>i.foundedMonth||u.ownedFactionId!==i.sourceFactionId||u.districtCityId!==i.cityId||!['PHASER','LOGICAL'].includes(u.positionSource)||typeof u.unitId!=='string'||!u.unitId||e.originalMemberUnitIds.includes(u.unitId)||e.participants.some((p:any)=>p.userId===u.userId)||
      !Number.isFinite(u.x)||!Number.isFinite(u.y)||u.x<0||u.y<0||u.x>=save.world.map.widthCells*save.world.map.blockSize||u.y>=save.world.map.heightCells*save.world.map.blockSize||!Number.isFinite(u.loyalty)||u.loyalty<0||u.loyalty>100||
      u.loyalty-Math.min(45,Math.max(0,50-facts.loyalty)*.8+Math.max(0,Math.min(100,facts.devastation))*.15+(facts.lastCapturedMonth!==undefined&&i.foundedMonth-facts.lastCapturedMonth<24?8:0))>=50)valid=false;
   }

   const units=new Set(),users=new Set();
   for(const u of e.participants){
    if(!object(u)||!Number.isSafeInteger(u.userId)||typeof u.name!=="string"||!Number.isSafeInteger(u.bornMonth)||u.bornMonth>e.worldMonth||typeof u.unitId!=="string"||units.has(u.unitId)||users.has(u.userId)||!e.originalMemberUnitIds.includes(u.unitId)||!Number.isFinite(u.x)||!Number.isFinite(u.y)||u.x<0||u.y<0||!["PHASER","LOGICAL"].includes(u.positionSource)||u.districtCityId!==i.cityId||u.ownedFactionId!==i.sourceFactionId)valid=false;
    units.add(u?.unitId);users.add(u?.userId);
   }
   if(e.participants[0]?.userId!==p!.sourceUserId||e.participants[0]?.bornMonth!==p!.bornMonth||e.participants[0]?.name!==p!.name)valid=false;
   try{const career=deriveMilitaryCareer(p!,state.formations,events,e.worldMonth),defense=militaryPoliticalDefense(p!,state.formations,events,e.worldMonth,i.sourceFactionId);
   if(career.serviceMonths!==e.serviceMonths||!Array.isArray(e.capturedEventIds)||JSON.stringify([...career.capturedEventIds].sort())!==JSON.stringify([...e.capturedEventIds].sort())||JSON.stringify(e.defenseEventIds??[])!==JSON.stringify(defense.eventIds)||!militaryPoliticalStrength(e.serviceMonths,e.originalMemberUnitIds.length,e.capturedEventIds.length,defense.eventIds.length,defense.localServiceMonths).eligible)valid=false;}catch{valid=false;}
   const founding=events.filter(x=>x.type==="empire-split"&&x.metadata?.foundingRulerId===r.rulerId);
   if(founding.length!==1||founding[0].metadata?.militaryPersonId!==p!.personId||founding[0].metadata?.militarySplitEvidence!==JSON.stringify(e)||founding[0].metadata?.transferredPopulation!==e.participants.length||founding[0].metadata?.externalPopulation!==0||founding[0].targetFactionId!==i.sourceFactionId)valid=false;
  }
  if(!valid)errors.push("military secession identity, office, followers or life evidence mismatch");
 }
 for(const p of state.people.filter(object))if(p.politicalRulerId&&!p.royalIdentity){
  const rs=records.filter(r=>r.rulerId===p.politicalRulerId&&r.residentIdentity?.military?.personId===p.personId);
  if(rs.length!==1)errors.push("military political identity lacks unique ruler life");
 }
 return errors;
}
