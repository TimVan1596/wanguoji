import {createNaturalCore} from "./NaturalCoreHarness";
import Military from "../../Politics/MilitaryCommandRegistry";
import {SIMULATION_FIXED_STEP_MS} from "../SimulationDriver";

export async function runMilitaryOfficeCalibration(seed:string,years=200){
  const {core,game}=await createNaturalCore(seed);
  for(let m=1;m<=years*12;m++){
    for(let n=0;n<30;n++)(core as any).advanceLogicalStep(SIMULATION_FIXED_STEP_MS);
    core.scene.sys.events.emit("postupdate");if(m%120===0)await new Promise(r=>setTimeout(r,0));
  }
  const people=Military.getPeople(),month=core.simulator!.year;
  const appointments=people.flatMap(p=>p.appointments.map(a=>{
    const victories=Military.getChronicle(p,month,a.factionId).filter(e=>e.commandId===a.commandId&&e.victory);
    return {personId:p.personId,commandId:a.commandId,serviceMonths:Math.max(0,Math.min(a.endMonth??month,p.deathMonth??month)-a.startMonth),
      victoryMonths:victories.map(e=>e.worldMonth-a.startMonth),captures:victories.length,status:p.status,endReason:a.endReason,
      officeHistory:a.officeHistory,formationSize:Military.getFormation(a.commandId)?.memberUnitIds.length};
  }));
  const result={seed,years,worldMonth:month,people:people.length,naturalDeaths:people.filter(p=>p.deathCause==="NATURAL_DEATH").length,
    offices:Military.getOfficeSummary(month),retired:people.filter(p=>p.status==="RETIRED").length,appointments};
  game.destroy(true);return result;
}
