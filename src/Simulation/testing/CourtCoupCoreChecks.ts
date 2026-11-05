import {militaryAbilities} from '../../Politics/PersonAbilities';
import {mergePoliticalReading} from '../../History/PoliticalReadingProjection';
import {projectRulerHistoricalEvents} from '../../Politics/RulerChronicle';
import {deriveMilitaryChronicle} from '../../Politics/MilitaryChronicle';
import {militaryMilestones} from '../../Politics/MilitaryChroniclePresentation';
import Dynasty from '../../Politics/Dynasty';
import Military from '../../Politics/MilitaryCommandRegistry';
import History from '../../History/WorldHistory';
import random from '../WorldRandom';
import {selectCourtInstigator,courtAttemptChance} from '../../Politics/CourtCoup';
import {evaluateDepositionOpportunity} from '../../Politics/InReignDeposition';
import {getFactionStability} from '../../Components/City';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {hydrateWorldSave} from '../../Persistence/WorldSaveHydrator';
import {diffCanonicalWorldSave} from '../../Persistence/WorldSaveSchema';
import {validateWorldSave} from '../../Persistence/WorldSaveValidator';
import {SIMULATION_FIXED_STEP_MS} from '../SimulationDriver';
/** Actual court opportunity, real troops and lawful kin; injected rolls are not natural samples. */
export function checkCourtCoups(core:any,base:ReturnType<typeof exportWorldSave>,factionId:string,check:(v:unknown,s:string)=>void){
 try{
  const team=core.teams.find((t:any)=>t.name===factionId),enemy=core.teams.find((t:any)=>t!==team&&t.status==='ACTIVE'),month=240;
  core.simulator.clock.importState({worldMonth:month-1,elapsedMs:0,running:false});team.capitalCity.capture(enemy,month-1);
  core.simulator.clock.importState({worldMonth:month,elapsedMs:0,running:false});team.cities.forEach((c:any)=>c.loyalty=20);
  const units=[...team.users] as any[],commanders=units.filter(u=>u.militaryPersonId&&Military.getPerson(u.militaryPersonId)?.status==='ACTIVE');
  const center=team.capitalCity.block;
  for(const u of units){u.player.setPosition(center.x+2,center.y+2);u.player.body.reset(u.player.x,u.player.y);}
  commanders.forEach(u=>u.loyalty=0);(Military as any).advanceOffices(month,core.teams);
  const d=Dynasty.get(team.name)!,king=Dynasty.getCurrentRuler(team.name)!,evaluation=evaluateDepositionOpportunity({factionId:team.name,status:team.status,identityStage:team.identityStage,cityCount:team.cities.length,stability:getFactionStability(team),currentRuler:king,rulers:d.rulers,houseName:d.houseName,worldMonth:month,events:History.getEventsForFaction(team.name),military:Military.getPoliticalInfluence(team,month,core.logicalUnitRegistry)});
  evaluation.royalMilitaryClaims=Military.getRoyalDepositionClaims(team,month,evaluation.candidates.map(c=>c.ruler),core.logicalUnitRegistry);
  const actor=selectCourtInstigator(evaluation,Military.getPeople(),Military.getCourtAttemptInfluence(team,month,core.logicalUnitRegistry),Dynasty.getAbilityPolicy());check(evaluation.eligible&&actor,'real damaged court with a willing active commander qualifies for one shared attempt');
  const start=exportWorldSave(core);let v=validateWorldSave(start);check(v.valid,`pre-attempt strict save: ${v.errors.join(';')}`);
  const invoke=(roll:number)=>{const t=core.teams.find((t:any)=>t.name===factionId),writer=random.next;let draws=0;random.next=()=>{const caller=new Error().stack?.split('\n')[2]??'';if(caller.includes('/src/Politics/Dynasty.ts'))draws++;writer.call(random);return roll;};try{(Dynasty as any).evaluateInReignDeposition(t,Dynasty.get(factionId),Dynasty.getCurrentRuler(factionId),month);}finally{random.next=writer;}return draws;};
  if(Dynasty.getPoliticalCalibration()!=='BASELINE'){
   const beforeCooldown=Dynasty.get(factionId)!.lastDepositionAttemptMonth;check(invoke(.999)===1,'calibrated empty opportunity still consumes exactly one shared draw');
   check(Dynasty.get(factionId)!.lastDepositionAttemptMonth===beforeCooldown&&!History.getRecordedEvents().some(e=>e.type==='court-coup-attempt'),'an unstarted action creates no political history or five-year action cooldown');hydrateWorldSave(core,structuredClone(start));
  }
  const failedRoll=courtAttemptChance(actor!,'MEDIUM',Dynasty.getAbilityPolicy())*.95;
  for(const [roll,failType] of [[failedRoll,'court-coup-result'],[0,'court-coup-result'],[0,'court-service-granted'],[0,'military-ennobled'],[0,'court-reward-granted']] as const){
   hydrateWorldSave(core,structuredClone(start));const before=exportWorldSave(core),writer=History.addEvent;
   History.addEvent=function(e){const id=writer.call(this,e);if(e.type===failType)throw Error('injected final coup write');return id;};
   try{invoke(roll);}finally{History.addEvent=writer;}
   check(diffCanonicalWorldSave(before,exportWorldSave(core)).matched,`${roll===0?'success':'failed punishment'} ${failType} write failure rolls back User, army, dynasty, history, IDs and RNG`);
  }
  const strong=structuredClone(start);for(const c of strong.cities)if(c.ownerFactionId===factionId)c.loyalty=85;
  hydrateWorldSave(core,strong);check(invoke(0)===1,'strong court still admits an actual attempt with one shared opportunity');
  const strongAttempt=History.getRecordedEvents().find(e=>e.type==='court-coup-attempt')!,strongRecord=JSON.parse(String(strongAttempt?.metadata?.courtCoup));
  check(strongRecord.successEligible===true&&strongRecord.depositionBlockers.includes('NO_CURRENT_VULNERABILITY')&&strongRecord.outcome==='SUCCESS'&&Dynasty.getCurrentRuler(factionId)?.id!==king.id,'a sourced military coup can win against a robust court while recording the rejected spontaneous-deposition gate');
  check(validateWorldSave(exportWorldSave(core)).valid,'independent court success against a robust court strictly saves its legal sources');
  for(const [roll,outcome] of [[failedRoll,'FAILED'],[0,'SUCCESS']] as const){
   hydrateWorldSave(core,structuredClone(start));const pop=core.teams.reduce((n:number,t:any)=>n+t.users.size,0),beforeIds=new Set(core.teams.flatMap((t:any)=>[...t.users].map((u:any)=>u.id))),beforeFormations=Military.getFormations().length;
   check(invoke(roll)===1,`${outcome} court action uses exactly the original one annual draw`);
   const events=History.getRecordedEvents(),attempt=events.find(e=>e.type==='court-coup-attempt'&&(e.monthIndex??e.year)===month)!;
   check(attempt&&JSON.parse(String(attempt.metadata?.courtCoup)).outcome===outcome,`${outcome} real instigator and result remain linked`);
   const proof=JSON.parse(String(attempt.metadata?.courtCoup)),actual=Military.getPerson(proof.participant.personId)!;
   check(proof.version===4&&JSON.stringify(proof.participant.abilities)===JSON.stringify(militaryAbilities(actual)),'real court record freezes permanent command/strategy abilities without an additional opportunity draw');
   for(const field of ['command','strategy','source','policy']){const bad=structuredClone(exportWorldSave(core)),row=(bad.worldHistory.events as any[]).find(e=>e.id===attempt.id),r=JSON.parse(String(row.metadata.courtCoup));if(field==='policy')r.abilityPolicy='forged';else if(field==='source')r.participant.abilities.source={...r.participant.abilities.source,sourceUserId:-999};else r.participant.abilities[field]=(r.participant.abilities[field]+1)%101;row.metadata.courtCoup=JSON.stringify(r);check(!validateWorldSave(bad).valid,`strict save rejects forged actual ability ${field}`);}
   const observedLoyalty=proof.participant.disposition.loyalty,live=core.teams.flatMap((t:any)=>[...t.users]).find((u:any)=>u.id===actual.sourceUserId),oldLoyalty=live?.loyalty;if(live){live.loyalty=99;check(JSON.parse(String(attempt.metadata?.courtCoup)).participant.disposition.loyalty===observedLoyalty,'later actual loyalty never rewrites the historical political snapshot');live.loyalty=oldLoyalty;}
   const reading=mergePoliticalReading(events),anchor=reading.find(e=>e.id===attempt.id)!;
   check(anchor.metadata?.courtReadingKind==='COURT_COUP'&&!reading.some(e=>e.type==='court-coup-result'),'actual world and faction reading has one source-linked court action');
   const p=Military.getPerson(actor!.personId)!,militaryRows=militaryMilestones(p,deriveMilitaryChronicle(p,Military.getFormations(),events,month,factionId),events);
   check(militaryRows.filter(e=>e.eventId===attempt.id).length===1&&!militaryRows.some(e=>e.source.startsWith('court-coup-result'))&&Military.getPoliticalEvents(p).filter(e=>e.id===attempt.id).length===1,'real military chronicle and political archive share the one complete narrative');
   const current=Dynasty.getCurrentRuler(factionId)!;
   for(const ruler of [Dynasty.get(factionId)!.rulers.find(r=>r.id===king.id)!,current]){
    check(projectRulerHistoricalEvents(events,{...ruler,accessionYear:ruler.accessionYear!},factionId,month,ruler.chronicle?.notableEventIds??[]).all.some(e=>e.id===attempt.id&&e.title===anchor.title),'actual old/new monarch chronology preserves the same court identities, cause and result');
   }
   if(outcome==='FAILED')check(current.id===king.id&&Military.getPerson(actor!.personId)?.appointments.some(a=>a.endMonth===month&&a.endReason==='DISMISSED')&&Military.getFormations().filter(f=>f.commanderPersonId===actor!.personId).every(f=>f.status==='DISBANDED'),'failure retains the monarch and actually removes the instigator command');
   else check(current.id!==king.id&&current.id!==actor!.personId&&Dynasty.get(factionId)!.rulers.find(r=>r.id===king.id)?.status==='deposed','success distinguishes living deposed king, legal successor and military supporter');
   if(outcome==='SUCCESS'){
    const rewards=events.filter(e=>e.type==='court-service-granted'&&e.metadata?.courtCoupEventId===attempt.id),supporter=core.teams.flatMap((t:any)=>[...t.users]).find((u:any)=>u.id===actor!.sourceUserId);
    check(rewards.length===1&&rewards[0].rulerId===current.id&&supporter?.loyalty===Math.min(100,actor!.disposition!.loyalty+8),'actual supporter receives a single new-monarch sourced court service reward, changing real future loyalty');
    const formal=events.filter(e=>e.type==='court-reward-granted'&&e.metadata?.courtCoupEventId===attempt.id),noble=formal[0]&&events.find(e=>e.id===formal[0].metadata?.nobleGrantEventId);check(formal.length===1&&noble?.type==='military-ennobled'&&noble.rulerId===current.id,'qualified real supporter receives one formal peerage reward backed by existing military merits and the actual new king');
    const loyalty=supporter.loyalty;invoke(0);check(supporter.loyalty===loyalty&&History.getRecordedEvents().filter(e=>e.type==='court-service-granted'&&e.metadata?.courtCoupEventId===attempt.id).length===1,'same political service cannot award a second reward');
   }
   const added=core.teams.flatMap((t:any)=>[...t.users]).filter((u:any)=>!beforeIds.has(u.id));
   check(added.every((u:any)=>outcome==='SUCCESS'&&u.role==='RULER'&&u.rulerId===current.id)&&added.length<=1&&pop+added.length===core.teams.reduce((n:number,t:any)=>n+t.users.size,0)&&Military.getFormations().length===beforeFormations,`${outcome} adds no ordinary residents or formations; only the existing legitimate royal may establish its one audited ruler body`);
   const saved=exportWorldSave(core);v=validateWorldSave(saved);check(v.valid,`${outcome} passes strict current WorldSave: ${v.errors.join(';')}`);
   for(const key of ['personId','sourceUserId','bornMonth','commandId','successProbability','result-source','crisis-source','punishment-source','reward-source','royalSequence','calibration']){const bad=structuredClone(saved),e=(bad.worldHistory.events as import('../../History/WorldHistory').WorldEvent[]).find(e=>e.id===attempt.id)!,r=JSON.parse(String(e.metadata!.courtCoup));if(key==='calibration')r.calibration='forged';else if(key==='royalSequence')r.royalSequence=Number(bad.registries.dynastyRegistrySequence)+1;else if(key==='reward-source'){const reward=(bad.worldHistory.events as import('../../History/WorldHistory').WorldEvent[]).find(e=>e.type==='court-service-granted');if(reward)bad.worldHistory.events=(bad.worldHistory.events as import('../../History/WorldHistory').WorldEvent[]).filter(e=>e.id!==reward.id);else r.targetRulerId=r.previousRulerId;}else if(key==='successProbability')r.successProbability+=.001;else if(key==='result-source')r.outcomeEventId='forged';else if(key==='crisis-source')r.crisisEventIds=['foreign-source'];else if(key==='punishment-source'){const end=(bad.worldHistory.events as import('../../History/WorldHistory').WorldEvent[]).find(e=>e.type==='military-command-ended'&&e.metadata?.courtCoupEventId===attempt.id);if(end)end.metadata!.courtCoupEventId='unrelated';else r.targetRulerId=r.previousRulerId;}else r.participant[key]=key==='bornMonth'?r.participant[key]-1:'forged';e.metadata!.courtCoup=JSON.stringify(r);check(!validateWorldSave(bad).valid,`${outcome} rejects forged actor ${key}`);}
   const resume=()=>{hydrateWorldSave(core,structuredClone(saved));core.setWorldRunning(true);for(let m=0;m<12;m++){for(let n=0;n<30;n++)core.advanceLogicalStep(SIMULATION_FIXED_STEP_MS);core.scene.sys.events.emit('postupdate');}core.setWorldRunning(false);return exportWorldSave(core);};
   const a=resume(),b=resume();check(validateWorldSave(a).valid&&diffCanonicalWorldSave(a,b).matched,`${outcome} twelve-month continuation preserves strict identity and RNG`);hydrateWorldSave(core,structuredClone(a));check(diffCanonicalWorldSave(a,exportWorldSave(core)).matched,`${outcome} second read keeps the same political result`);
  }
  if(Dynasty.getPoliticalCalibration()!=='BASELINE'){
   hydrateWorldSave(core,structuredClone(start));const t=core.teams.find((t:any)=>t.name===factionId);for(const u of t.users)u.loyalty=100;
   const before=exportWorldSave(core),writer=History.addEvent;History.addEvent=function(e){const id=writer.call(this,e);if(e.type==='ruler-deposed')throw Error('injected ordinary deposition write');return id;};
   try{invoke(0);}finally{History.addEvent=writer;}
   check(diffCanonicalWorldSave(before,exportWorldSave(core)).matched,'ordinary annual deposition failed write restores its opportunity draw, dynasty, User, commands, history and IDs');
   const last=Dynasty.get(factionId)!.lastDepositionAttemptMonth;invoke(.999);check(Dynasty.get(factionId)!.lastDepositionAttemptMonth===last,'ordinary missed annual deposition does not start an action cooldown');
  }
 }finally{hydrateWorldSave(core,structuredClone(base));}
}
