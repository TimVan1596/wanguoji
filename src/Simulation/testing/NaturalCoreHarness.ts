// Nonvisual production execution, never a replacement for the user's Chrome Gate.
import Phaser from "phaser";
import Game from "../../Game/Game";
import PreloadScene from "../../Scenes/PreloadScene";
import MainScene from "../../Scenes/MainScene";
import {store} from "../../store";
import {applyScenario} from "../../store/configSlice";
import {warringStatesScenario,scenarioToTeams,scenarioToInitialPopulations} from "../../Scenarios";
import worldRandom from "../WorldRandom";
import WorldHistory from "../../History/WorldHistory";
import {SIMULATION_FIXED_STEP_MS} from "../SimulationDriver";
import {installPhaser355InputCompatibility} from "../../Runtime/Phaser355InputCompatibility";
import Player from "../../Components/Player";

export async function createNaturalCore(seed:string){
  store.dispatch(applyScenario({name:warringStatesScenario.name,teams:scenarioToTeams(warringStatesScenario)}));
  worldRandom.initialize(seed);
  installPhaser355InputCompatibility(Phaser.VERSION,Phaser.Input.InputPlugin.prototype);
  const game=new Game({type:Phaser.CANVAS,width:1120,height:1120,parent:document.body,scene:[PreloadScene,MainScene],
    audio:{noAudio:true},physics:{default:"arcade",arcade:{}}});
  for(let i=0;!Game.Core?.simulator&&i<500;i++)await new Promise(r=>setTimeout(r,20));
  const core=Game.Core;if(!core?.simulator)throw new Error("Core initialization timed out");
  game.loop.stop();core.startWorld(scenarioToInitialPopulations(warringStatesScenario));core.setWorldRunning(true);
  return {game,core};
}

export async function runNaturalCore(seed:string,years=100){
  const {game,core}=await createNaturalCore(seed);
  const started=performance.now(),checkpoints:any[]=[];
  // The same 30Hz Core step used by foreground/catch-up, with real Arcade Player/body/colliders.
  for(let m=1;m<=years*12;m++){
    for(let step=0;step<30;step++)(core as any).advanceLogicalStep(SIMULATION_FIXED_STEP_MS);
    core.scene.sys.events.emit("postupdate"); // quiescent disposal boundary, no render or screenshot
    if(m%600===0||m===years*12){
      const state=core.simulator!.exportState(),counts=(core.simulator as any).events.getRegionalRebellionSnapshot();
      const users=core.teams.flatMap(t=>[...t.users]),positions={realPlayers:0,movedFromRegistry:0,validBindings:0};
      for(const u of users){const player=u.player,entry=player.logicalUnitId?core.logicalUnitRegistry.getEntry(player.logicalUnitId):undefined;
        if(player instanceof Player)positions.realPlayers++;
        if(entry?.player===player&&entry.state.userId===u.id&&entry.state.factionId===u.team.name)positions.validBindings++;
        if(entry&&Math.hypot(player.x-entry.state.logicalX,player.y-entry.state.logicalY)>Game.BlockSize)positions.movedFromRegistry++;
      }
      if(state.clock.worldMonth!==m||positions.realPlayers!==users.length||positions.validBindings!==users.length)throw new Error("Natural Core clock/Player/registry identity mismatch");
      const p=core.getPopulationSummary();checkpoints.push({month:state.clock.worldMonth,historical:core.teams.length,positions,
        active:core.teams.filter(t=>t.status==="ACTIVE").length,cities:core.allCities.length,population:p?.closingWorldPopulation,
        populationUnexplained:p?.unexplainedWorldDifference,natural:p?.totals.naturalGrowth,warDeaths:p?.totals.warDeaths,
        regional:counts,events:WorldHistory.getEvents().filter(e=>["rebel-faction-founded","frontier-faction-founded","empire-split"].includes(e.type)).map(e=>({id:e.id,type:e.type,month:e.monthIndex??e.year})),
        elapsedMs:performance.now()-started});
    }
    if(m%120===0)await new Promise(r=>setTimeout(r,0));
  }
  const result={seed,years,defaultScenario:"warring-states",logicalGameplayAuthority:core.logicalGameplayAuthority,checkpoints};
  game.destroy(true);return result;
}
