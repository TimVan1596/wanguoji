import Factions from '../FactionRegistry';
import {createNaturalCore} from './NaturalCoreHarness';
import Military from '../../Politics/MilitaryCommandRegistry';
import Dynasty from '../../Politics/Dynasty';
import History from '../../History/WorldHistory';
import random from '../WorldRandom';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {hydrateWorldSave} from '../../Persistence/WorldSaveHydrator';
import {validateWorldSave} from '../../Persistence/WorldSaveValidator';
import {diffCanonicalWorldSave} from '../../Persistence/WorldSaveSchema';
import {SIMULATION_FIXED_STEP_MS} from '../SimulationDriver';
import {royalNobleReading} from '../../Politics/RoyalNobleReading';
export async function runRoyalNobilityCore(seed='royal-military-z11'){
 const {core,game}=await createNaturalCore(seed),checks:string[]=[],check=(v:unknown,s:string)=>{if(!v)throw Error(s);checks.push(s);},clock=(m:number)=>(core.simulator as any).clock.importState({worldMonth:m,elapsedMs:0,running:false}),strict=()=>exportWorldSave(core);
 try{
  core.setWorldRunning(false);clock(12);
  const team=core.teams.find(t=>Dynasty.getRoyalMilitaryCandidates(t,12).some(c=>{const r=Dynasty.get(t.name)!.rulers.find(r=>r.id===c.rulerId)!;return r.bornYear>-480&&r.naturalDeathYear!>240&&r.parentId!==Dynasty.getCurrentRuler(t.name)!.id;}))??core.teams.find(t=>Dynasty.getRoyalMilitaryCandidates(t,12).some(c=>Dynasty.get(t.name)!.rulers.find(r=>r.id===c.rulerId)!.bornYear>-480))!;
  check(team,'fixed initial world supplies an actual registered adult royal with legal military entry');
  let d=Dynasty.get(team.name)!,candidate=Dynasty.getRoyalMilitaryCandidates(team,12).find(c=>{const r=d.rulers.find(r=>r.id===c.rulerId)!;return r.bornYear>-480&&r.naturalDeathYear!>240;})!;
  check(candidate&&Dynasty.enlistRoyalMilitary(candidate,team,12,[]),'actual royal bridge creates one real legal command');
  let r=d.rulers.find(r=>r.id===candidate.rulerId)!,p=Military.getPerson(r.militaryIdentity!.personId)!,unit=team.getUserById(p.sourceUserId)!,command=p.appointments[0].commandId;
  const other=core.teams.find(t=>t!==team&&t.status==='ACTIVE')!,site=core.map!.blocks.flat().find(b=>!b.team&&!b.city&&core.allCities.every(c=>Math.hypot(c.block.x-b.x,c.block.y-b.y)>96))!;
  check(site&&Factions.foundCity(other,site,undefined,12),'actual spare city preserves a lawful foreign polity for the transfer branch');
  const targets=core.allCities.filter(c=>c.ownerTeam!==team).slice(0,6);check(targets.length===6,'controlled merit uses six real foreign cities');
  for(let i=0;i<6;i++){
   const month=36+i*24;clock(month);unit.player.setPosition(targets[i].block.x,targets[i].block.y);unit.player.Body.reset(unit.player.x,unit.player.y);targets[i].capture(team,month,undefined,command,p.personId);
   if(i===1){clock(72);Military.updateNobility(72,core.teams,Dynasty.getAll());Dynasty.updateRoyalNobility(72,core.teams);}
  }
  clock(180);Military.updateNobility(180,core.teams,Dynasty.getAll());Dynasty.updateRoyalNobility(180,core.teams);
  check(p.nobilityHistory?.at(-1)?.rank==='HOU'&&d.royalNobility?.at(-1)?.rank==='HOU','actual personal military marquis updates one royal hereditary chain');
  const fixture=strict(),beforePopulation=core.teams.flatMap(t=>[...t.users]).length,birth=r.bornYear,bodyId=unit.id;
  const write=History.addEvent;History.addEvent=function(e){const id=write.call(this,e);if(e.type==='royal-person-registered')throw Error('injected royal registration');return id;};
  try{let failed=false;try{(Dynasty as any).appendRoyalHeir(team,d,180,r.id);}catch{failed=true;}check(failed,'failed actual royal child registration rejects the transaction');}finally{History.addEvent=write;}
  check(diffCanonicalWorldSave(fixture,strict()).matched,'registration failure restores royal IDs, RNG, population and all original history');
  // Existing age-valid royal constructor and the same atomic append used by ensureActiveHeir.
  const pick=random.pickIndex;random.pickIndex=max=>Math.max(0,max-1);let child:import('../../Politics/Dynasty').Ruler;try{child=(Dynasty as any).appendRoyalHeir(team,d,180,r.id);}finally{random.pickIndex=pick;}
  check(child.parentId===r.id&&180-child.bornYear<216&&child.registration?.month===180,'real registered minor has a frozen direct-parent source before settlement');
  check(!child.militaryIdentity&&core.teams.flatMap(t=>[...t.users]).length===beforePopulation,'royal child registration does not create a User or military person');
  clock(181);check(unit.destroyUser(false,{cause:'BATTLE_DEATH',month:181,damageSource:'HOSTILE_HOME_OCCUPATION'}),'actual military casualty ends the original royal person and real body');
  check(r.deathMonth===181&&p.deathMonth===181&&r.bornYear===birth&&!team.getUserById(bodyId),'one actual death preserves birth and disposes the real commander');
  const failedBase=strict();History.addEvent=function(e){const id=write.call(this,e);if(e.type==='royal-noble-act')throw Error('injected royal inheritance');return id;};try{Dynasty.updateRoyalNobility(181,core.teams);}finally{History.addEvent=write;}
  check(diffCanonicalWorldSave(failedBase,strict()).matched,'failed inheritance restores titles, history, population, command and RNG completely');
  const rng=JSON.stringify(random.exportState());Dynasty.updateRoyalNobility(181,core.teams);const act=d.royalNobility?.at(-1);
  check(act?.kind==='SUCCEEDED'&&act.rank==='BO'&&act.holderRulerId===child.id,'registered minor legally inherits a real marquis as baron');
  check(JSON.stringify(random.exportState())===rng&&!child.militaryIdentity&&!Military.getPeople().some(x=>x.royalIdentity?.rulerId===child.id),'inheritance draws no RNG and gives neither military rank nor copied command');
  const saved=strict();Dynasty.updateRoyalNobility(181,core.teams);check(diffCanonicalWorldSave(saved,strict()).matched,'same-month repeated settlement cannot duplicate a title or event');
  check(royalNobleReading(child,d,History.getRecordedEvents(),181)?.current?.rank==='BO','actual royal card reading shows the inherited title independently of military office');
  for(const edit of [(s:any)=>s.dynasties.find((x:any)=>x.factionId===d.factionId).rulers.find((x:any)=>x.rulerId===child.id).parentId='forged',(s:any)=>{const a=s.dynasties.find((x:any)=>x.factionId===d.factionId).royalNobility.at(-1);a.rank='GONG';const e=s.worldHistory.events.find((x:any)=>x.id===a.eventId);e.metadata.royalNobleAct=JSON.stringify(a);},(s:any)=>s.dynasties.find((x:any)=>x.factionId===d.factionId).rulers.find((x:any)=>x.rulerId===child.id).registration.month=182]){const bad=structuredClone(saved);edit(bad);check(!validateWorldSave(bad).valid,'strict replay rejects forged parent, rank or future registration');}
  // Age-valid registered royal records and actual natural lifetime processing.
  // This controlled five-generation fixture is not a natural offspring-frequency claim.
  {
   hydrateWorldSave(core,structuredClone(fixture));const t=core.teams.find(x=>x.name===team.name)!,dy=Dynasty.get(t.name)!;let holder=dy.rulers.find(x=>x.id===candidate.rulerId)!,cursor=192;
   for(const c of t.cities){c.loyalty=100;c.devastation=0;}
   clock(cursor);Military.updateNobility(cursor,core.teams,Dynasty.getAll());Dynasty.updateRoyalNobility(cursor,core.teams);
   check(dy.royalNobility?.at(-1)?.rank==='GONG','actual six-city, fifteen-year royal military service reaches a real personal duke source');
   const ranks=['HOU','BO','ZI','NAN',undefined],advance=(end:number)=>{for(let m=cursor+1;m<=end;m++){clock(m);Dynasty.update(m,core.teams);Dynasty.updateRoyalNobility(m,core.teams);core.scene.sys.events.emit('postupdate');}cursor=end;};
   for(let generation=0;generation<5;generation++){
    const at=Math.max(cursor,holder.bornYear+216);advance(at);clock(at);
    // The existing birth/lifespan sampler receives a fixed legal ticket: the
    // newest feasible child and its normal minimum lifespan, with no edited DOB/death.
    const pick=random.pickIndex;let calls=0;random.pickIndex=max=>++calls===1?Math.max(0,max-1):0;let successor:import('../../Politics/Dynasty').Ruler;try{successor=(Dynasty as any).appendRoyalHeir(t,dy,at,holder.id);}finally{random.pickIndex=pick;}
    if(generation===0){clock(at+1);const ownerPerson=Military.getPerson(holder.militaryIdentity!.personId)!,body=t.getUserById(ownerPerson.sourceUserId)!;check(body.destroyUser(false,{cause:'BATTLE_DEATH',month:at+1,damageSource:'HOSTILE_HOME_OCCUPATION'}),'original duke ends through actual User/royal military casualty');cursor=at+1;Dynasty.updateRoyalNobility(cursor,core.teams);}
    else {check(!holder.militaryIdentity,'inherited royal title never creates a military identity or army');const due=holder.naturalDeathYear!;advance(due);check(holder.deathMonth===due,'inherited civilian royal dies at the original sampled lifespan through actual dynasty lifecycle');}
    const last=dy.royalNobility!.at(-1)!;check(last.rank===ranks[generation]&&(generation===4?last.reason==='RANK_EXHAUSTED':last.kind==='SUCCEEDED'&&last.holderRulerId===successor.id),`real royal chain descends once at generation ${generation}: ${JSON.stringify({expected:ranks[generation],actual:last,holder:holder.id,successor:successor.id})}`);
    check(!successor.militaryIdentity,'each newly inherited royal child has no automatic office or soldiers');strict();holder=successor;
   }
   check(new Set(dy.royalNobility!.map(a=>a.chainId)).size===1&&dy.royalNobility!.filter(a=>a.kind==='SUCCEEDED').length===4,'the complete real five-rank history uses one source chain, without parallel copies');
  }
  // Separate real production branches from the pre-child, already granted checkpoint.
  const restoreGrant=()=>{hydrateWorldSave(core,structuredClone(fixture));const t=core.teams.find(t=>t.name===team.name)!,dy=Dynasty.get(t.name)!,royal=dy.rulers.find(x=>x.id===candidate.rulerId)!;return {t,dy,royal,person:Military.getPerson(royal.militaryIdentity!.personId)!};};
  {
   const {t,dy,royal,person}=restoreGrant();clock(181);t.getUserById(person.sourceUserId)!.destroyUser(false,{cause:'BATTLE_DEATH',month:181,damageSource:'HOSTILE_HOME_OCCUPATION'});Dynasty.updateRoyalNobility(181,core.teams);
   check(dy.royalNobility?.at(-1)?.reason==='NO_HEIR','actual dead royal with no already registered direct child ends the chain without inventing a successor');
   const beforeLate=strict();let refused=false;try{(Dynasty as any).appendRoyalHeir(t,dy,181,royal.id);}catch{refused=true;}check(refused&&diffCanonicalWorldSave(beforeLate,strict()).matched,'production rejects adding a new child to an already dead parent, without reserving future identity or changing history');
  }
  {
   const {t,dy,person}=restoreGrant(),foreign=core.teams.find(x=>x!==t&&x.status==='ACTIVE')!;clock(181);t.getUserById(person.sourceUserId)!.setTeam(foreign,{cause:'LIVE_TRANSFER',month:181});Dynasty.updateRoyalNobility(181,core.teams);
   check(dy.royalNobility?.at(-1)?.reason==='FOREIGN'&&!royalNobleReading(dy.rulers.find(x=>x.id===candidate.rulerId)!,dy,History.getRecordedEvents(),181)?.current,'actual foreign transfer ends the original title, keeping royal and military history');strict();
  }
  const resume=()=>{hydrateWorldSave(core,structuredClone(saved));core.setWorldRunning(true);for(let m=0;m<12;m++){for(let n=0;n<30;n++)(core as any).advanceLogicalStep(SIMULATION_FIXED_STEP_MS);core.scene.sys.events.emit('postupdate');}core.setWorldRunning(false);return strict();};
  const a=resume(),b=resume();check(diffCanonicalWorldSave(a,b).matched,'real V54 royalty and title state resumes twelve months deterministically');hydrateWorldSave(core,structuredClone(a));check(diffCanonicalWorldSave(a,strict()).matched,'second read creates no title, person, population or history');
  return {seed,checks,scope:'controlled actual Core royal enlistment, City.capture, personal ennoblement, existing royal birth generator, User death and formal hereditary transactions; not natural frequency'};
 }finally{game.destroy(true);}
}
