import Lifetime from "../FactionLifetimeRecord";
import {createNaturalCore} from "./NaturalCoreHarness";
import Factions from "../FactionRegistry";
import Dynasty from "../../Politics/Dynasty";
import History from "../../History/WorldHistory";
import Military from "../../Politics/MilitaryCommandRegistry";
import {assessPopularSupport} from "../PopularRebellionSupport";
import {exportWorldSave} from "../../Persistence/WorldSaveExporter";
import {hydrateWorldSave} from "../../Persistence/WorldSaveHydrator";
import {validateWorldSave} from "../../Persistence/WorldSaveValidator";
import {diffCanonicalWorldSave} from "../../Persistence/WorldSaveSchema";
import {SIMULATION_FIXED_STEP_MS} from "../SimulationDriver";

/** Real User/Player, city, founding, royal lifecycle and V19 transactions, not a second simulator. */
export async function runResidentFounderCore(seed="resident-z6"){
 const results=[];
 for(const kind of ["popular","split"]){
  const {core,game}=await createNaturalCore(`${seed}-${kind}`),checks:string[]=[];
  const check=(ok:unknown,label:string)=>{if(!ok)throw new Error(`${kind}: ${label}`);checks.push(label);};
  const strict=()=>{let save;try{save=exportWorldSave(core);}catch(e){throw new Error(`${String(e)}; teams=${core.teams.map(t=>t.name)}; records=${JSON.stringify(Lifetime.exportState().records.map(r=>r.factionId))}; checks=${checks[checks.length-1]}`);}const v=validateWorldSave(save);if(!v.valid)throw new Error(v.errors.join("; "));return save;};
  const step=()=>{for(let n=0;n<30;n++)(core as any).advanceLogicalStep(SIMULATION_FIXED_STEP_MS);core.scene.sys.events.emit("postupdate");};
  try{
   core.setWorldRunning(false);
   const parent=core.teams.find(t=>t.cities.length&&[...t.users].filter(u=>u.role==="NORMAL").length>=4)!,city=parent.cities[0];
   while(parent.cities.length<4){const site=core.map!.blocks.flat().find(b=>!b.team&&!b.city&&core.allCities.every(c=>Math.hypot(c.block.x-b.x,c.block.y-b.y)>256));if(!site)throw new Error("No real city site");Factions.foundCity(parent,site,undefined,0);}
   for(const c of parent.cities)c.loyalty=0;
   city.devastation=100;
   for(const u of parent.users)if(u.role==="NORMAL"){u.player.setPosition(city.block.x+1,city.block.y+1);(u.player.body as Phaser.Physics.Arcade.Body).reset(u.player.x,u.player.y);}
   const eligible=assessPopularSupport(city,0).users;
   check(eligible.length>=2,"actual local ordinary residents support the crisis");
   const originalUsers=core.teams.flatMap(t=>[...t.users]),before=originalUsers.length,ownerCount=parent.users.size;
   const beforeHistory=JSON.stringify(History.exportState()),beforeDynasty=JSON.stringify(Dynasty.exportState());
   const create=()=>kind==="popular"?Factions.createRebelFaction({city,year:0,factionType:"REBEL"}):Factions.createSplitFaction(parent,[city],0,100)?.team;
   const initialize=Dynasty.initializeFaction;
   Dynasty.initializeFaction=function(...args:Parameters<typeof initialize>){if(args[3])throw new Error("injected royal initialization failure");return initialize.apply(this,args);};
   try{check(!create(),"failed royal initialization refuses city transaction");}finally{Dynasty.initializeFaction=initialize;}
   check(parent.users.size===ownerCount&&city.ownerTeam===parent&&eligible.every(u=>u.team===parent&&!u.historicalPersonId&&u.role==="NORMAL"),"initialization rollback preserves original Users, city and roles");
   check(JSON.stringify(History.exportState())===beforeHistory&&JSON.stringify(Dynasty.exportState())===beforeDynasty,"initialization rollback leaves no orphan ruler or history");
   const register=core.addRuntimeTeam;core.addRuntimeTeam=()=>false;
   try{check(!create(),"runtime registration failure aborts prepared founder");}finally{core.addRuntimeTeam=register;}
   check(JSON.stringify(Dynasty.exportState())===beforeDynasty&&JSON.stringify(History.exportState())===beforeHistory&&eligible.every(u=>!u.historicalPersonId&&u.role==="NORMAL"&&u.team===parent),"registration rollback restores permanent identity and logical role");
   const created=create();check(created,"production founding succeeds");if(!created)throw new Error("No polity");
   const r=Dynasty.getCurrentRuler(created.name)!,i=r.residentIdentity!,u=created.rulerUser!;
   check(Boolean(i)&&eligible.includes(u)&&originalUsers.includes(u)&&u.historicalPersonId===i.personId,"founder is the actual transferred resident and same live object");
   check(u.id===i.sourceUserId&&u.name===i.sourceUserLabel&&u.bornMonth===r.bornYear&&r.bornYear===i.bornMonth&&i.sourceFactionId===parent.name,"original numeric ID, label, birth and parent faction are preserved");
   const entry=core.logicalUnitRegistry.getEntry(u.player.logicalUnitId!)!;
   check(u.role==="RULER"&&u.player.role==="RULER"&&entry.state.role==="RULER"&&entry.state.rulerId===r.id,"same real Player and logical unit acquire political role");
   check(core.teams.flatMap(t=>[...t.users]).length===before&&!parent.users.has(u)&&created.users.has(u),"founding conserves world population with no extra royal avatar");
   check(Military.getPeople().every(p=>p.sourceUserId!==u.id),"founder is not duplicated as a military person");
   const save=strict();
   for(const mutate of [(s:any)=>{s.users.find((x:any)=>x.historicalPersonId===i.personId).bornMonth--;},(s:any)=>{s.dynasties.find((d:any)=>d.factionId===created.name).rulers[0].residentIdentity.sourceUserId++;},(s:any)=>{s.users.push({...s.users.find((x:any)=>x.historicalPersonId===i.personId),userId:987654321});}]){const bad=structuredClone(save);mutate(bad);check(!validateWorldSave(bad).valid,"strict V19 rejects broken or duplicate resident identity");}
   check(!validateWorldSave({...save,saveSchemaVersion:18}).valid,"V18 is explicitly unsupported without rewriting the old file");
   // Map detachment/restoration is not biological death; retain real political/city facts.
   created.markExiled(0);Dynasty.markExiled(created,0);
   check(!r.deathMonth&&r.status==="exiled"&&u.isDestroyed&&!created.rulerUser,"exile removes entity without killing the permanent person");
   created.markActive(0);Dynasty.markRestored(created,0,city.name);
   const restored=created.rulerUser!;
   check(restored!==u&&restored.id===u.id&&restored.historicalPersonId===i.personId&&restored.bornMonth===u.bornMonth&&r.id===restored.rulerId,"restoration recreates only the same person's map entity");
   check(core.teams.flatMap(t=>[...t.users]).filter(x=>x.historicalPersonId===i.personId).length===1,"restoration has one live binding");
   const actualSave=strict();
   const resume=()=>{hydrateWorldSave(core,JSON.parse(JSON.stringify(actualSave)));core.setWorldRunning(true);for(let m=0;m<12;m++)step();core.setWorldRunning(false);return strict();};
   const first=resume(),second=resume();
   check(diffCanonicalWorldSave(first,second).matched,"two V19 hydrations continue identically for twelve production months");
   const sr=(second.dynasties.find(d=>d.factionId===created.name)!.rulers as any[]).find(x=>x.rulerId===r.id);
   check(sr.residentIdentity.personId===i.personId&&sr.bornMonth===u.bornMonth,"saved founder retains permanent identity after twelve months");
   hydrateWorldSave(core,JSON.parse(JSON.stringify(actualSave)));
   const liveTeam=core.teams.find(t=>t.name===created.name)!,person=Dynasty.getCurrentRuler(created.name)!;
   liveTeam.markExtinct(0);Dynasty.markExtinct(liveTeam,0);
   check(person.status==="politically-ended"&&person.deathMonth===undefined,"polity termination is not person death");
   person.naturalDeathYear=12;person.plannedEndYear=12; // Deterministic due-life boundary, not production probability changes.
   Dynasty.update(12,core.teams);
   check(person.status as string==="dead"&&person.deathMonth===12&&!liveTeam.rulerUser,"ended founder's single life expires and cannot be restored");
   results.push({kind,checks,sourceUserId:i.sourceUserId,personId:i.personId,rulerId:r.id,populationBefore:before,populationAfterFounding:before,saveSchemaVersion:19});
  }finally{game.destroy(true);}
 }
 return {seed,scope:"controlled real Core/Phaser production founding and lifecycle",results};
}
