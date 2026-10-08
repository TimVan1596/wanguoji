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
import { evaluateSubmissionCandidates } from "./PeacefulSubmissionSystem";
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
