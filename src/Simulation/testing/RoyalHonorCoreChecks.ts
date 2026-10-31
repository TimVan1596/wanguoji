import Dynasty from '../../Politics/Dynasty';
import Military from '../../Politics/MilitaryCommandRegistry';
import History from '../../History/WorldHistory';
import random from '../WorldRandom';
import {planRoyalHonor} from '../../Politics/RoyalHonors';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {hydrateWorldSave} from '../../Persistence/WorldSaveHydrator';
import {diffCanonicalWorldSave,type RulerSaveV17} from '../../Persistence/WorldSaveSchema';
import {validateWorldSave} from '../../Persistence/WorldSaveValidator';
import {SIMULATION_FIXED_STEP_MS} from '../SimulationDriver';
/** Existing live Core royals only; controlled calendar, real award and persistence transactions. */
export function checkRoyalHonors(core:any,base:ReturnType<typeof exportWorldSave>,check:(v:unknown,s:string)=>void){
 try{
  let month=base.world.worldMonth,team:any;
  for(let offset=0;offset<=60&&!team;offset+=12){month=base.world.worldMonth+offset;team=core.teams.find((t:any)=>{const d=Dynasty.get(t.name);return d&&planRoyalHonor({faction:t,dynasty:d,month,countryName:t.displayName,issuerTitle:Dynasty.getRulerTitleDisplay(t.name,month),people:Military.getPeople(),formations:Military.getFormations(),events:History.getEventsForFaction(t.name)});});}
  check(team,'real existing adult royal qualifies without adding any kin');
  const factionId=team.name;core.simulator.clock.importState({worldMonth:month,elapsedMs:0,running:false});const before=exportWorldSave(core),writer=History.addEvent;
  History.addEvent=function(e){const id=writer.call(this,e);if(e.type==='royal-honor-granted')throw Error('injected honor write failure');return id;};
  try{check(!Dynasty.grantRoyalHonor(team,month),'injected award write fails before commit');}finally{History.addEvent=writer;}
  check(diffCanonicalWorldSave(before,exportWorldSave(core)).matched,'award failure restores royal records, original history and RNG atomically');
  const rng=JSON.stringify(random.exportState()),count=core.teams.reduce((n:number,t:any)=>n+t.users.size,0),commands=JSON.stringify(Military.getFormations()),heirs=JSON.stringify(Dynasty.get(factionId)?.heirIds),g=Dynasty.grantRoyalHonor(team,month);
  check(g&&g.recipientRulerId!==g.issuerRulerId,'real sovereign grants a distinct existing kinsman');
  check(JSON.stringify(random.exportState())===rng&&count===core.teams.reduce((n:number,t:any)=>n+t.users.size,0)&&commands===JSON.stringify(Military.getFormations())&&heirs===JSON.stringify(Dynasty.get(factionId)?.heirIds),'honor creates no RNG draw, population, army or change to normal heirs');
  const saved=exportWorldSave(core);check(validateWorldSave(saved).valid,'strict V37 accepts genuine honor and original kin');
  check(!Dynasty.grantRoyalHonor(team,month)&&History.getRecordedEvents().filter(e=>e.id===g!.eventId).length===1,'repeated update does not duplicate the title or event');
  for(const key of ['issuerRulerId','recipientRulerId','bornMonth','rank','epochFounderId']){const bad=structuredClone(saved),r=bad.dynasties.flatMap(d=>d.rulers as RulerSaveV17[]).find(r=>r.rulerId===g!.recipientRulerId)!,grant=r.royalHonors![0];(grant as any)[key]=key==='bornMonth'?grant.bornMonth-1:'forged';check(!validateWorldSave(bad).valid,`strict save rejects forged honor ${key}`);}
  const resume=()=>{hydrateWorldSave(core,structuredClone(saved));core.setWorldRunning(true);for(let m=0;m<12;m++){for(let n=0;n<30;n++)core.advanceLogicalStep(SIMULATION_FIXED_STEP_MS);core.scene.sys.events.emit('postupdate');}core.setWorldRunning(false);return exportWorldSave(core);};
  const a=resume(),b=resume();check(diffCanonicalWorldSave(a,b).matched,'honor world resumes twelve months deterministically');hydrateWorldSave(core,structuredClone(a));check(diffCanonicalWorldSave(a,exportWorldSave(core)).matched,'second honor save reads without duplicate titles or kin');
 }finally{hydrateWorldSave(core,structuredClone(base));}
}
