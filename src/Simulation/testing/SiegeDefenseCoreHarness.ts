import {createNaturalCore} from "./NaturalCoreHarness";
import {SIMULATION_FIXED_STEP_MS} from "../SimulationDriver";
import {getVerifiedLocalCasualtyUsers} from "../PopulationCasualtyGeography";
import {exportWorldSave} from "../../Persistence/WorldSaveExporter";
import {hydrateWorldSave} from "../../Persistence/WorldSaveHydrator";
import {validateWorldSave} from "../../Persistence/WorldSaveValidator";
import {diffCanonicalWorldSave} from "../../Persistence/WorldSaveSchema";
import Diplomacy, {DiplomacySystem} from "../../Politics/Diplomacy";
import {CITY_CAPTURED_DEFENSE_RATIO} from "../../config/simulation";

/** Controlled scenarios on real Player/body, registry, City and mortality paths.
 * These checks are not natural battle frequencies or visual acceptance. */
export async function runSiegeDefenseCore(seed="siege-defense-z9") {
  const {core,game}=await createNaturalCore(seed),checks:string[]=[];
  const check=(condition:unknown,label:string)=>{if(!condition)throw new Error(label);checks.push(label);};
  const step=()=>{for(let n=0;n<30;n++)(core as any).advanceLogicalStep(SIMULATION_FIXED_STEP_MS);core.scene.sys.events.emit("postupdate");};
  const strict=()=>{const save=exportWorldSave(core),v=validateWorldSave(save);if(!v.valid)throw new Error(v.errors.join("; "));return save;};
  try {
    for(let n=0;n<12;n++)step();
    core.setWorldRunning(false);
    const base=strict();
    for(const logical of [false,true]) {
      hydrateWorldSave(core,structuredClone(base));core.logicalGameplayAuthority=logical;
      const month=core.simulator!.year;
      const owner=core.teams.find(t=>t.cities.length>0&&t.users.size>3)!;
      const city=owner.cities[0],attacker=core.teams.find(t=>t!==owner&&t.status==="ACTIVE")!;
      const units=[...owner.users];
      const place=(u:typeof units[number],x:number,y:number)=>{
        u.player.setPosition(x,y);(u.player.body as Phaser.Physics.Arcade.Body).reset(x,y);
        const s=core.logicalUnitRegistry.getEntry(u.player.logicalUnitId!)!.state;s.logicalX=x;s.logicalY=y;
      };
      for(const u of units)place(u,-1024,-1024);
      const population=owner.users.size;
      check(getVerifiedLocalCasualtyUsers(owner,city.id,core,32).size===0,`${logical}: distant population is not local`);
      check(!owner.removeOneUser("SIEGE_LOSS",{month,damageSource:"CITY_SIEGE",triggerCityId:city.id}),`${logical}: no local victim means no distant death`);
      check(owner.users.size===population,`${logical}: empty battlefield conserves population`);
      const resident=units.find(u=>u.role==="NORMAL"&&!u.isDestroyed)!;
      place(resident,city.block.x,city.block.y);
      check(getVerifiedLocalCasualtyUsers(owner,city.id,core,32).has(resident),`${logical}: real bound local resident qualifies`);
      const killed=owner.removeOneUser("SIEGE_LOSS",{month,damageSource:"CITY_SIEGE",triggerCityId:city.id});
      check(killed===resident&&owner.users.size===population-1,`${logical}: local death occurs once; empty attempt did not consume cooldown`);
      check(!owner.removeOneUser("SIEGE_LOSS",{month,damageSource:"CITY_SIEGE",triggerCityId:city.id}),`${logical}: same person cannot die twice`);
      // Reset the real world before ownership scenarios; no synthetic state is saved.
      hydrateWorldSave(core,structuredClone(base));core.logicalGameplayAuthority=logical;
      const target=core.allCities.find(c=>!c.destroyed&&c.ownerTeam&&c.ownerFactionId!==attacker.name)!;
      const enemy=core.teams.find(t=>t.name===attacker.name)!;
      target.capture(enemy,month);
      check(target.ownerTeam===enemy&&target.defense===Math.max(1,Math.floor(target.maxDefense*CITY_CAPTURED_DEFENSE_RATIO)),`${logical}: real capture grants only the configured wall buffer`);
      const defense=target.defense;
      for(let n=0;n<100;n++)target.registerSiegeContact(core.teams.find(t=>t!==enemy&&t.status==="ACTIVE")!,month);
      check((target as any).siegeContacts.size===0&&target.defense===defense,`${logical}: existing capture grace neither stacks contacts nor resets walls`);
      // Return to a mature untouched city to exercise actual contact settlement and treaty cleanup.
      hydrateWorldSave(core,structuredClone(base));core.logicalGameplayAuthority=logical;
      const mature=core.allCities.find(c=>!c.destroyed&&c.ownerTeam&&!c.isInCaptureGrace(month))!;
      const assault=core.teams.find(t=>t!==mature.ownerTeam&&t.status==="ACTIVE"&&Diplomacy.canAttack(t.name,mature.ownerFactionId,month))!;
      const deploy=(city:typeof mature,team:typeof assault)=>{
        for(const t of core.teams)for(const u of t.users)place(u,-1024,-1024);
        for(const u of [...team.users].sort((a,b)=>Number(a.role==='RULER')-Number(b.role==='RULER')).slice(0,4))place(u,city.block.x,city.block.y);
      };deploy(mature,assault);
      const wall=mature.defense;mature.registerSiegeContact(assault,month);(mature as any).updateSiege(month);
      check(mature.underSiege&&mature.defense<wall,`${logical}: continued real siege remains capable of damaging walls`);
      mature.registerSiegeContact(assault,month);
      const diplomacy=new DiplomacySystem(Diplomacy,()=>core.allCities,()=>{});
      (diplomacy as any).form(assault,mature.ownerTeam,"TRUCE",month,{reason:"WAR_EXHAUSTION_TRUCE",recentBilateralCaptureCount:1,stabilityA:10,stabilityB:10});
      check(!mature.underSiege&&!(mature as any).siegeContacts.has(assault.name),`${logical}: actual diplomatic truce clears siege`);
      hydrateWorldSave(core,structuredClone(base));core.logicalGameplayAuthority=logical;
      const breach=core.allCities.find(c=>!c.destroyed&&c.ownerTeam&&!c.isInCaptureGrace(month))!;
      const victor=core.teams.find(t=>t!==breach.ownerTeam&&t.status==="ACTIVE"&&Diplomacy.canAttack(t.name,breach.ownerFactionId,month))!;
      deploy(breach,victor);
      const count=breach.captureCount;breach.defense=1;(breach as any).lastSiegeDamageYear=-1;
      breach.registerSiegeContact(victor,month);(breach as any).updateSiege(month);
      check(breach.ownerTeam===victor&&breach.captureCount===count+1,`${logical}: actual siege breach still captures a city exactly once`);
    }
    hydrateWorldSave(core,structuredClone(base));
    const resume=()=>{hydrateWorldSave(core,structuredClone(base));core.setWorldRunning(true);for(let n=0;n<12;n++)step();core.setWorldRunning(false);return strict();};
    const a=resume(),b=resume();check(diffCanonicalWorldSave(a,b).matched,"twelve real months resume deterministically");
    hydrateWorldSave(core,structuredClone(a));check(diffCanonicalWorldSave(a,strict()).matched,"second save can be loaded without canonical changes");
    return {seed,checks,saveSchemaVersion:base.saveSchemaVersion,deterministic12MonthContinuation:true};
  } finally {game.destroy(true);}
}
