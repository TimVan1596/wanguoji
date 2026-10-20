import {diffCanonicalWorldSave} from "../../Persistence/WorldSaveSchema";
import {renderToStaticMarkup} from "react-dom/server";
import {createNaturalCore} from "./NaturalCoreHarness";
import {SIMULATION_FIXED_STEP_MS} from "../SimulationDriver";
import Military from "../../Politics/MilitaryCommandRegistry";
import WorldHistory from "../../History/WorldHistory";
import worldRandom from "../WorldRandom";
import HistoricalEventArchive from "../../UI/Components/FactionDetails/HistoricalEventArchive";
import PersonArchiveCard from "../../UI/Components/FactionDetails/PersonArchiveCard";
import {getMilitaryArchive} from "../../UI/Components/FactionDetails/MilitaryPeoplePresentation";
import {exportWorldSave} from "../../Persistence/WorldSaveExporter";
import {hydrateWorldSave} from "../../Persistence/WorldSaveHydrator";
import {validateWorldSave} from "../../Persistence/WorldSaveValidator";

/** Programmatic content/performance checks; no screenshots and no visual acceptance claim. */
export async function runCharacterArchivePerformance(seed:string,years=500){
  const {core,game}=await createNaturalCore(seed),results:any[]=[];
  const stepMonth=()=>{for(let n=0;n<30;n++)(core as any).advanceLogicalStep(SIMULATION_FIXED_STEP_MS);core.scene.sys.events.emit("postupdate");};
  try{
    for(let m=1;m<=years*12;m++){
      stepMonth();
      if(m%120===0)await new Promise(r=>setTimeout(r,0));
      if(m!==2400&&m!==years*12)continue;
      const people=Military.getPeople(),events=WorldHistory.getEvents();
      const team=[...core.teams].sort((a,b)=>Military.getPeople().filter(p=>p.appointments.some(x=>x.factionId===b.name)).length-Military.getPeople().filter(p=>p.appointments.some(x=>x.factionId===a.name)).length)[0];
      const archive=getMilitaryArchive(people,team.name,Military.getFormations(),new Set(people.filter(p=>core.teams.some(t=>[...t.users].some(u=>u.matchesMilitaryLife(p)))).map(p=>p.personId)));
      const records=WorldHistory.getEventsForFaction(team.name),rng=JSON.stringify(worldRandom.exportState()),before=performance.now();
      let html="";
      for(let i=0;i<10;i++)html=renderToStaticMarkup(<>
        <HistoricalEventArchive title="真实长局记录" defaultOpen entries={records.map(e=>({id:e.id,content:<p data-event-id={e.id}>{e.title}</p>}))}/>
        {archive.visiblePeople.map(p=><PersonArchiveCard key={p.personId} heading={p.personalName} expanded={false} onSelect={()=>{}}/>)}
      </>);
      const renderMs=(performance.now()-before)/10,node=document.createElement("div");node.innerHTML=html;
      if(node.querySelectorAll("p[data-event-id]").length!==records.length||node.querySelectorAll("button[aria-expanded]").length!==archive.visiblePeople.length||/上一页|下一页|加载更多|查看下一批/.test(html))throw new Error("Archive omitted content or retained pagination");
      if(node.querySelector('[style*="max-height"], [style*="overflow-y"], [style*="overflow: auto"], [style*="overflow: hidden"]'))throw new Error("Character records still contain a nested scrolling or clipped region");
      if(JSON.stringify(worldRandom.exportState())!==rng||events.length!==WorldHistory.getEvents().length)throw new Error("Presentation mutated the world");
      core.setWorldRunning(false);const save=exportWorldSave(core);if(!validateWorldSave(save).valid)throw new Error("Invalid long-world snapshot");
      results.push({month:m,people:people.length,countryPeople:archive.visiblePeople.length,records:records.length,allRecordsPresent:true,noNestedScroll:true,renderMs,htmlBytes:html.length,heapBytes:(performance as any).memory?.usedJSHeapSize,strictSaveValid:true});
      if(m===years*12){
        const continueOnce=()=>{hydrateWorldSave(core,JSON.parse(JSON.stringify(save)));core.setWorldRunning(true);for(let i=0;i<12;i++)stepMonth();core.setWorldRunning(false);return exportWorldSave(core);};
        const a=continueOnce(),b=continueOnce();const diff=diffCanonicalWorldSave(a,b);if(!diff.matched)throw new Error(`Long-world continuation diverged: ${JSON.stringify(diff)}`);
      }else core.setWorldRunning(true);
    }
    return {seed,years,results,deterministic12MonthContinuation:true};
  }finally{game.destroy(true);}
}
