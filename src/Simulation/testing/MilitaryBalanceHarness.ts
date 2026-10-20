import {createNaturalCore} from "./NaturalCoreHarness";
import Military from "../../Politics/MilitaryCommandRegistry";
import {readMilitaryParticipation} from "../../Politics/MilitaryPoliticalInfluence";
import City from "../../Components/City";
import Diplomacy from "../../Politics/Diplomacy";
import WorldHistory from "../../History/WorldHistory";
import {exportWorldSave} from "../../Persistence/WorldSaveExporter";
import {validateWorldSave} from "../../Persistence/WorldSaveValidator";
import {canonicalWorldSaveProjection} from "../../Persistence/WorldSaveSchema";
import {SIMULATION_FIXED_STEP_MS} from "../SimulationDriver";

/** Stable full-world fingerprint, excluding only version label and creation timestamp.
 * Measurement is test-session only and consumes no production randomness. */
async function fingerprint(snapshot: ReturnType<typeof exportWorldSave>) {
  const {appVersion: _version, ...canonical} = canonicalWorldSaveProjection(snapshot);
  const ordered = (value: any): any => Array.isArray(value) ? value.map(ordered) : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().filter(k => value[k] !== undefined).map(k => [k, ordered(value[k])])) : value;
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(ordered(canonical))));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2,"0")).join("");
}

/** Instrument the real City transaction, never substitute combat or its RNG. Test-session aggregates only. */
export async function runMilitaryBalance(seed:string,years=100){
  const {core,game}=await createNaturalCore(seed),started=performance.now();
  const original=(City.prototype as any).updateSiege;
  let siegeCityMonths=0,contactMonth=-1;
  const seen=new Set<string>(),sizeSamples:Record<string,number>={},factionCommandSamples:Record<string,number>={};
  let politicalCandidateChecks=0,activeFormationSamples=0,totalFormationMembers=0;
  (City.prototype as any).updateSiege=function(month:number,...args:unknown[]){
    if(contactMonth!==month){seen.clear();contactMonth=month;}
    if(this.ownerTeam&&[...this.siegeContacts.values()].some((c:any)=>month-c.year<=1&&Diplomacy.canAttack(c.team.name,this.ownerTeam.name,month))&&!seen.has(this.id)){
      seen.add(this.id);siegeCityMonths++;
    }
    return original.call(this,month,...args);
  };
  const checkpoints:any[]=[];
  try{
    for(let m=1;m<=years*12;m++){
      for(let n=0;n<30;n++)(core as any).advanceLogicalStep(SIMULATION_FIXED_STEP_MS);
      core.scene.sys.events.emit("postupdate");
      const formations=Military.getFormations().filter(f=>f.status==="ACTIVE");
      for(const f of formations){sizeSamples[f.memberUnitIds.length]=(sizeSamples[f.memberUnitIds.length]??0)+1;activeFormationSamples++;totalFormationMembers+=f.memberUnitIds.length;}
      for(const t of core.teams.filter(t=>t.status==="ACTIVE")){
        const count=formations.filter(f=>f.factionId===t.name).length;factionCommandSamples[count]=(factionCommandSamples[count]??0)+1;
        if(m%12===0)politicalCandidateChecks+=Military.getPoliticalInfluence(t,m,core.logicalUnitRegistry).candidates.length;
      }
      if(m%1200===0||m===years*12){
        const events=WorldHistory.getEvents(),people=Military.getPeople();
        const captures=events.filter(e=>["city-captured","city-recovered","capital-fallen"].includes(e.type));
        const battles=[...new Map(captures.map(e=>[`${e.monthIndex??e.year}:${e.cityId}:${e.actorFactionId}`,e])).values()];
        const promotions=people.flatMap(p=>p.appointments.flatMap(a=>(a.officeHistory??[]).filter(g=>g.office!=="PIJIANG").map(g=>({office:g.office,waitMonths:g.month-a.startMonth}))));
        const ended=people.flatMap(p=>p.appointments.filter(a=>a.endMonth!==undefined));
        const matureEnded=ended.filter(a=>a.endMonth!-a.startMonth>=60);
        const p=core.getPopulationSummary();
        core.setWorldRunning(false);
        const snapshot=exportWorldSave(core),validation=validateWorldSave(snapshot);
        const canonicalSha256 = await fingerprint(snapshot);
        core.setWorldRunning(true);
        if(!validation.valid)throw new Error(`Invalid natural snapshot: ${validation.errors.join("; ")}`);
        if(p?.unexplainedWorldDifference!==0)throw new Error("Unexplained population difference");
        const count=(type:string)=>events.filter(e=>e.type===type).length;
        checkpoints.push({month:m,worldPopulation:p?.closingWorldPopulation,populationUnexplained:p?.unexplainedWorldDifference,
          naturalGrowth:p?.totals.naturalGrowth,warDeaths:p?.totals.warDeaths,activeStates:core.teams.filter(t=>t.status==="ACTIVE").length,historicalStates:core.teams.length,cities:core.allCities.length,
          captures:battles.length,recoveries:count("city-recovered"),siegeCityMonths,capturesPer100SiegeCityMonths:siegeCityMonths?battles.length/siegeCityMonths*100:0,
          formationSizeSamples:{...sizeSamples},factionCommandSamples:{...factionCommandSamples},meanFormationSize:activeFormationSamples?totalFormationMembers/activeFormationSamples:0,
          appointments:Military.getDiagnostics().appointments,offices:Military.getOfficeSummary(m),promotions,
          meanServiceMonths:Military.getOfficeSummary(m).meanServiceMonths,matureEnded:matureEnded.length,matureEndedNeverPromoted:matureEnded.filter(a=>(a.officeHistory?.length??0)<2).length,
          politicalCandidateChecks,militaryPoliticalEvents:events.filter(e=>readMilitaryParticipation(e)).length,depositions:count("ruler-deposed"),usurpations:count("dynasty-usurped"),
          extinctions:count("faction-extinct"),unifications:count("world-unification"),splits:count("empire-split"),restorations:count("faction-restored"),rebellions:count("rebel-faction-founded"),
          canonicalSha256, worldRandomPosition:snapshot.worldRandom.position,
          regional:(core.simulator as any).events.getRegionalRebellionSnapshot(),
          militaryRoyalOverlap:snapshot.users.filter(u=>u.militaryPersonId&&(u.role==="RULER"||u.rulerId)).length,
          duplicatePopulationIds:snapshot.users.length-new Set(snapshot.users.map(u=>u.userId)).size,
          currentMilitaryByRegime:core.teams.filter(t=>t.status==="ACTIVE").map(t=>({factionId:t.name,factionType:t.factionType,stage:t.identityStage,rank:t.sovereigntyRank,
            population:t.users.size,commands:formations.filter(f=>f.factionId===t.name).length})),
          strictSaveValid:true,elapsedMs:performance.now()-started,heapBytes:(performance as any).memory?.usedJSHeapSize});
      }
      if(m%120===0)await new Promise(r=>setTimeout(r,0));
    }
    return {seed,years,mode:"real Arcade Core / default warring states",denominator:"hostile-contact city-months entering real City.updateSiege; capture frequency, not battle win probability",checkpoints};
  }finally{(City.prototype as any).updateSiege=original;game.destroy(true);}
}
