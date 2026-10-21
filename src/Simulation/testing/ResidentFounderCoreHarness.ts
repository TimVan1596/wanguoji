import {CURRENT_SAVE_SCHEMA_VERSION} from "../../Persistence/WorldSaveSchema";
import worldRandom from "../WorldRandom";
import WorldExiles from "../WorldExiles";
import {getRulerHistoricalEvents} from "../../Politics/RulerChronicle";
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

/** Real User/Player, city, founding, royal lifecycle and V21 transactions, not a second simulator. */
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
   const originalMovement=eligible.map(u=>u.player.exportMovementState(u.player.logicalUnitId!));
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
   core.addRuntimeTeam=function(t){register.call(this,t);throw new Error("injected post-registration collider failure");};
   try{check(!create(),"exception after runtime registration rolls back the whole prepared faction");}finally{core.addRuntimeTeam=register;}
   check(core.teams.length===7&&JSON.stringify(Dynasty.exportState())===beforeDynasty,"post-registration rollback removes faction and orphan dynasty");
   check(eligible.every((u,n)=>{const m=u.player.exportMovementState(u.player.logicalUnitId!);return m.speed===originalMovement[n].speed&&m.speedCoefficient===originalMovement[n].speedCoefficient&&m.sizeCoefficient===originalMovement[n].sizeCoefficient&&m.scale===originalMovement[n].scale;}),"failed political promotion does not alter Player speed or size");
   const created=create();check(created,"production founding succeeds");if(!created)throw new Error("No polity");
   const r=Dynasty.getCurrentRuler(created.name)!,i=r.residentIdentity!,u=created.rulerUser!;
   check(Boolean(i)&&eligible.includes(u)&&originalUsers.includes(u)&&u.historicalPersonId===i.personId,"founder is the actual transferred resident and same live object");
   const original=originalMovement[eligible.indexOf(u)];
   check(u.player.logicalUnitId===original.unitId&&u.player.x===original.x&&u.player.y===original.y,"political identity conversion retains the real unit and never teleports the resident");
   check(u.id===i.sourceUserId&&u.name===i.sourceUserLabel&&u.bornMonth===r.bornYear&&r.bornYear===i.bornMonth&&i.sourceFactionId===parent.name,"original numeric ID, label, birth and parent faction are preserved");
   const entry=core.logicalUnitRegistry.getEntry(u.player.logicalUnitId!)!;
   check(u.role==="RULER"&&u.player.role==="RULER"&&entry.state.role==="RULER"&&entry.state.rulerId===r.id,"same real Player and logical unit acquire political role");
   check(core.teams.flatMap(t=>[...t.users]).length===before&&!parent.users.has(u)&&created.users.has(u),"founding conserves world population with no extra royal avatar");
   check(Military.getPeople().every(p=>p.sourceUserId!==u.id),"founder is not duplicated as a military person");
   const save=strict();
   for(const mutate of [(s:any)=>{s.users.find((x:any)=>x.historicalPersonId===i.personId).bornMonth--;},(s:any)=>{s.dynasties.find((d:any)=>d.factionId===created.name).rulers[0].residentIdentity.sourceUserId++;},(s:any)=>{s.users.push({...s.users.find((x:any)=>x.historicalPersonId===i.personId),userId:987654321});}]){const bad=structuredClone(save);mutate(bad);check(!validateWorldSave(bad).valid,"strict V21 rejects broken or duplicate resident identity");}
   check(!validateWorldSave({...save,saveSchemaVersion:19}).valid,"V19 is explicitly unsupported without rewriting the old file");
   // Map detachment/restoration is not biological death; retain real political/city facts.
   created.markExiled(0);Dynasty.markExiled(created,0);
   check(!r.deathMonth&&r.status==="exiled"&&u.isDestroyed&&!created.rulerUser,"exile removes entity without killing the permanent person");
   created.markActive(0);Dynasty.markRestored(created,0,city.name);
   const restored=created.rulerUser!;
   check(restored!==u&&restored.id===u.id&&restored.historicalPersonId===i.personId&&restored.bornMonth===u.bornMonth&&r.id===restored.rulerId,"restoration recreates only the same person's map entity");
   check(core.teams.flatMap(t=>[...t.users]).filter(x=>x.historicalPersonId===i.personId).length===1,"restoration has one live binding");
   const actualSave=strict();
   // Controlled severe-siege boundary uses the real User -> royal death gate -> succession path.
   for(const c of created.cities)c.loyalty=0;
   created.capitalCity!.underSiege=true;
   check(restored.destroyUser(false,{cause:"BATTLE_DEATH",month:0}),"resident founder can actually die through the severe-crisis battle gate");
   check(r.deathMonth===0&&r.deathReason==="战死"&&Dynasty.getCurrentRuler(created.name)?.id!==r.id,"battle death is recorded separately from lifespan and causes one real succession");
   Dynasty.recordResidentEntityDeath(i.personId,0);
   check(History.getEvents().filter(e=>e.type==="ruler-succession"&&e.metadata?.previousRulerId===r.id&&e.metadata?.reason==="combat").length===1&&!created.users.has(restored),"duplicate death notification cannot kill or succeed the same founder twice");
   const resume=()=>{hydrateWorldSave(core,JSON.parse(JSON.stringify(actualSave)));core.setWorldRunning(true);for(let m=0;m<12;m++)step();core.setWorldRunning(false);return strict();};
   const first=resume(),second=resume();
   check(diffCanonicalWorldSave(first,second).matched,"two V21 hydrations continue identically for twelve production months");
   const sr=(second.dynasties.find(d=>d.factionId===created.name)!.rulers as any[]).find(x=>x.rulerId===r.id);
   check(sr.residentIdentity.personId===i.personId&&sr.bornMonth===u.bornMonth,"saved founder retains permanent identity after twelve months");
   hydrateWorldSave(core,JSON.parse(JSON.stringify(first)));
   check(diffCanonicalWorldSave(first,strict()).matched,"a second-generation V21 save reads again without identity or life changes");
   if(kind==="popular"){
     hydrateWorldSave(core,JSON.parse(JSON.stringify(actualSave)));
     const polity=core.teams.find(t=>t.name===created.name)!,oldParent=core.teams.find(t=>t.name===parent.name)!,town=polity.cities[0],firstKing=Dynasty.getCurrentRuler(polity.name)!;
     polity.formState("验邦",0);
     for(const member of polity.users)member.loyalty=100;
     const next=worldRandom.next;worldRandom.next=()=>0;
     try{
       town.capture(oldParent,0);check(polity.status==="EXILED","real final-city capture creates the first exile episode");
       (core.simulator as any).clock.importState({worldMonth:120,elapsedMs:0,running:false});
       firstKing.naturalDeathYear=120;firstKing.plannedEndYear=120;Dynasty.update(120,core.teams);
       const successor=Dynasty.getCurrentRuler(polity.name)!;check(successor.id!==firstKing.id&&successor.status==="exiled","a second monarch really succeeds during long exile");
       (core.simulator as any).clock.importState({worldMonth:156,elapsedMs:0,running:false});
       town.capture(polity,156);
       check(polity.status as string==="ACTIVE"&&successor.status as string==="ruling"&&!WorldExiles.get(polity.name),"actual recapture restores polity, royal role and exile registry together");
       // The restored successor has its own genuine population loyalty; require a remnant for this second exile scenario.
       for(const member of polity.users)member.loyalty=100;
       (core.simulator as any).clock.importState({worldMonth:163,elapsedMs:0,running:false});
       town.capture(oldParent,163);
       const rows=History.getEventsForFaction(polity.name),exiles=rows.filter(e=>e.type==="faction-exiled"),restores=rows.filter(e=>e.type==="faction-restored");
       check(exiles.length===2&&restores.length===1&&restores[0].year===156&&restores[0].metadata?.restorationTrigger==="MILITARY_RECAPTURE","two real losses have a recorded intervening military restoration");
       check(Boolean(rows.find(e=>e.id===restores[0].metadata?.captureEventId&&e.cityId===town.id&&e.actorFactionId===polity.name)),"military restoration references its actual capture event");
       core.handleFactionExtinction(polity,oldParent,town,164);
       check(History.getEventsForFaction(polity.name).filter(e=>e.type==="faction-exiled").length===2,"repeated collapse notification during one exile is a no-op");
       const selected=getRulerHistoricalEvents(rows,{...successor,accessionYear:successor.accessionYear!},polity.name,164,[],8);
       check(selected.some(e=>e.type==="faction-restored")&&firstKing.deathMonth===120&&successor.deathMonth===undefined,"successor chronicle retains restoration without confusing predecessor death or accession");
     }finally{worldRandom.next=next;}
   }
   hydrateWorldSave(core,JSON.parse(JSON.stringify(actualSave)));
   const liveTeam=core.teams.find(t=>t.name===created.name)!,person=Dynasty.getCurrentRuler(created.name)!;
   liveTeam.markExtinct(0);Dynasty.markExtinct(liveTeam,0);
   check(person.status==="politically-ended"&&person.deathMonth===undefined,"polity termination is not person death");
   const scheduled=person.naturalDeathYear!;
   Dynasty.update(scheduled-1,core.teams);
   check(person.deathMonth===undefined,"actual frozen resident lifespan remains alive before its due month");
   Dynasty.update(scheduled,core.teams);
   check(person.status as string==="dead"&&person.deathMonth===scheduled&&!liveTeam.rulerUser,"ended founder's actual sampled life expires once and cannot be restored");
   results.push({kind,checks,sourceUserId:i.sourceUserId,personId:i.personId,rulerId:r.id,populationBefore:before,populationAfterFounding:before,saveSchemaVersion:CURRENT_SAVE_SCHEMA_VERSION});
  }finally{game.destroy(true);(game as any).runDestroy?.();}
 }
 return {seed,scope:"controlled real Core/Phaser production founding and lifecycle",results};
}
