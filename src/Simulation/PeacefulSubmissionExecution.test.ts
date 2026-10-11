import AutoSimulator from "./AutoSimulator";
import WorldEra from "./WorldEra";
import WorldExiles from "./WorldExiles";
import FactionSnapshots from "./FactionSnapshots";
import { WORLD_MONTH_MS } from "../config/simulation";
import FactionLifetimeRecords from "./FactionLifetimeRecord";
import { afterEach, describe, expect, it, vi } from "vitest";
const { game }=vi.hoisted(()=>({game:{Core:{teams:[] as any[],releaseTerminalTeamColliders:vi.fn()},BlockSize:32}}));
vi.mock("../Game/Game",()=>({default:game}));
vi.mock("../Components/Team",()=>({default:class {}}));
vi.mock("../Components/Block",()=>({default:class {}}));
vi.mock("../Components/Player",()=>({default:class {}}));
vi.mock("../Components/User",()=>({default:class {}}));
vi.mock("../Components/Farms",()=>({default:class {}}));
vi.mock("../Components/City",()=>({default:class {},getFactionStability:()=>40}));
import DynastyRegistry from "../Politics/Dynasty";
import Diplomacy from "../Politics/Diplomacy";
import WorldHistory from "../History/WorldHistory";
import { executePeacefulSubmission } from "./PeacefulSubmissionExecution";
import { PeacefulSubmissionSystem, evaluateSubmissionCandidates } from "./PeacefulSubmissionSystem";
import worldRandom from "./WorldRandom";
import type Team from "../Components/Team";

afterEach(()=>{FactionLifetimeRecords.reset();DynastyRegistry.reset();Diplomacy.reset();WorldHistory.reset();vi.restoreAllMocks();});
async function fixture() {
  const {default:RealTeam}=await vi.importActual<typeof import("../Components/Team")>("../Components/Team");
  const teams=["weak","strong","other"].map((name,index)=>Object.assign(Object.create(RealTeam.prototype),{
    name,displayName:name,status:"ACTIVE",identityStage:"STATE",origin:{type:"INITIAL"},currentActiveSinceYear:0,cumulativeActiveYears:0,restorationYears:[],users:new Set(),farms:{setDie:vi.fn()},cities:[{loyalty:40}],blocks:{children:{size:index===0?3:index===1?30:67,entries:[]}},
  }));
  FactionLifetimeRecords.observeWorld(0, teams, 100);
  const [weak,strong]=teams;
  weak.blocks.children.entries=[0,1,2].map((i)=>({x:i===0?32:1000+i*100,y:0,team:weak,claimForTeam(team:any){this.team=team;weak.blocks.children.entries=weak.blocks.children.entries.filter((b:any)=>b!==this);strong.blocks.children.entries.push(this);}}));
  strong.blocks.children.entries=[{x:0,y:0}];
  weak.cities[0]={loyalty:40,administrativeMergeTransferTo:vi.fn((target:any,_month:number,reason:string)=>{expect(reason).toBe("SUBMITTED");const city=weak.cities[0];weak.cities=[];target.cities.push(city);city.ownerFactionId=target.name;return true;})};
  const user:any={role:"RULER",rulerId:"weak-r",player:{setRole:vi.fn()},setTeam:vi.fn((target:any,ctx:any)=>{expect(ctx.cause).toBe("FACTION_SUBMISSION");weak.users.delete(user);target.users.add(user);user.team=target;})};weak.users.add(user);
  DynastyRegistry.importState({sequence:10,dynasties:[{factionId:"weak",houseName:"陈氏",currentRulerId:"weak-r",heirIds:["heir"],designatedHeirId:"heir",houseEpochs:[],rulers:[{id:"weak-r",houseName:"陈氏",givenName:"平",bornYear:0,accessionYear:0,status:"ruling"},{id:"heir",houseName:"陈氏",givenName:"继",bornYear:60,status:"heir",parentId:"weak-r"}]},{factionId:"strong",houseName:"贺氏",currentRulerId:"strong-r",heirIds:[],houseEpochs:[],rulers:[{id:"strong-r",houseName:"贺氏",givenName:"成",bornYear:0,accessionYear:0,status:"ruling"}]}]} as any);
  game.Core.teams=teams;
  Diplomacy.setRelation({factionAId:"strong",factionBId:"weak",status:"ALLIANCE",reason:"COMMON_THREAT_ALLIANCE",startedMonth:0,originalStartedMonth:0,expiresMonth:240,renewalCount:2});
  const candidate=evaluateSubmissionCandidates({teams:teams as Team[],relations:Diplomacy.list(120),worldMonth:120,totalCells:100,blockSize:32,recentEvents:[]}).find(r=>r.candidate)?.candidate!;
  return {weak,strong,user,candidate};
}
describe("actual submission orchestration and canonical terminal offices",()=>{
  it("actual AutoSimulator executes union before submission with identical canonical results when observations are toggled",async()=>{
    const run=async(enabled:boolean,sameOrigin:boolean)=>{
      vi.restoreAllMocks();WorldHistory.reset();Diplomacy.reset();DynastyRegistry.reset();FactionLifetimeRecords.reset(100);
      worldRandom.initialize("transition-runtime-order");
      const {weak,strong,user}=await fixture();
      user.setTeam=(target:any,context:any)=>{expect(context.cause).toBe(sameOrigin?"FACTION_MERGER":"FACTION_SUBMISSION");weak.users.delete(user);target.users.add(user);user.team=target;};
      if(sameOrigin) {weak.origin={type:"SPLIT",parentFactionId:strong.name};}
      const sim=new AutoSimulator(enabled), runtime=sim as any;
      runtime.started=true;runtime.running=true;runtime.clock.importState({worldMonth:119,elapsedMs:0,running:true});
      runtime.unionObservations.reset(119);runtime.submission.reset(119);
      // Only spatial/economic/monthly succession adapters are omitted, never diplomacy or terminal execution.
      vi.spyOn(runtime.events,"update").mockImplementation(()=>undefined);
      vi.spyOn(runtime.events,"observeWorldGoal").mockImplementation(()=>undefined);
      vi.spyOn(runtime.events,"getCurrentPhase").mockReturnValue("FRAGMENTED");
      vi.spyOn(runtime.population,"update").mockImplementation(()=>undefined);
      vi.spyOn(WorldEra,"observe").mockImplementation(()=>undefined);
      vi.spyOn(WorldExiles,"update").mockImplementation(()=>undefined);
      vi.spyOn(DynastyRegistry,"update").mockImplementation(()=>undefined);
      vi.spyOn(FactionSnapshots,"observe").mockImplementation(()=>undefined);
      vi.spyOn(WorldHistory,"observeWorld").mockImplementation(()=>undefined);
      vi.spyOn(runtime.populationTransitionAudit,"reconcile").mockImplementation(()=>undefined);
      for(const t of game.Core.teams)for(const c of t.cities)c.updateDefense=()=>{};
      // The adapter transfers real administrative ownership; union uses the same method with no SUBMITTED argument.
      weak.cities[0].administrativeMergeTransferTo=(target:any)=>{const c=weak.cities.shift();target.cities.push(c);return true;};
      const trace:string[]=[];
      const merge=runtime.mergeFaction.bind(sim);
      vi.spyOn(runtime,"mergeFaction").mockImplementation((...args:unknown[])=>{trace.push("union");return merge(...args);});
      const submission=runtime.submission.update.bind(runtime.submission);
      vi.spyOn(runtime.submission,"update").mockImplementation((...args:unknown[])=>{trace.push("submission");return submission(...args);});
      sim.update(WORLD_MONTH_MS,game.Core.teams,100);
      const diagnostic=sim.getPeacefulPoliticalTransitionDiagnostics();
      const result={history:WorldHistory.exportState(),dynasty:DynastyRegistry.exportState(),diplomacy:Diplomacy.exportState(),
        rng:worldRandom.exportState(),terminal:weak.terminationReason,trace};
      if(enabled){
        const chosen=sameOrigin?diagnostic.strategicUnion:diagnostic.peacefulSubmission;
        expect(chosen.sessionCumulative).toMatchObject({observedWorldMonths:1,evaluationTicks:1,selectedAttempts:1,successfulTransitions:1,executionFailures:0});
        expect(diagnostic.retainedCanonicalHistory[sameOrigin?"mergedEvents":"submittedEvents"]).toBe(1);
        expect(diagnostic.strategicUnion.sessionCumulative.extra.allNationalPairs).toBe(3);
        if(sameOrigin)expect(diagnostic.peacefulSubmission.sessionCumulative.fullyEligibleChecks).toBe(0);
      }
      expect(weak.terminationReason).toBe(sameOrigin?"MERGED":"SUBMITTED");
      expect(trace).toEqual(sameOrigin?["union","submission"]:["submission"]);
      expect(strong.cities).toHaveLength(2);
      return result;
    };
    for(const sameOrigin of [false,true])expect(await run(true,sameOrigin)).toEqual(await run(false,sameOrigin));
  });
  it("counts retained canonical transitions once per history change without replaying old eligibility",async()=>{
    await fixture();const sim=new AutoSimulator(true);
    for(let m=0;m<20000;m++)WorldHistory.addEvent({id:`background-${m}`,year:m,category:"war",type:"city-captured",title:"",importance:"normal"});
    WorldHistory.addEvent({id:"old-merge",year:20000,category:"politics",type:"faction-merged",title:"",importance:"major"});
    const state=sim.exportState();sim.importState({...state,clock:{...state.clock,worldMonth:24000}},game.Core.teams);
    const rng=worldRandom.exportState(),history=WorldHistory.exportState(),query=vi.spyOn(WorldHistory,"getEventWindow");
    const first=sim.getPeacefulPoliticalTransitionDiagnostics();const calls=query.mock.calls.length;
    expect(first.retainedCanonicalHistory).toMatchObject({submittedEvents:0,mergedEvents:1,frequencyPer100Years:null});
    expect(first.peacefulSubmission).toMatchObject({sessionStartMonth:24000,sessionCumulative:{pairChecks:0,observedWorldMonths:0}});
    expect(sim.getPeacefulPoliticalTransitionDiagnostics()).toEqual(first);expect(query).toHaveBeenCalledTimes(calls);
    expect(WorldHistory.exportState()).toEqual(history);expect(worldRandom.exportState()).toEqual(rng);
    WorldHistory.addEvent({id:"old-submission",year:21000,category:"politics",type:"faction-submitted",title:"",importance:"major"});
    expect(sim.getPeacefulPoliticalTransitionDiagnostics().retainedCanonicalHistory.submittedEvents).toBe(1);
  });
  it("records actual execution guard failure without a success or canonical terminal event",async()=>{
    const {candidate,strong}=await fixture(),system=new PeacefulSubmissionSystem(true);
    system.update({teams:game.Core.teams,relations:Diplomacy.list(120),worldMonth:120,totalCells:100,blockSize:32,recentEvents:[]}, c=>{
      expect(c.evidence).toEqual(candidate.evidence);
      strong.status="EXILED";return executePeacefulSubmission(c,120);
    });
    expect(system.observations.snapshot(120).sessionCumulative).toMatchObject({selectedAttempts:1,successfulTransitions:0,
      executionFailures:1,failureCounts:{FACTION_NOT_ACTIVE:1}});
    expect(WorldHistory.getEvents()).toHaveLength(0);
  });
  it("transfers administratively, retires without death, preserves heirs/kin and cleans diplomacy",async()=>{
    const {weak,strong,user,candidate}=await fixture(),rng=worldRandom.exportState();
    expect(executePeacefulSubmission(candidate,120)).toBe(true);
    expect(weak).toMatchObject({status:"EXTINCT",terminationReason:"SUBMITTED",terminationTargetFactionId:"strong",terminationMonth:120,rulerUser:undefined});
    expect(FactionLifetimeRecords.get("weak")!.terminal).toMatchObject({month:120,population:1,territoryBlocks:3,cityCount:1});
    expect(FactionLifetimeRecords.get("weak")!.peakPopulation.value).toBe(1);
    expect(weak.cities).toHaveLength(0);expect(strong.cities).toHaveLength(2);expect(weak.blocks.children.entries).toHaveLength(0);expect(strong.blocks.children.entries.slice(1).every((b:any)=>b.team===strong)).toBe(true);
    expect(weak.users.size).toBe(0);expect(strong.users.has(user)).toBe(true);expect(user).toMatchObject({role:"NORMAL",rulerId:undefined});
    expect(DynastyRegistry.get("weak")).toMatchObject({currentRulerId:null,heirIds:[],designatedHeirId:undefined});
    expect(DynastyRegistry.get("weak")!.rulers[0]).toMatchObject({status:"abdicated",politicalEndYear:120,endYear:120,endReason:"纳土退位"});
    expect(DynastyRegistry.get("weak")!.rulers[1]).toMatchObject({status:"kin",parentId:"weak-r"});
    expect(DynastyRegistry.get("strong")!.rulers[0]).toMatchObject({status:"ruling"});expect(DynastyRegistry.get("strong")!.rulers).toHaveLength(1);
    expect(Diplomacy.list()).toEqual([]);expect(Diplomacy.exportState().pairMemories).toEqual([]);
    expect(WorldHistory.getEvents().map(e=>e.type)).toEqual(["faction-submitted"]);
    expect(WorldHistory.getEvents()[0].metadata).toMatchObject({submittedFactionId:"weak",receivingFactionId:"strong",month:120,relationStatus:"ALLIANCE",continuousRelationMonths:120,renewalCount:2,submittedRulerId:"weak-r",receivingRulerId:"strong-r"});
    expect(WorldHistory.getEvents()[0].metadata?.commonThreatFactionId).toBeUndefined();
    expect(weak.farms.setDie).toHaveBeenCalledTimes(1);expect(game.Core.releaseTerminalTeamColliders).toHaveBeenCalledWith(weak);
    expect(executePeacefulSubmission(candidate,120)).toBe(false);expect(WorldHistory.getEvents()).toHaveLength(1);expect(worldRandom.exportState()).toEqual(rng);
  });
  it("the unchanged same-origin terminal operation remains MERGED with its independent reason",async()=>{
    const {weak}=await fixture();DynastyRegistry.markMerged(weak,120);weak.markMerged(120,"strong");
    expect(weak).toMatchObject({terminationReason:"MERGED",terminationTargetFactionId:"strong",terminationMonth:120});
    expect(DynastyRegistry.get("weak")!.rulers[0]).toMatchObject({status:"abdicated",endReason:"合邦退位"});
  });
});
