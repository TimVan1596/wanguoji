import Civil from '../../Politics/CivilAdministration';
import {createNaturalCore} from './NaturalCoreHarness';
import {prepareMeritoriousRoyal} from './RoyalHonorCoreChecks';
import {hanGivenNamePool} from '../../Politics/NameCulture';
import {militaryAmbition} from '../../Politics/MilitaryPoliticalDisposition';
import {getRecordedKinRelation} from '../../Politics/DynasticCandidateRules';
import {evaluateDepositionOpportunity} from '../../Politics/InReignDeposition';
import {selectCourtInstigator,courtAttemptChance} from '../../Politics/CourtCoup';
import {chooseCourtTarget} from '../../Politics/CourtCoupOutcome';
import {getFactionStability} from '../../Components/City';
import Military from '../../Politics/MilitaryCommandRegistry';
import Dynasty from '../../Politics/Dynasty';
import History from '../../History/WorldHistory';
import random from '../WorldRandom';
import {mergeCourtCoupReading,readCourtCoup,isSelfCourtCoup} from '../../History/CourtCoupReading';
import {personCareerMilestones} from '../../UI/Components/FactionDetails/PersonCareerTimeline';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {hydrateWorldSave} from '../../Persistence/WorldSaveHydrator';
import {diffCanonicalWorldSave} from '../../Persistence/WorldSaveSchema';
import {SIMULATION_FIXED_STEP_MS} from '../SimulationDriver';
/** Controlled initial name vocabulary, not retrospective renaming or natural frequency evidence. */
export async function runCourtIdentityCore(seed='royal-military-z11'){
 const pool={...hanGivenNamePool};let runtime:Awaited<ReturnType<typeof createNaturalCore>>;
 try{Object.assign(hanGivenNamePool,{singleNames:['玄'],doubleNamePrefixes:[],doubleNameSuffixes:[],doubleNameChancePercent:0});runtime=await createNaturalCore(seed);for(const team of runtime.core.teams)Dynasty.initializeFaction(team,0);}finally{Object.assign(hanGivenNamePool,pool);}
 const {core,game}=runtime!,checks:string[]=[],check=(v:unknown,label:string)=>{if(!v)throw Error(label);checks.push(label);},strict=()=>exportWorldSave(core),clock=(m:number)=>(core.simulator as any).clock.importState({worldMonth:m,elapsedMs:0,running:false});
 const step=()=>{for(let n=0;n<30;n++)(core as any).advanceLogicalStep(SIMULATION_FIXED_STEP_MS);core.scene.sys.events.emit('postupdate');};
 try{for(let m=0;m<120;m++)step();core.setWorldRunning(false);
  const staging=core.teams.find(t=>t.cities.length>=2&&Dynasty.getRoyalMilitaryCandidates(t,120).some(c=>{const r=Dynasty.get(t.name)!.rulers.find(r=>r.id===c.rulerId)!;return r.givenName==='玄'&&militaryAmbition(Military.nextPersonId(),r.bornYear)>10&&militaryAmbition(Military.nextPersonId(),r.bornYear)<=60;}));check(staging,'same-name fixture retains a real adult royal and an existing country');if(staging!.cities.length<3){const town=core.allCities.find(c=>c.ownerTeam!==staging&&c.ownerTeam.cities.length>=2)!;check(town,'real existing enemy city supports the controlled preparation');town.capture(staging!,120);Civil.update(120,core.teams,Dynasty.getAll());}
  const initial=strict();
  const prepared=prepareMeritoriousRoyal(core,initial,check,(r,m,d)=>r.givenName==='玄'&&militaryAmbition(Military.nextPersonId(),r.bornYear)<=60&&d.rulers.some(other=>other.id!==r.id&&other.givenName===r.givenName&&other.accessionYear===undefined&&(other.naturalDeathYear??0)>m+84&&m-other.bornYear>=192&&!!getRecordedKinRelation(other,Dynasty.getCurrentRuler(d.factionId)!,d.rulers)));
  const team=prepared.team,month=prepared.month+48,royal=Dynasty.get(team.name)!.rulers.find(r=>r.militaryIdentity&&Military.getPerson(r.militaryIdentity.personId)?.status==='ACTIVE')!,personId=royal.militaryIdentity!.personId,p=Military.getPerson(personId)!,command=p.appointments.at(-1)!.commandId;
  for(const other of Military.getPeople().filter(o=>o.factionId===team.name&&o.personId!==personId&&o.status==='ACTIVE'))Military.endPersonCommands(other.personId,prepared.month,'DISMISSED');
  const enemy=core.teams.find(t=>t!==team&&t.status==='ACTIVE')!,city=core.allCities.find(c=>c.ownerTeam!==team&&!c.destroyed)!;
  clock(prepared.month+12);city.capture(team,prepared.month+12,undefined,command,personId);
  clock(month-1);team.capitalCity.capture(enemy,month-1);team.cities.forEach((c:any)=>c.loyalty=20);clock(month);
  for(const u of [...team.users] as any[]){u.player.setPosition(team.capitalCity.block.x+2,team.capitalCity.block.y+2);u.player.body.reset(u.player.x,u.player.y);}
  (Military as any).advanceOffices(month,core.teams);Military.updateNobility(month,core.teams,Dynasty.getAll());Military.updateAppanages(month,core.teams,Dynasty.getAll(),core.allCities);
  check(p.nobilityHistory?.some(g=>g.rank==='BO')&&p.appanageHistory?.some(a=>a.kind==='GRANTED'),'actual royal officer earns independent BO and a source-linked appanage before the court transaction');
  Civil.update(month,core.teams,Dynasty.getAll());
  const base=strict(),restore=()=>hydrateWorldSave(core,structuredClone(base));
  const actual=()=>{const t=core.teams.find(t=>t.name===team.name)!,d=Dynasty.get(t.name)!,king=Dynasty.getCurrentRuler(t.name)!,person=Military.getPerson(personId)!,body=t.getUserById(person.sourceUserId);return {t,d,king,person,body};};
  const evaluate=()=>{const {t,d,king}=actual(),e=evaluateDepositionOpportunity({factionId:t.name,status:t.status,identityStage:t.identityStage,cityCount:t.cities.length,stability:getFactionStability(t),currentRuler:king,rulers:d.rulers,houseName:d.houseName,worldMonth:month,calibration:Dynasty.getPoliticalCalibration(),events:History.getEventsForFaction(t.name),military:Military.getPoliticalInfluence(t,month,core.logicalUnitRegistry)}),influence=Military.getCourtAttemptInfluence(t,month,core.logicalUnitRegistry),actor=selectCourtInstigator(e,Military.getPeople(),influence,Dynasty.getAbilityPolicy());check(actor?.personId===personId,'real royal command and actual political personality produce the instigator');return {e,actor:actor!};};
  const invoke=(roll:number)=>{const next=random.next;random.next=()=>{next.call(random);return roll;};try{const {t,d,king}=actual();(Dynasty as any).evaluateInReignDeposition(t,d,king,month);}finally{random.next=next;}};
  actual().body.loyalty=militaryAmbition(personId,p.bornMonth)+1;const support=evaluate(),target=chooseCourtTarget(support.e,support.actor,actual().person)!;
  check(target&&target.rulerId!==royal.id&&target.name===p.personalName&&target.basis!=='SELF','different same-named generated royals remain distinct and the restrained actor supports another legal permanent ruler ID');
  invoke(0);const supported=History.getRecordedEvents().find(e=>e.type==='court-coup-attempt'&&(e.monthIndex??e.year)===month)!,supportRecord=readCourtCoup(supported)!;
  check(supportRecord.targetRulerId===target.rulerId&&!isSelfCourtCoup(supportRecord)&&supported.title.includes('同名异人')&&supported.title.includes('欲拥立'),'real same-name endorsement records different identities and clearly distinguishes them');strict();
  restore();actual().body.loyalty=0;const beforeFailure=strict(),writer=History.addEvent;History.addEvent=function(e){const id=writer.call(this,e);if(e.type==='court-coup-result')throw Error('injected court identity result');return id;};try{invoke(0);}finally{History.addEvent=writer;}
  check(diffCanonicalWorldSave(beforeFailure,strict()).matched,'court result write failure rolls back the whole population, royal/military identity, history, commands and RNG');
  const population=core.teams.reduce((n,t)=>n+t.users.size,0);invoke(0);Military.updateAppanages(month,core.teams,Dynasty.getAll(),core.allCities);
  const raw=History.getRecordedEvents(),attempt=raw.find(e=>e.type==='court-coup-attempt'&&(e.monthIndex??e.year)===month)!,record=readCourtCoup(attempt)!,estate=Military.getPerson(personId)!.appanageHistory!.at(-1)!;
  check(record.actorRulerId===record.targetRulerId&&record.target.basis==='SELF'&&isSelfCourtCoup(record),'self accession is bound to the real military person and his royal identity');
  check(actual().t.rulerUser?.id===p.sourceUserId&&core.teams.reduce((n,t)=>n+t.users.size,0)===population,'self accession reuses the original body without extra population');
  check(estate.kind==='ENDED'&&estate.reason==='ACCESSION','the same actual court accession ends its prior appanage without erasing the grant');
  const beforeReading=JSON.stringify(raw),merged=mergeCourtCoupReading(raw),main=merged.find(e=>e.id===attempt.id)!,sources=String(main.metadata?.sourceEventIds).split(',');
  check(sources.includes(estate.eventId)&&raw.some(e=>sources.includes(e.id)&&e.type==='military-command-ended')&&main.title.includes('夺位得位'),'one political affair retains accession, exact command settlement and the source-linked estate ending');
  const timeline=personCareerMilestones(raw,personId,month),ids=timeline.map(e=>e.id);check(ids.includes(attempt.id)&&!ids.includes(estate.eventId)&&sources.filter(id=>id!==attempt.id).every(id=>!ids.includes(id)),'default personal timeline folds the exact derived effects under one main affair');
  check(raw.some(e=>e.type==='military-ennobled'&&!sources.includes(e.id)&&(e.monthIndex??e.year)===month)&&JSON.stringify(History.getRecordedEvents())===beforeReading,'independent same-month award and all raw events remain unchanged');
  const saved=strict();hydrateWorldSave(core,structuredClone(saved));check(diffCanonicalWorldSave(saved,strict()).matched,'self court graph and all original event ordering round-trip strictly');
  const resume=()=>{hydrateWorldSave(core,structuredClone(saved));core.setWorldRunning(true);for(let m=0;m<12;m++)step();core.setWorldRunning(false);return strict();};const a=resume(),b=resume();check(diffCanonicalWorldSave(a,b).matched,'court accession continues twelve real months deterministically');hydrateWorldSave(core,structuredClone(a));check(diffCanonicalWorldSave(a,strict()).matched,'continued court history survives a second strict read');
  restore();actual().body.loyalty=0;const failed=evaluate();invoke(courtAttemptChance(failed.actor,'MEDIUM',Dynasty.getAbilityPolicy())*.99);const failure=History.getRecordedEvents().find(e=>e.type==='court-coup-attempt'&&(e.monthIndex??e.year)===month)!;check(readCourtCoup(failure)?.outcome==='FAILED'&&Dynasty.getCurrentRuler(team.name)?.id!==royal.id,'failed self attempt applies actual consequences without crowning the actor');strict();
  return {seed,controlledInitialNameVocabulary:true,naturalFrequency:false,checks,actorPersonId:personId,actorRoyalId:royal.id,sameNameTargetId:target.rulerId,month,saveVersion:strict().saveSchemaVersion};
 }finally{game.destroy(true);}
}
