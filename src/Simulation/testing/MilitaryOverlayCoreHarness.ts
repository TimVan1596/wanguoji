import Phaser from "phaser";
/** Real Core/Phaser business regression, without screenshots or a visual Gate. */
import {createNaturalCore} from "./NaturalCoreHarness";
import Military from "../../Politics/MilitaryCommandRegistry";
import {resolveMilitaryCommandView} from "../../Game/MilitaryCommandOverlay";
import {SIMULATION_FIXED_STEP_MS} from "../SimulationDriver";
import worldRandom from "../WorldRandom";
import {exportWorldSave} from "../../Persistence/WorldSaveExporter";
import {hydrateWorldSave} from "../../Persistence/WorldSaveHydrator";
import {validateWorldSave} from "../../Persistence/WorldSaveValidator";
import Diplomacy from "../../Politics/Diplomacy";
import WorldHistory from "../../History/WorldHistory";
import {composeMilitaryBiography} from "../../Politics/PersonBiography";

export async function runMilitaryOverlayCore(seed="military-overlay-z"){
  const {game,core}=await createNaturalCore(seed),checks:string[]=[];
  const check=(yes:unknown,label:string)=>{if(!yes)throw new Error(label);checks.push(label);};
  const month=()=>{for(let i=0;i<30;i++)(core as any).advanceLogicalStep(SIMULATION_FIXED_STEP_MS);core.scene.sys.events.emit("postupdate");};
  let command:string|undefined;
  for(let m=1;m<=240;m++){
    month();command=Military.getFormations().find(f=>resolveMilitaryCommandView(core,f.commandId)?.target)?.commandId;
    if(command)break;
  }
  if(!command)throw new Error("No natural active formation/target in first 20 years");
  const view=resolveMilitaryCommandView(core,command)!;
  const formation=Military.getFormations().find(f=>f.commandId===command)!;
  const person=Military.getPerson(formation.commanderPersonId)!;
  const rng=JSON.stringify(worldRandom.exportState()),history=WorldHistory.getEvents().length;
  check(core.logicalGameplayAuthority===false,"actual default Arcade Core");
  check(view.members.every(m=>{const e=core.logicalUnitRegistry.getEntry(m.unitId)!;return m.x===e.player!.x&&m.y===e.player!.y;}),"live Player positions and real registry bindings");
  check(view.members.some(m=>{const s=core.logicalUnitRegistry.getEntry(m.unitId)!.state;return Math.hypot(m.x-s.logicalX,m.y-s.logicalY)>1;}),"natural motion diverges from registration snapshot");
  check(core.focusMilitaryFormation(command),"real Core focuses and highlights actual formation");
  check(core.focusMilitaryTargetCity(view.target!.cityId,command),"target focus uses the shared command overlay lifecycle");
  core.showMilitaryCommand(command,true);
  const overlay=(core as any).militaryCommandOverlay,g=overlay.graphics;
  check(g instanceof Phaser.GameObjects.Graphics&&!g.input,"real noninteractive Phaser Graphics");
  for(let i=0;i<120;i++)overlay.update();check(overlay.graphics===g,"one Graphics reused across presentation updates");
  core.logicalGameplayAuthority=true;
  check(resolveMilitaryCommandView(core,command)!.members.every(m=>m.x===core.logicalUnitRegistry.getEntry(m.unitId)!.state.logicalX),"logical-mode coordinate authority");
  core.logicalGameplayAuthority=false;
  const bio=composeMilitaryBiography(person,Military.getChronicle(person,core.simulator!.year,person.factionId),person.factionId);
  check(bio.life.length>0&&Military.getChronicle(person,core.simulator!.year).some(e=>e.source.startsWith("military-appointment")),"real appointment enters biography");
  check(JSON.stringify(worldRandom.exportState())===rng&&WorldHistory.getEvents().length===history,"UI projections preserve RNG and canonical history");
  const target=core.allCities.find(c=>c.id===view.target!.cityId)!;
  // Exercise a real relation transition, not a fake target or substitute battle.
  Diplomacy.setRelation({factionAId:person.factionId,factionBId:target.ownerFactionId,status:"TRUCE",reason:"WAR_EXHAUSTION_TRUCE",startedMonth:core.simulator!.year,expiresMonth:core.simulator!.year+24});
  check(!resolveMilitaryCommandView(core,command)?.target,"real truce removes hostile target");overlay.update();
  core.selectFaction(undefined);check(!overlay.selection,"country selection clears overlay");
  core.setWorldRunning(false);
  core.showMilitaryCommand(command,true);
  const save=exportWorldSave(core);
  check(validateWorldSave(save).valid,"strict V17 real Core export");
  hydrateWorldSave(core,JSON.parse(JSON.stringify(save)));
  check(!overlay.selection&&g.commandBuffer.length===0,"hydration clears selected overlay and drawing");
  check(validateWorldSave(exportWorldSave(core)).valid,"strict V17 real Core hydration");
  check(Military.getPerson(person.personId)?.personalName===person.personalName,"person identity and recorded name survive load");
  core.setWorldRunning(true);for(let m=0;m<12;m++)month();core.setWorldRunning(false);
  check(validateWorldSave(exportWorldSave(core)).valid,"12-month post-load production continuation");
  const result={seed,checks,commandId:command,personId:person.personId,memberCount:view.members.length,worldMonth:core.simulator!.year,saveSchemaVersion:save.saveSchemaVersion};
  game.destroy(true);return result;
}
