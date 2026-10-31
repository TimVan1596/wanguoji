import Dynasty from '../../Politics/Dynasty';
import Military from '../../Politics/MilitaryCommandRegistry';
import History from '../../History/WorldHistory';
import random from '../WorldRandom';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {hydrateWorldSave} from '../../Persistence/WorldSaveHydrator';
import {diffCanonicalWorldSave} from '../../Persistence/WorldSaveSchema';

/** Failure-first checks through the real captured-monarch succession boundary. */
export function checkSuccessionRollback(core:any,base:ReturnType<typeof exportWorldSave>,factionId:string,check:(v:unknown,s:string)=>void){
 try{
  for(const stage of ['ruler-captured','dynasty-usurped','ruler-succession']){
   hydrateWorldSave(core,structuredClone(base));const t=core.teams.find((x:any)=>x.name===factionId)!,enemy=core.teams.find((x:any)=>x!==t&&x.status==='ACTIVE')!,old=Dynasty.getCurrentRuler(factionId)!;
   for(const c of t.cities)c.loyalty=20;
   const before=exportWorldSave(core),body=t.rulerUser,players=t.players.getChildren().slice(),audit=JSON.stringify(core.simulator.getPopulationTransitionDiagnostics()),writer=History.addEvent,next=random.next;
   let hit=false;History.addEvent=function(e){const id=writer.call(this,e);if(e.type===stage){hit=true;throw Error(`injected ${stage}`);}return id;};
   random.next=()=>{next.call(random);return 0;};let failed=false;
   try{Dynasty.resolveCapturedRuler(t,enemy,base.world.worldMonth);}catch{failed=true;}finally{History.addEvent=writer;random.next=next;}
   check(hit&&failed,`actual ${stage} write failure reaches the transaction boundary`);
   const after=exportWorldSave(core),diff=diffCanonicalWorldSave(before,after);
   check(diff.matched,`complete succession rollback including RNG at ${stage}: ${JSON.stringify(diff.differences.slice(0,4))}`);
   check(Dynasty.getCurrentRuler(factionId)===old&&t.rulerUser===body&&(!body||!body.isDestroyed&&body.player.active&&body.player.scene)&&players.length===t.players.getChildren().length&&players.every((p:any,i:number)=>p===t.players.getChildren()[i]),'rollback keeps original User, ruler and Arcade objects and their iteration order');
   check(JSON.stringify(core.simulator.getPopulationTransitionDiagnostics())===audit,'failed succession creates no population-audit transition');
  }
  hydrateWorldSave(core,structuredClone(base));check(Military.getFormations().every(f=>f.status==='ACTIVE'||f.status==='DISBANDED'),'rollback leaves no orphan command state');
 }finally{hydrateWorldSave(core,structuredClone(base));}
}
