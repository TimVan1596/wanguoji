import {checkOfficePoliticalChoice} from './MilitaryOfficePoliticalCoreChecks';
import {checkMilitaryLifeView} from './MilitaryLifeViewChecks';
import {checkMilitaryAppanages} from './MilitaryAppanageCoreHarness';
import {nextMilitaryHonors} from '../../Politics/MilitaryHonors';
import {checkMeritRollInteraction} from './RoyalArchiveInteractionHarness';
import {createNaturalCore} from './NaturalCoreHarness';
import Military from '../../Politics/MilitaryCommandRegistry';
import Dynasty from '../../Politics/Dynasty';
import History from '../../History/WorldHistory';
import random from '../WorldRandom';
import Factions from '../FactionRegistry';
import {evaluateDepositionOpportunity,chooseDepositionClaimant,selectDepositionCandidates} from '../../Politics/InReignDeposition';
import {getFactionStability} from '../../Components/City';
import {nobleLabel,meritRoster} from '../../Politics/MilitaryNobility';
import {deriveMilitaryLifeSchedule} from '../../Politics/MilitaryLifeRules';
import {preAccessionMilitary} from '../../Politics/PersonServiceLinks';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {hydrateWorldSave} from '../../Persistence/WorldSaveHydrator';
import {validateWorldSave} from '../../Persistence/WorldSaveValidator';
import {diffCanonicalWorldSave} from '../../Persistence/WorldSaveSchema';
import {SIMULATION_FIXED_STEP_MS} from '../SimulationDriver';
export async function runMilitaryNobilityCore(seed:string){
 const {core,game}=await createNaturalCore(seed),checks:string[]=[];
 const check=(v:unknown,s:string)=>{if(!v)throw Error(s);checks.push(s);};
 const clock=(m:number)=>(core.simulator as any).clock.importState({worldMonth:m,elapsedMs:0,running:false});
 const place=(u:any,x:number,y:number)=>{u.player.setPosition(x,y);u.player.body.reset(x,y);const s=core.logicalUnitRegistry.getEntry(u.player.logicalUnitId)!.state;s.logicalX=x;s.logicalY=y;};
 const step=()=>{for(let i=0;i<30;i++)(core as any).advanceLogicalStep(SIMULATION_FIXED_STEP_MS);core.scene.sys.events.emit('postupdate');};
 const strict=()=>exportWorldSave(core),population=()=>core.teams.reduce((n,t)=>n+t.users.size,0);
 try{
  clock(36);core.setWorldRunning(false);
  const home=core.teams.find(t=>{const d=Dynasty.get(t.name),r=Dynasty.getCurrentRuler(t.name);return t.identityStage==='STATE'&&r&&r.naturalDeathYear!>360&&d&&selectDepositionCandidates({currentRuler:r,rulers:d.rulers,houseName:d.houseName,worldMonth:216}).length>=2&&[...t.users].filter(u=>(Military as any).isEligible(u,36)).length>=2;});check(home,'actual formal country has a living sovereign and real adult military candidates');if(!home)throw Error('No fixture country');
  const factionId=home.name,users=[...home.users].filter(u=>(Military as any).isEligible(u,36)).sort((a,b)=>b.bornMonth-a.bornMonth).slice(0,2);for(const u of users)check((Military as any).appoint(u,home.name,36,[u.player.logicalUnitId!]),'actual resident forms one legal colonel command');
  const ids=users.map(u=>u.militaryPersonId!),commands=ids.map(id=>Military.getPerson(id)!.appointments[0].commandId),enemy=core.teams.find(t=>t!==home&&t.status==='ACTIVE')!;
  const site=core.map!.blocks.flat().find(b=>!b.city&&core.allCities.every(c=>Math.hypot(c.block.x-b.x,c.block.y-b.y)>96))!;check(site,'real terrain supports a spare enemy city');site.claimForTeam(enemy);Factions.foundCity(enemy,site,undefined,36);
  Military.updateNobility(36,core.teams,Dynasty.getAll());check(!Military.getPerson(ids[0])!.nobilityHistory,'no verified captures means no title');
  const towns=core.allCities.filter(c=>c.ownerTeam!==home&&c.block!==site).slice(0,6);check(towns.length===6,'controlled war uses six different real cities');
  for(const [i,c]of towns.entries()){clock(60+i*12);place(users[0],c.block.x,c.block.y);c.capture(home,60+i*12,undefined,commands[0],ids[0]);}
  for(const [i,c]of towns.slice(0,2).entries()){clock(168+i*12);c.capture(enemy,168+i*12);clock(180+i*12);place(users[1],c.block.x,c.block.y);c.capture(home,180+i*12,undefined,commands[1],ids[1]);}
  clock(216);const base=strict();
  const restore=(save=base)=>{hydrateWorldSave(core,structuredClone(save));return {t:core.teams.find(t=>t.name===factionId)!,d:Dynasty.get(factionId)!,p:Military.getPerson(ids[0])!,q:Military.getPerson(ids[1])!};};
  checkOfficePoliticalChoice(core,base,ids,factionId,check);
  // Isolated issuer failure: the real history writer appends then throws.
  const writer=History.addEvent,before=strict();History.addEvent=function(e){const id=writer.call(this,e);if(e.type==='military-ennobled')throw Error('injected after-write failure');return id;};
  try{Military.updateNobility(216,core.teams,Dynasty.getAll());}finally{History.addEvent=writer;}
  check(diffCanonicalWorldSave(before,strict()).matched,'failed ennoblement rolls back its records and history without population or RNG change');
  const pop=population(),rng=JSON.stringify(random.exportState()),sizes=Military.getFormations().map(f=>f.memberUnitIds.length);Military.updateNobility(216,core.teams,Dynasty.getAll());
  check(Military.getPerson(ids[0])!.nobilityHistory?.[0].rank==='BO','current real sovereign grants a baronage for six actual captured cities');Military.updateNobility(216,core.teams,Dynasty.getAll());check(Military.getPerson(ids[0])!.nobilityHistory!.length===1,'same month never skips multiple noble ranks');
  for(const m of [228,240]){clock(m);Military.updateNobility(m,core.teams,Dynasty.getAll());}
  const p=Military.getPerson(ids[0])!,grants=p.nobilityHistory!;check(grants.map(g=>g.rank).join(',')==='BO,HOU,GONG','long service and distinct important city results legitimately reach all three ranks');
  check(pop===population()&&rng===JSON.stringify(random.exportState())&&JSON.stringify(sizes)===JSON.stringify(Military.getFormations().map(f=>f.memberUnitIds.length)),'noble grants change neither bodies, capacity, membership nor RNG');
  check(Military.getChronicle(p,240).filter(e=>e.source.startsWith('military-ennobled')).length===3,'each real grant appears once in the military chronicle');check(Military.getChronicle(p,120).every(e=>!e.text.includes('爵')),'future peerage never backfills an earlier campaign');
  await checkMeritRollInteraction(core,factionId,check);
  const saved=strict();await checkMilitaryAppanages(core,saved,ids[0],check,base);for(const mutate of [(s:any)=>s.registries.militaryCommandRegistry.people.find((x:any)=>x.personId===ids[0]).nobilityHistory[0].rulerId='fake',(s:any)=>s.registries.militaryCommandRegistry.people.find((x:any)=>x.personId===ids[0]).nobilityHistory[0].cityIds.push('fake'),(s:any)=>s.registries.militaryCommandRegistry.people.find((x:any)=>x.personId===ids[0]).nobilityHistory.push({...grants[0]})]){const bad=structuredClone(saved);mutate(bad);check(!validateWorldSave(bad).valid,'strict save rejects invented monarch, merit or duplicate title');}
  const record=JSON.stringify(grants);meritRoster(Military.getPeople().reverse(),Military.getFormations(),History.getEvents(),factionId,240);check(JSON.stringify(p.nobilityHistory)===record,'dynamic merit ranking cannot delete or rewrite a formal grant');
  const resume=()=>{hydrateWorldSave(core,structuredClone(saved));core.setWorldRunning(true);for(let i=0;i<12;i++)step();core.setWorldRunning(false);return strict();};const a=resume(),b=resume();check(diffCanonicalWorldSave(a,b).matched,'ennobled army save resumes twelve real months identically');hydrateWorldSave(core,structuredClone(a));check(diffCanonicalWorldSave(a,strict()).matched,'second read preserves the same people, titles and army');
  // Same-month battle death and legal posthumous act share one display while both real events survive.
  {const {t,p}=restore(saved);t.getUserById(p.sourceUserId)!.destroyUser(false,{cause:'BATTLE_DEATH',month:240,damageSource:'HOSTILE_HOME_OCCUPATION'});clock(240);Military.updateHonors(240,core.teams,Dynasty.getAll());strict();checkMilitaryLifeView(core,p,240,'DEATH_POSTHUMOUS',check);}
  // Formal posthumous evaluation uses the actual death transaction, never age or a fabricated death.
  {
   const {t,p}=restore(saved),body=t.getUserById(p.sourceUserId)!;body.destroyUser(false,{cause:'BATTLE_DEATH',month:240,damageSource:'HOSTILE_HOME_OCCUPATION'});clock(252);
   const dead=strict(),history=History.addEvent;
   check(nextMilitaryHonors(p,Military.getFormations(),History.getEvents(),252,core.teams.map(x=>x===t?{...x,status:'EXILED'}:x),Dynasty.getAll()).length===0,'no lawful authority means no invented posthumous act');
   History.addEvent=function(e){const id=history.call(this,e);if(e.type==='military-posthumous')throw Error('injected honor write failure');return id;};
   try{Military.updateHonors(252,core.teams,Dynasty.getAll());}finally{History.addEvent=history;}
   check(diffCanonicalWorldSave(dead,strict()).matched,'failed posthumous act rolls back honor and original history atomically');
   const beforePop=population(),beforeRandom=JSON.stringify(random.exportState());Military.updateHonors(252,core.teams,Dynasty.getAll());const h=p.honorHistory?.[0];
   check(h?.kind==='POSTHUMOUS'&&h.epithet==='武烈'&&h.deathMonth===240&&h.month===252,'real dead decorated veteran receives one formal evidence-backed posthumous title');
   Military.updateHonors(252,core.teams,Dynasty.getAll());check(p.honorHistory?.length===1&&p.deathMonth===240&&population()===beforePop&&JSON.stringify(random.exportState())===beforeRandom,'repeated honor opportunity changes neither life, people, army nor RNG');
   check(Military.getChronicle(p,252).some(e=>e.eventId===h!.eventId)&&!Military.getChronicle(p,239).some(e=>e.text.includes('武烈')),'posthumous act is readable after death and never backfilled into a living campaign');
   const honored=strict();for(const edit of [(s:any)=>s.registries.militaryCommandRegistry.people.find((p:any)=>p.personId===ids[0]).honorHistory[0].month=228,(s:any)=>s.registries.militaryCommandRegistry.people.find((p:any)=>p.personId===ids[0]).honorHistory[0].epithet='文忠']){const bad=structuredClone(honored);edit(bad);check(!validateWorldSave(bad).valid,'strict save rejects invented posthumous date or evaluation');}
   const continuation=()=>{hydrateWorldSave(core,structuredClone(honored));core.setWorldRunning(true);for(let i=0;i<12;i++)step();core.setWorldRunning(false);return strict();};const x=continuation(),y=continuation();check(diffCanonicalWorldSave(x,y).matched,'formal posthumous identity resumes twelve months deterministically');hydrateWorldSave(core,structuredClone(x));check(diffCanonicalWorldSave(x,strict()).matched,'second read retains the same formal posthumous record');
  }
  for(const ending of ['retire','battle','natural','transfer']){
   const {t,p}=restore(saved),body=t.getUserById(p.sourceUserId)!,titles=JSON.stringify(p.nobilityHistory);
   if(ending==='retire'){const due=Math.ceil(deriveMilitaryLifeSchedule(p).retirementMonth/12)*12;clock(due);(Military as any).advanceLifecycles(due,core.teams);}
   if(ending==='battle')body.destroyUser(false,{cause:'BATTLE_DEATH',month:240,damageSource:'HOSTILE_HOME_OCCUPATION'});
   if(ending==='natural'){const due=Math.ceil(deriveMilitaryLifeSchedule(p).naturalDeathMonth/12)*12;clock(due);(Military as any).advanceLifecycles(due,core.teams);}
   if(ending==='transfer'){const e=core.teams.find(x=>x!==t&&x.status==='ACTIVE')!;body.setTeam(e,{cause:'LIVE_TRANSFER',month:240});check(!nobleLabel(p,e.name,240),'old-country peerage never becomes a new-country peerage');Military.updateHonors(240,core.teams,Dynasty.getAll());check(!p.honorHistory,'ordinary transfer is not a verified rebellion and never causes revocation');}
   check(JSON.stringify(p.nobilityHistory)===titles&&Military.getFormations().every(f=>f.commanderPersonId!==p.personId||f.status==='DISBANDED'),'life or identity ending retains peerage history and releases the real command');strict();
  }
  // A real royal receives the same title, then enters the existing legal deposition succession.
  {
   const {t,d}=restore();Military.endPersonCommands(ids[1],216,'DISMISSED');
   const current=Dynasty.getCurrentRuler(t.name)!,legal=selectDepositionCandidates({currentRuler:current,rulers:d.rulers,houseName:d.houseName,worldMonth:288});
   const candidate=Dynasty.getRoyalMilitaryCandidates(t,216).filter(c=>legal.some(x=>x.ruler.id===c.rulerId)).find(c=>{const r=d.rulers.find(r=>r.id===c.rulerId)!;return r.naturalDeathYear!>336&&r.bornYear>216-480;});check(candidate,'real adult kin has a legal political identity and existing lifespan');if(!candidate)throw Error('No royal candidate');
   const royal=d.rulers.find(r=>r.id===candidate.rulerId)!,birth=royal.bornYear,parent=royal.parentId,life=royal.naturalDeathYear,bodyCount=population();check(Dynasty.enlistRoyalMilitary(candidate,t,216,[]),'actual royal bridge creates its unique one-person command');
   const rp=Military.getPerson(royal.militaryIdentity!.personId)!,rf=Military.getFormations().find(f=>f.commanderPersonId===rp.personId&&f.status==='ACTIVE')!,u=t.getUserById(rp.sourceUserId)!;
   check(population()===bodyCount+1&&royal.bornYear===birth&&royal.parentId===parent&&royal.naturalDeathYear===life,'royal entry preserves one life and audits only its one original identity body');
   const en=core.teams.find(x=>x!==t&&x.status==='ACTIVE')!;
   for(const [i,c]of towns.slice(0,2).map(c=>core.allCities.find(x=>x.id===c.id)!).entries()){clock(228+i*12);c.capture(en,228+i*12);clock(240+i*12);place(u,c.block.x,c.block.y);c.capture(t,240+i*12,undefined,rf.commandId,rp.personId);}
   clock(276);Military.updateNobility(276,core.teams,Dynasty.getAll());const title=rp.nobilityHistory?.[0];check(title?.rank==='BO'&&title.rulerId===current.id,'real royal officer receives a formal baronage from the same current sovereign');Military.updateAppanages(276,core.teams,Dynasty.getAll(),core.allCities);check(rp.appanageHistory?.at(-1)?.kind==='GRANTED','royal officer shares the same real city appanage rules');strict();
   clock(288);t.capitalCity!.capture(en,288);t.capitalCity!.capture(en,288);for(const c of t.cities)c.loyalty=20;
   const evaluation=evaluateDepositionOpportunity({factionId:t.name,status:t.status,identityStage:t.identityStage,cityCount:t.cities.length,stability:getFactionStability(t),currentRuler:current,rulers:d.rulers,houseName:d.houseName,worldMonth:288,events:History.getEvents(),military:Military.getPoliticalInfluence(t,288,core.logicalUnitRegistry)});
   evaluation.royalMilitaryClaims=Military.getRoyalDepositionClaims(t,288,evaluation.candidates.map(c=>c.ruler),core.logicalUnitRegistry);
   const choice=Array.from({length:1000},(_,i)=>chooseDepositionClaimant(evaluation,288,evaluation.probability*(i+.5)/1000)).find(x=>x?.claimant.ruler.id===royal.id);check(evaluation.eligible&&choice,'the existing lawful claimant selection can choose this actual royal');if(!choice)throw Error('No legal choice');evaluation.selection=choice.evidence;evaluation.militaryRoll=choice.evidence.roll;
   check((Dynasty as any).commitDeposition(t,d,current,royal,choice.claimant.relation,288,evaluation),'existing royal political transaction succeeds without a new title-driven inheritance rule');
   check(rp.politicalRulerId===royal.id&&rp.nobilityHistory?.[0].eventId===title!.eventId&&rp.bornMonth===birth&&royal.parentId===parent&&royal.naturalDeathYear===life,'accession preserves the original peerage, person, parent and lifespan');
   check(preAccessionMilitary(royal,Military.getPeople(),Military.getFormations(),History.getEvents())?.entries.some(e=>e.eventId===title!.eventId),'formal peerage is retained in the pre-accession military life');Military.updateAppanages(288,core.teams,Dynasty.getAll(),core.allCities);check(rp.appanageHistory?.at(-1)?.kind==='ENDED'&&rp.appanageHistory.at(-1)?.reason==='ACCESSION','actual legal royal accession ends its former personal appanage, retaining the one permanent identity');strict();
  }
  // Same actual army strength; title affects participant selection only, never the monarch pool or the original roll.
  {
   const {t,d,p,q}=restore();Military.endPersonCommands(p.personId,216,'DISMISSED');Military.updateNobility(216,core.teams,Dynasty.getAll());check(q.nobilityHistory?.at(-1)?.rank==='BO'&&!p.nobilityHistory,'retired officer receives no new living service grant');
   check((Military as any).appoint(t.getUserById(p.sourceUserId),t.name,216,[t.getUserById(p.sourceUserId)!.player.logicalUnitId!]),'real veteran reappointment keeps the same permanent person');
   const influence=Military.getPoliticalInfluence(t,216,core.logicalUnitRegistry),plain=Military.getPoliticalInfluence(t,216,core.logicalUnitRegistry,false,false);check(influence.candidates[0].personId===q.personId&&plain.candidates[0].personId===p.personId,'bounded verified peerage changes a real participant choice among equal base strengths');
   check(influence.candidates.every(c=>(c.finalPoliticalWeight??c.strength)-(c.basePoliticalWeight??c.strength)<=c.strength*.15+1e-12),'noble contribution retains its separate fifteen-percent ceiling');check(influence.candidates.every(c=>(c.finalPoliticalWeight??c.strength)<=c.strength*1.25+1e-12),'office and noble contributions have an additive twenty-five-percent ceiling');
   const king=Dynasty.getCurrentRuler(t.name)!,peace=evaluateDepositionOpportunity({factionId:t.name,status:t.status,identityStage:t.identityStage,cityCount:t.cities.length,stability:80,currentRuler:king,rulers:d.rulers,houseName:d.houseName,worldMonth:216,events:[],military:influence});check(!peace.militaryParticipant,'a title and an army do not create a crisis or a coup');
   const e=core.teams.find(x=>x!==t&&x.status==='ACTIVE')!;t.capitalCity!.capture(e,216);t.capitalCity!.capture(e,216);for(const city of t.cities)city.loyalty=20;const crisis=strict(),results:any[]=[];
   for(const enabled of [false,true]){
    hydrateWorldSave(core,structuredClone(crisis));const team=core.teams.find(x=>x.name===factionId)!,dy=Dynasty.get(factionId)!,current=Dynasty.getCurrentRuler(factionId)!,get=Military.getPoliticalInfluence,next=random.next;let calls=0;
    if(!enabled)Military.getPoliticalInfluence=function(...args){return get.call(this,args[0],args[1],args[2],args[3],false);};
    const evaluation=evaluateDepositionOpportunity({factionId,status:team.status,identityStage:team.identityStage,cityCount:team.cities.length,stability:getFactionStability(team),currentRuler:current,rulers:dy.rulers,houseName:dy.houseName,worldMonth:216,events:History.getEvents(),military:Military.getPoliticalInfluence(team,216,core.logicalUnitRegistry)});check(evaluation.eligible&&evaluation.militaryParticipant,'real capital losses create an existing military-backed deposition opportunity');
    random.next=function(){const actual=next.call(random);return calls++===0?evaluation.probability*.75:actual;};
    try{(Dynasty as any).evaluateInReignDeposition(team,dy,current,216);}finally{random.next=next;Military.getPoliticalInfluence=get;}
    const event=History.getEvents().find(x=>x.type==='ruler-deposed'&&x.year===216)!;check(event,'actual existing deposition production transaction succeeds');const proof=JSON.parse(String(event.metadata?.militaryParticipation));
    check(proof.participant.personId===(enabled?ids[1]:ids[0]),'actual political event records its chosen real participant, distinct from the legal successor');
    if(enabled){check(proof.participant.nobleSelection.candidates.length===2,'political event preserves original candidates, ranks, troop identities and base/final weights');const verified=strict();for(const field of ['finalPoliticalWeight','basePoliticalWeight']){const bad=structuredClone(verified),entry=(bad.worldHistory.events as import("../../History/WorldHistory").WorldEvent[]).find(x=>x.id===event.id)!;const forged=JSON.parse(String(entry.metadata!.militaryParticipation));forged.participant.nobleSelection.candidates[0][field]+=1;entry.metadata!.militaryParticipation=JSON.stringify(forged);check(!validateWorldSave(bad).valid,'strict political save rejects forged candidate weights');}}
    results.push({enabled,calls,probability:evaluation.probability,rng:random.exportState(),newRuler:dy.currentRulerId});
   }
   check(results[0].calls===results[1].calls&&results[0].probability===results[1].probability&&JSON.stringify(results[0].rng)===JSON.stringify(results[1].rng)&&results[0].newRuler===results[1].newRuler,'noble choice changes neither crisis probability, extra RNG calls nor legal monarch selection');
  }
  return {seed,checks,scope:'actual existing User, City.capture, monarch, ennoblement, military political and save transactions'};
 }finally{game.destroy(true);}
}
