import {familyMemberNobleLabel} from '../../UI/Components/FactionDetails/FamilyNoblePanel';
import Military from '../../Politics/MilitaryCommandRegistry';
import Dynasty from '../../Politics/Dynasty';
import History from '../../History/WorldHistory';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {hydrateWorldSave} from '../../Persistence/WorldSaveHydrator';
import {validateWorldSave} from '../../Persistence/WorldSaveValidator';
import {diffCanonicalWorldSave} from '../../Persistence/WorldSaveSchema';
import {SIMULATION_FIXED_STEP_MS} from '../SimulationDriver';
/** Fork the already-created real military family and its actual natural-entry civilian child. */
export function checkFamilyNobleCore(core:any,factionId:string,childId:number,check:(v:unknown,s:string)=>void){
 const original=exportWorldSave(core),team=()=>core.teams.find((t:any)=>t.name===factionId),family=()=>Military.getFamilies().find(f=>f.factionId===factionId)!;
 const clock=(m:number)=>core.simulator.clock.importState({worldMonth:m,elapsedMs:0,running:false});
 const update=()=>Military.updateFamilyTitles(240,core.teams,Dynasty.getAll());
 try{
  update();check(!family().nobleSuccession?.length,'living founder neither retires his title nor gives an adult civilian child an early inheritance');
  const father=Military.getPerson(family().founderPersonId)!,resident=[...team().users].find((u:any)=>u.id===father.sourceUserId) as any;
  clock(240);check(resident.destroyUser(false,{cause:'BATTLE_DEATH',month:240}),'actual founder death commits through User and military command cleanup');
  const death=exportWorldSave(core);check(validateWorldSave(death).valid,'committed real death is valid before a separate title-resolution transaction');
  for(const failure of ['family-title-succeeded','family-state']){
   hydrateWorldSave(core,structuredClone(death));const before=exportWorldSave(core),writer=History.addEvent,commit=Military.commitFamilyTitle;
   if(failure==='family-state')Military.commitFamilyTitle=function(...args){commit.apply(this,args);throw Error('injected family title state write');};
   else History.addEvent=function(e){const id=writer.call(this,e);if(e.type===failure)throw Error('injected family title event');return id;};
   try{update();}finally{History.addEvent=writer;Military.commitFamilyTitle=commit;}
   check(diffCanonicalWorldSave(before,exportWorldSave(core)).matched,`${failure} restores the entire title transaction, event IDs and RNG while retaining the already-committed death`);
  }
  hydrateWorldSave(core,structuredClone(death));const pop=core.teams.reduce((n:number,t:any)=>n+t.users.size,0),people=Military.getPeople().length,formations=JSON.stringify(Military.getFormations());update();
  const f=family(),a=f.nobleSuccession?.at(-1),child=[...team().users].find((u:any)=>u.id===childId) as any;
  check(a?.kind==='SUCCEEDED'&&a.rank==='BO'&&f.members.find(m=>m.memberId===a.holderMemberId)?.sourceUserId===childId,'real marquis founder death leads to one direct-child baron inheritance');
  check(!child.militaryPersonId&&child.role==='NORMAL'&&Military.getPeople().length===people&&JSON.stringify(Military.getFormations())===formations&&core.teams.reduce((n:number,t:any)=>n+t.users.size,0)===pop,'ordinary resident inherits only a title, without military identity, troops, population or royal office');
  check(familyMemberNobleLabel(f,f.members.find(m=>m.memberId===a!.holderMemberId)!,240)==='袭伯爵','family UI reads the real inherited baronage separately from a civilian military status');
  const saved=exportWorldSave(core),v=validateWorldSave(saved);check(v.valid,`strict hereditary title save: ${v.errors.join(';')}`);update();check(diffCanonicalWorldSave(saved,exportWorldSave(core)).matched,'same monthly title update is idempotent');
  for(const field of ['rank','holderMemberId','previousRank','step','sourceGrantEventId']){const bad=structuredClone(saved),f=bad.registries.militaryCommandRegistry.families!.find(f=>f.factionId===factionId)!,a=f.nobleSuccession![0];if(field==='step')a.step++;else (a as any)[field]='forged';check(!validateWorldSave(bad).valid,`strict inheritance rejects forged ${field}`);}
  hydrateWorldSave(core,structuredClone(saved));const heir=[...team().users].find((u:any)=>u.id===childId) as any;check(heir.destroyUser(false,{cause:'BATTLE_DEATH',month:240}),'actual civilian heir can die later in the same month');update();
  const same=exportWorldSave(core),sv=validateWorldSave(same);check(sv.valid&&family().nobleSuccession?.at(-1)?.reason==='NO_HEIR',`same-month later heir death closes its title without invalidating earlier living inheritance: ${sv.errors.join(';')}`);
  const final=family().nobleSuccession!.length;update();check(family().nobleSuccession!.length===final,'a broken chain does not seek newly generated children or recreate its title');
  const resume=()=>{hydrateWorldSave(core,structuredClone(saved));core.setWorldRunning(true);for(let m=0;m<12;m++){for(let i=0;i<30;i++)core.advanceLogicalStep(SIMULATION_FIXED_STEP_MS);core.scene.sys.events.emit('postupdate');}core.setWorldRunning(false);return exportWorldSave(core);};
  const x=resume(),y=resume();check(validateWorldSave(x).valid&&diffCanonicalWorldSave(x,y).matched,'real inheritance deterministically continues twelve months without duplicate titles or changed RNG');hydrateWorldSave(core,structuredClone(x));check(diffCanonicalWorldSave(x,exportWorldSave(core)).matched,'second read preserves actual inherited civilian identity and title chain');
 }finally{hydrateWorldSave(core,structuredClone(original));}
}
