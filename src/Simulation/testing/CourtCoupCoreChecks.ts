import Dynasty from '../../Politics/Dynasty';
import Military from '../../Politics/MilitaryCommandRegistry';
import History from '../../History/WorldHistory';
import random from '../WorldRandom';
import {selectCourtInstigator} from '../../Politics/CourtCoup';
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
  const actor=selectCourtInstigator(evaluation,Military.getPeople());check(evaluation.eligible&&actor,'real damaged court with a willing active commander qualifies for one shared attempt');
  const start=exportWorldSave(core);let v=validateWorldSave(start);check(v.valid,`pre-attempt strict save: ${v.errors.join(';')}`);
  const invoke=(roll:number)=>{const t=core.teams.find((t:any)=>t.name===factionId),writer=random.next;let draws=0;random.next=()=>{const caller=new Error().stack?.split('\n')[2]??'';if(caller.includes('/src/Politics/Dynasty.ts'))draws++;writer.call(random);return roll;};try{(Dynasty as any).evaluateInReignDeposition(t,Dynasty.get(factionId),Dynasty.getCurrentRuler(factionId),month);}finally{random.next=writer;}return draws;};
  for(const roll of [.07,0]){
   hydrateWorldSave(core,structuredClone(start));const before=exportWorldSave(core),writer=History.addEvent;
   History.addEvent=function(e){const id=writer.call(this,e);if(e.type==='court-coup-result')throw Error('injected final coup write');return id;};
   try{invoke(roll);}finally{History.addEvent=writer;}
   check(diffCanonicalWorldSave(before,exportWorldSave(core)).matched,`${roll===0?'success':'failed punishment'} final-write failure rolls back User, army, dynasty, history, IDs and RNG`);
  }
  for(const [roll,outcome] of [[.07,'FAILED'],[0,'SUCCESS']] as const){
   hydrateWorldSave(core,structuredClone(start));const pop=core.teams.reduce((n:number,t:any)=>n+t.users.size,0),beforeIds=new Set(core.teams.flatMap((t:any)=>[...t.users].map((u:any)=>u.id))),beforeFormations=Military.getFormations().length;
   check(invoke(roll)===1,`${outcome} court action uses exactly the original one annual draw`);
   const events=History.getRecordedEvents(),attempt=events.find(e=>e.type==='court-coup-attempt'&&(e.monthIndex??e.year)===month)!;
   check(attempt&&JSON.parse(String(attempt.metadata?.courtCoup)).outcome===outcome,`${outcome} real instigator and result remain linked`);
   const current=Dynasty.getCurrentRuler(factionId)!;
   if(outcome==='FAILED')check(current.id===king.id&&Military.getPerson(actor!.personId)?.appointments.some(a=>a.endMonth===month&&a.endReason==='DISMISSED')&&Military.getFormations().filter(f=>f.commanderPersonId===actor!.personId).every(f=>f.status==='DISBANDED'),'failure retains the monarch and actually removes the instigator command');
   else check(current.id!==king.id&&current.id!==actor!.personId&&Dynasty.get(factionId)!.rulers.find(r=>r.id===king.id)?.status==='deposed','success distinguishes living deposed king, legal successor and military supporter');
   const added=core.teams.flatMap((t:any)=>[...t.users]).filter((u:any)=>!beforeIds.has(u.id));
   check(added.every((u:any)=>outcome==='SUCCESS'&&u.role==='RULER'&&u.rulerId===current.id)&&added.length<=1&&pop+added.length===core.teams.reduce((n:number,t:any)=>n+t.users.size,0)&&Military.getFormations().length===beforeFormations,`${outcome} adds no ordinary residents or formations; only the existing legitimate royal may establish its one audited ruler body`);
   const saved=exportWorldSave(core);v=validateWorldSave(saved);check(v.valid,`${outcome} passes strict V38: ${v.errors.join(';')}`);
   for(const key of ['personId','sourceUserId','bornMonth','commandId']){const bad=structuredClone(saved),e=(bad.worldHistory.events as import('../../History/WorldHistory').WorldEvent[]).find(e=>e.id===attempt.id)!,r=JSON.parse(String(e.metadata!.courtCoup));r.participant[key]=key==='bornMonth'?r.participant[key]-1:'forged';e.metadata!.courtCoup=JSON.stringify(r);check(!validateWorldSave(bad).valid,`${outcome} rejects forged actor ${key}`);}
   const resume=()=>{hydrateWorldSave(core,structuredClone(saved));core.setWorldRunning(true);for(let m=0;m<12;m++){for(let n=0;n<30;n++)core.advanceLogicalStep(SIMULATION_FIXED_STEP_MS);core.scene.sys.events.emit('postupdate');}core.setWorldRunning(false);return exportWorldSave(core);};
   const a=resume(),b=resume();check(validateWorldSave(a).valid&&diffCanonicalWorldSave(a,b).matched,`${outcome} twelve-month continuation preserves strict identity and RNG`);hydrateWorldSave(core,structuredClone(a));check(diffCanonicalWorldSave(a,exportWorldSave(core)).matched,`${outcome} second read keeps the same political result`);
  }
 }finally{hydrateWorldSave(core,structuredClone(base));}
}
