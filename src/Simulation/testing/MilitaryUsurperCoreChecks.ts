import Military from '../../Politics/MilitaryCommandRegistry';
import Dynasty from '../../Politics/Dynasty';
import History from '../../History/WorldHistory';
import random from '../WorldRandom';
import {selectMilitaryUsurper} from '../../Politics/MilitaryUsurpation';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {hydrateWorldSave} from '../../Persistence/WorldSaveHydrator';
import {diffCanonicalWorldSave} from '../../Persistence/WorldSaveSchema';
import {validateWorldSave} from '../../Persistence/WorldSaveValidator';
import {SIMULATION_FIXED_STEP_MS} from '../SimulationDriver';
import {preAccessionMilitary} from '../../Politics/PersonServiceLinks';

/** Actual non-kin army → original successful succession opportunity → same person's new crown. */
export function checkMilitaryUsurper(core:any,base:ReturnType<typeof exportWorldSave>,factionId:string,commanderId:string,check:(v:unknown,s:string)=>void){
 try{
  hydrateWorldSave(core,structuredClone(base));let t=core.teams.find((x:any)=>x.name===factionId)!,p=Military.getPerson(commanderId)!,u=t.getUserById(p.sourceUserId)!;
  for(const v of t.users)if(v.role==='NORMAL'&&!v.militaryPersonId&&!v.historicalPersonId&&!Military.isAssigned(v.player.logicalUnitId)){
   v.player.setPosition(u.player.x+3,u.player.y+3);v.player.body.reset(v.player.x,v.player.y);const s=core.logicalUnitRegistry.getEntry(v.player.logicalUnitId)!.state;s.logicalX=v.player.x;s.logicalY=v.player.y;
  }
  (Military as any).advanceOffices(base.world.worldMonth,core.teams);
  for(const c of t.cities)c.loyalty=20;
  const influence=Military.getPoliticalInfluence(t,base.world.worldMonth,core.logicalUnitRegistry),choice=selectMilitaryUsurper(influence.candidates,Military.getPeople(),Dynasty.get(factionId)!.houseName);
  check(choice?.personId===p.personId&&choice.unitCount>=2,'non-royal genuine marshal and actual recruited residents qualify without adding people');
  const prepared=exportWorldSave(core),beforeCount=core.teams.reduce((n:number,t:any)=>n+t.users.size,0),sourceName=p.personalName,born=p.bornMonth;
  const run=(stage?:string)=>{
   hydrateWorldSave(core,structuredClone(prepared));t=core.teams.find((x:any)=>x.name===factionId)!;p=Military.getPerson(commanderId)!;u=t.getUserById(p.sourceUserId)!;
   const old=Dynasty.getCurrentRuler(factionId)!,before=exportWorldSave(core),writer=History.addEvent,next=random.next;let hit=false;
   random.next=()=>{next.call(random);return 0;};
   History.addEvent=function(e){const id=writer.call(this,e);if(e.type===stage){hit=true;throw Error(`injected ${stage}`);}if(stage==='identity-validation'&&e.type==='dynasty-usurped'){hit=true;Dynasty.getCurrentRuler(factionId)!.bornYear++;}return id;};
   let failure:unknown;try{Dynasty.resolveCapturedRuler(t,core.teams.find((x:any)=>x!==t&&x.status==='ACTIVE')!,base.world.worldMonth);}catch(error){failure=error;}finally{History.addEvent=writer;random.next=next;}
   if(stage){check(hit&&failure,`real military usurpation ${stage} fails at the expected stage`);const after=exportWorldSave(core),diff=diffCanonicalWorldSave(before,after);check(diff.matched,`military accession rollback restores complete world and RNG after ${stage}: ${JSON.stringify(diff.differences.slice(0,4))}`);check(Dynasty.getCurrentRuler(factionId)===old&&u.role==='NORMAL'&&u.player.role==='NORMAL'&&Military.getPerson(p.personId)?.status==='ACTIVE','failed usurper transition preserves same ruler/User/command authority');return undefined;}
   if(failure)throw failure;
   const king=Dynasty.getCurrentRuler(factionId)!;
   check(king.militaryUsurperIdentity?.personId===p.personId&&!king.militaryIdentity&&!p.royalIdentity,'first monarch has independent non-kin provenance, not a fabricated royal enlistment');
   check(king.bornYear===born&&`${king.houseName.replace(/氏$/,'')}${king.givenName}`===sourceName&&t.rulerUser===u&&u.historicalPersonId===p.personId&&u.role==='RULER','existing person, birth and map body become the new monarch');
   check(Military.getFormations().filter(f=>f.commanderPersonId===p.personId&&f.status==='ACTIVE').length===0&&p.appointments.every(a=>a.endMonth!==undefined),'all old commands end at accession and no duplicate army is created');
   check(core.teams.reduce((n:number,t:any)=>n+t.users.size,0)===beforeCount-(before.users.some(x=>x.rulerId===old.id)?1:0),'only the actual old monarch map lifecycle changes population; the usurper is never respawned');
   check(preAccessionMilitary(king,Military.getPeople(),Military.getFormations(),History.getEvents())?.person.personId===p.personId,'new monarch retains a direct link to the same earlier military career');
   const saved=exportWorldSave(core);check(validateWorldSave(saved).valid,'strict full save accepts genuine non-royal usurpation');
   for(const edit of ['bornMonth','personId','sourceUserId','commandId','naturalDeathMonth']){const bad=structuredClone(saved),r=bad.dynasties.flatMap(d=>d.rulers as any[]).find(r=>r.rulerId===king.id)!;r.militaryUsurperIdentity[edit]=typeof r.militaryUsurperIdentity[edit]==='number'?r.militaryUsurperIdentity[edit]+1:'forged';check(!validateWorldSave(bad).valid,`strict save refuses forged usurper ${edit}`);}
   return saved;
  };
  for(const stage of ['military-command-ended','dynasty-usurped','ruler-succession','identity-validation'])run(stage);
  const saved=run()!;
  const resume=()=>{hydrateWorldSave(core,structuredClone(saved));core.setWorldRunning(true);for(let m=0;m<12;m++){for(let n=0;n<30;n++)core.advanceLogicalStep(SIMULATION_FIXED_STEP_MS);core.scene.sys.events.emit('postupdate');}core.setWorldRunning(false);return exportWorldSave(core);};
  const a=resume(),b=resume();check(diffCanonicalWorldSave(a,b).matched,'non-royal usurper save resumes twelve months deterministically');hydrateWorldSave(core,structuredClone(a));check(diffCanonicalWorldSave(a,exportWorldSave(core)).matched,'continued usurper world reads again without identity or army drift');
 }finally{hydrateWorldSave(core,structuredClone(base));}
}
