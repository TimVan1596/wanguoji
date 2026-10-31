import {validNoblePoliticalSelection} from './MilitaryNobleSelectionValidation';
import {MILITARY_FORMATION_CAPACITY} from '../Politics/MilitaryOffice';
import {deriveMilitaryLifeSchedule} from '../Politics/MilitaryLifeRules';
import type {RulerSaveV17} from './WorldSaveSchema';
import type {WorldSaveV1} from './WorldSaveSchema';
import type {WorldEvent} from '../History/WorldHistory';
import type {CourtCoupRecord} from '../Politics/CourtCoup';
import {COURT_ATTEMPT_PARAMETERS} from '../Politics/CourtCoup';
import {verifiedPoliticalOffice,militaryPoliticalStrength,militaryPoliticalDefense} from '../Politics/MilitaryPoliticalInfluence';
import {validMilitaryDisposition,willingCourtParticipant} from '../Politics/MilitaryPoliticalDisposition';
import {deriveMilitaryCareer} from '../Politics/MilitaryCareerEvidence';
import {getRecentDepositionEvidence} from '../Politics/InReignDeposition';
import {getRecordedKinRelation} from '../Politics/DynasticCandidateRules';
import {importRulerSave} from './RulerSaveProjection';
const at=(e:WorldEvent)=>e.monthIndex??e.year;
/** Frozen actors and results bind to real office, kin, crisis and canonical consequences. Never reconstruct motives. */
export function validateCourtCoups(save:WorldSaveV1):string[]{
 const errors:string[]=[],events=save.worldHistory.events as WorldEvent[],bound=new Set<string>();
 for(const [i,e] of events.entries())if(e.type==='court-coup-attempt')try{
  const r=JSON.parse(String(e.metadata?.courtCoup)) as CourtCoupRecord,c=r.participant,m=at(e),prior=events.slice(0,i),later=events.slice(i+1);
  const d=save.dynasties.find(d=>d.factionId===r.factionId),rulers=d?(d.rulers as RulerSaveV17[]).map(importRulerSave):[],king=rulers.find(x=>x.id===r.previousRulerId),target=rulers.find(x=>x.id===r.targetRulerId),state=save.registries.militaryCommandRegistry,p=state.people.find(p=>p.personId===c.personId),f=state.formations.find(f=>f.commandId===c.commandId);
  const result=later.find(x=>x.id===r.outcomeEventId),outcomes=later.filter(x=>x.type==='court-coup-result'&&x.metadata?.courtCoupEventId===e.id);
  if(r.version!==1||r.month!==m||m%12!==0||e.id!==`court-coup-${r.factionId}-${m}`||r.outcomeEventId!==`${e.id}-result`||e.actorFactionId!==r.factionId||e.rulerId!==r.previousRulerId||e.metadata?.personId!==c.personId||e.metadata?.targetRulerId!==r.targetRulerId||!result||outcomes.length!==1||result!==outcomes[0]||at(result)!==m||result.actorFactionId!==r.factionId||result.metadata?.outcome!==r.outcome||result.metadata?.personId!==c.personId||result.metadata?.targetRulerId!==target?.id)throw Error('bound opportunity/result');
  if(!king||!target||king.id===target.id||king.accessionYear===undefined||king.accessionYear>m||king.endYear!==undefined&&king.endYear<m||king.deathMonth!==undefined&&king.deathMonth<m||!getRecordedKinRelation(target,king,rulers)||getRecordedKinRelation(target,king,rulers)==='COLLATERAL_KIN'||king.houseName!==target.houseName||m-target.bornYear<192||target.deathMonth!==undefined&&target.deathMonth<m||(target.naturalDeathYear??Infinity)<=m||target.accessionYear!==undefined&&target.accessionYear<m)throw Error('living monarch and legal kin target');
  if(prior.some(x=>x.type==='court-coup-attempt'&&x.actorFactionId===r.factionId&&m-at(x)<60))throw Error('country cooldown');
  const crisis=getRecentDepositionEvidence(r.factionId,prior,m);
  if(!crisis.length||JSON.stringify(crisis.map(x=>x.eventId))!==JSON.stringify(r.crisisEventIds)||!Number.isFinite(r.stability)||r.stability<0||r.stability>100||!Number.isSafeInteger(r.cityCount)||r.cityCount<1||r.stability>40&&r.cityCount>2)throw Error('real crisis and snapshot');
  if(r.attemptProbability!==COURT_ATTEMPT_PARAMETERS[r.policy]||!Number.isFinite(r.roll)||r.roll<0||r.roll>=r.attemptProbability||!Number.isFinite(r.successProbability)||r.successProbability<=0||r.successProbability>.03||!['SUCCESS','FAILED'].includes(r.outcome)||(r.roll<r.successProbability)!==(r.outcome==='SUCCESS')||r.consequence!==(r.outcome==='SUCCESS'?'DEPOSITION':'DISMISSED'))throw Error('shared lottery');
  const a=p?.appointments.find(a=>a.commandId===c.commandId&&a.factionId===r.factionId&&a.startMonth<=m&&(a.endMonth??m)>=m),office=p&&verifiedPoliticalOffice(p,c.commandId,r.factionId,m,prior);
  if(!p||!f||!a||!office||JSON.stringify(office)!==JSON.stringify(c.officeStanding)||p.bornMonth!==c.bornMonth||p.sourceUserId!==c.sourceUserId||p.personalName!==c.personalName||p.name!==c.name||c.factionId!==r.factionId||f.factionId!==r.factionId||f.commanderPersonId!==p.personId||p.deathMonth!==undefined&&p.deathMonth<m||m>=deriveMilitaryLifeSchedule(p).retirementMonth||c.unitCount<2||c.unitCount>MILITARY_FORMATION_CAPACITY[office.office]||c.unitCount!==c.memberUnitIds.length||c.memberUnitIds.some(id=>typeof id!=='string'||!id)||c.unitCount!==new Set(c.memberUnitIds).size||!c.memberUnitIds.includes(c.commanderUnitId)||!c.disposition||!validMilitaryDisposition(c.disposition,p.personId,p.bornMonth,c.finalPoliticalWeight??c.strength)||!willingCourtParticipant(c.disposition)||c.disposition.ambition<=c.disposition.loyalty)throw Error('actual actor');
  if(prior.some(x=>x.type==='military-command-ended'&&x.metadata?.commandId===c.commandId||x.type==='military-person-died'&&x.metadata?.personId===p.personId||['ruler-died','ruler-captured','ruler-deposed'].includes(x.type)&&(x.rulerId===king.id&&x.type!=='ruler-deposed'||x.metadata?.previousRulerId===king.id)||x.type==='heir-died'&&x.metadata?.heirId===target.id||x.type==='military-person-died'&&target.militaryIdentity?.personId&&x.metadata?.personId===target.militaryIdentity.personId))throw Error('ended identity before action');
  if(p.royalIdentity){if(p.royalIdentity.factionId!==r.factionId||!rulers.some(q=>q.id===p.royalIdentity?.rulerId&&q.militaryIdentity?.personId===p.personId)||c.basePoliticalWeight!==undefined||c.finalPoliticalWeight!==undefined||c.nobility!==undefined||c.politicalSelectionWeight!==c.strength*c.disposition.contestWeight)throw Error('actual royal military standing');}
  else if(!validNoblePoliticalSelection(c,save,prior,m,r.factionId,{...d,rulers} as any,king.id,3))throw Error('actual office, nobility and disposition weights');
  const base=Math.min(.015,.005+Math.max(0,crisis.length-1)*.005),strong=crisis.length>=2||crisis.some(x=>x.type==='capital-fallen'||x.type==='empire-split')&&r.stability<=30,pressure=r.successPressure;
  if(pressure&&(!strong||!validNoblePoliticalSelection(pressure,save,prior,m,r.factionId,{...d,rulers} as any,king.id,3)))throw Error('unverified original success pressure');
  const chance=pressure?Math.min(.03,base+Math.min(.01,pressure.strength*.0025+(crisis.length>=3?.0025:0))):base;
  if(Math.abs(r.successProbability-chance)>1e-12)throw Error('original success probability');
  const career=deriveMilitaryCareer(p,state.formations,prior,m),def=militaryPoliticalDefense(p,state.formations,prior,m,r.factionId),strength=militaryPoliticalStrength(career.serviceMonths,c.unitCount,career.verifiedCaptures,def.eventIds.length,def.localServiceMonths);
  if(!strength.eligible||c.strength!==strength.strength||c.serviceMonths!==career.serviceMonths||c.serviceMonths<12||JSON.stringify([...c.capturedEventIds].sort())!==JSON.stringify([...career.capturedEventIds].sort()))throw Error('actual military sources');
  if(r.outcome==='FAILED'){
   if(result.rulerId!==king.id||!later.some(x=>x.type==='military-command-ended'&&at(x)===m&&x.metadata?.commandId===c.commandId&&x.metadata?.personId===p.personId&&x.metadata?.endReason==='DISMISSED'&&x.metadata?.courtCoupEventId===e.id)||a.endMonth!==m||a.endReason!=='DISMISSED'||f.status!=='DISBANDED'||later.some(x=>x.type==='ruler-deposed'&&at(x)===m&&x.metadata?.previousRulerId===king.id))throw Error('actual failed consequence');
  }else if(result.rulerId!==target.id||!later.some(x=>x.id===result.metadata?.depositionEventId&&x.type==='ruler-deposed'&&at(x)===m&&x.actorFactionId===r.factionId&&x.rulerId===target.id&&x.metadata?.previousRulerId===king.id)||king.endYear!==m||king.endReason!=='被废'||target.accessionYear!==m)throw Error('actual successful succession');
  bound.add(result.id);
 }catch(error){errors.push(`invalid court coup ${e.id}: ${String(error)}`);}
 for(const e of events)if(e.type==='court-coup-result'&&!bound.has(e.id))errors.push(`unbound court coup result ${e.id}`);
 return errors;
}
