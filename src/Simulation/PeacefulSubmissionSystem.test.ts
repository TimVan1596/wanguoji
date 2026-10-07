import { describe, expect, it } from "vitest";
import type Team from "../Components/Team";
import type { DiplomaticRelation } from "../Politics/Diplomacy";
import { evaluateSubmissionCandidates, getSubmissionBlockers, PeacefulSubmissionSystem, rankSubmissionCandidates, type SubmissionEvidence, type SubmissionInput } from "./PeacefulSubmissionSystem";
import { findStrategicUnionCandidate } from "./StrategicUnionSystem";
import worldRandom from "./WorldRandom";
function team(name:string,count:number,x:number,stability=40,parent=""):Team {
  const entries=Array.from({length:count},(_,i)=>({x:i===0?x:1000+i*100,y:0}));
  return {name,displayName:name,status:"ACTIVE",identityStage:"STATE",isDie:false,origin:{type:parent?"SPLIT":"INITIAL",parentFactionId:parent||undefined},blocks:{children:{entries,size:count}},cities:[{loyalty:stability}]} as unknown as Team;
}
const relation:DiplomaticRelation={factionAId:"strong",factionBId:"weak",status:"ALLIANCE",originalStartedMonth:0,startedMonth:60,expiresMonth:500,renewalCount:2,reason:"COMMON_THREAT_ALLIANCE"};
function fixture():SubmissionInput {return {teams:[team("strong",30,0),team("weak",3,32),team("other",67,99999)],relations:[{...relation}],totalCells:100,worldMonth:120,recentEvents:[],blockSize:32};}
function evidence():SubmissionEvidence {return evaluateSubmissionCandidates(fixture()).find(r=>r.evidence.submittedFactionId === "weak" && r.evidence.receivingFactionId === "strong")!.evidence;}
describe("Peaceful Submission hard gates and deterministic annual evaluation",()=>{
  it.each([
    ["SAME_ORIGIN_USES_STRATEGIC_UNION",{sameOrigin:true}], ["NOT_FORMAL_STATE",{bothFormal:false}],
    ["NO_DURABLE_RELATION",{relationStatus:undefined}], ["NO_DURABLE_RELATION",{relationStatus:"TRUCE"}],
    ["RELATION_TOO_SHORT",{continuousRelationMonths:59}], ["RELATION_TOO_SHORT",{relationStatus:"NON_AGGRESSION",continuousRelationMonths:95}],
    ["NOT_ADJACENT",{adjacent:false}], ["RECENT_BILATERAL_WAR",{bilateralWarFreeMonths:59}],
    ["STRONGER_TOO_WEAK",{receivingTerritoryShare:15}], ["WEAKER_TOO_LARGE",{submittedCityCount:2}],
    ["WEAKER_TOO_LARGE",{submittedTerritoryShare:9}], ["POWER_GAP_TOO_SMALL",{submittedTerritoryShare:8,receivingTerritoryShare:25}],
    ["STABILITY_TOO_HIGH",{submittedStability:56}],
  ] as const)("blocks %s from recorded facts",(blocker,change)=>{
    expect(getSubmissionBlockers({...evidence(),...change} as SubmissionEvidence)).toContain(blocker);
  });
  it("allows an extreme one-city unrelated peaceful pair with durable NAP or Alliance",()=>{
    for(const status of ["ALLIANCE","NON_AGGRESSION"] as const) {
      const input=fixture();input.relations[0].status=status;
      const result=evaluateSubmissionCandidates(input).find(r=>r.evidence.submittedFactionId === "weak"&&r.evidence.receivingFactionId === "strong")!;expect(result.blockers).toEqual([]);
      expect(result.candidate?.path).toBe("ASYMMETRIC_PEACEFUL_RELATION");
      expect(result.evidence).toMatchObject({continuousRelationMonths:120,bilateralWarFreeMonths:60,submittedTerritoryShare:3,receivingTerritoryShare:30});
    }
  });
  it("rejects neutral, provisional, expired, nonadjacent and recent actual bilateral capture",()=>{
    const neutral=fixture();neutral.relations=[];expect(evaluateSubmissionCandidates(neutral).find(r=>r.evidence.submittedFactionId === "weak"&&r.evidence.receivingFactionId === "strong")!.blockers).toContain("NO_DURABLE_RELATION");
    const provisional=fixture();provisional.teams[1].identityStage="PROVISIONAL";expect(evaluateSubmissionCandidates(provisional).find(r=>r.evidence.submittedFactionId === "weak"&&r.evidence.receivingFactionId === "strong")!.blockers).toContain("NOT_FORMAL_STATE");
    const expired=fixture();expired.relations[0].expiresMonth=120;expect(evaluateSubmissionCandidates(expired).find(r=>r.evidence.submittedFactionId === "weak"&&r.evidence.receivingFactionId === "strong")!.blockers).toContain("NO_DURABLE_RELATION");
    const far=fixture();far.teams[1]=team("weak",3,99999);expect(evaluateSubmissionCandidates(far).find(r=>r.evidence.submittedFactionId === "weak"&&r.evidence.receivingFactionId === "strong")!.blockers).toContain("NOT_ADJACENT");
    const war=fixture();war.recentEvents=[{id:"war",type:"capital-fallen",category:"war",year:100,title:"",importance:"major",actorFactionId:"strong",targetFactionId:"weak"}];
    expect(evaluateSubmissionCandidates(war).find(r=>r.evidence.submittedFactionId === "weak"&&r.evidence.receivingFactionId === "strong")!.blockers).toContain("RECENT_BILATERAL_WAR");
  });
  it("a same-origin pair exclusively retains Strategic Union eligibility",()=>{
    const input=fixture();input.teams=[team("strong",30,0,40,"parent"),team("weak",3,32,40,"parent"),team("other",67,99999)];input.relations[0].startedMonth=0;
    expect(evaluateSubmissionCandidates(input).find(r=>r.evidence.submittedFactionId === "weak"&&r.evidence.receivingFactionId === "strong")!.candidate).toBeUndefined();
    expect(findStrategicUnionCandidate(input)?.absorbedFaction.name).toBe("weak");
    expect(findStrategicUnionCandidate(fixture())).toBeUndefined();
  });
  it("uses the frozen credibility function for a real Alliance protection path",()=>{
    const input=fixture(),threat=team("threat",72,-32);input.teams[0]=team("strong",25,0);input.teams[2]=threat;input.relations[0].commonThreatFactionId="threat";
    input.recentEvents=[{id:"contact",type:"city-captured",category:"war",year:110,title:"",importance:"normal",actorFactionId:"threat",targetFactionId:"weak"}];
    const result=evaluateSubmissionCandidates(input).find(r=>r.evidence.submittedFactionId === "weak"&&r.evidence.receivingFactionId === "strong")!;
    expect(result.evidence.threatCredibility).toBe("SEVERE");expect(result.candidate?.path).toBe("ALLIANCE_PROTECTION");
  });
  it("ranks Alliance, continuity, gap, stability and stable ids; input order never decides",()=>{
    const c=evaluateSubmissionCandidates(fixture()).find(r=>r.candidate)!.candidate!;
    const make=(change:Partial<SubmissionEvidence>)=>({...c,evidence:{...c.evidence,...change}});
    for(const weaker of [make({relationStatus:"NON_AGGRESSION"}),make({continuousRelationMonths:100}),make({receivingTerritoryShare:28}),make({submittedStability:50}),make({submittedFactionId:"zzz"})])expect(rankSubmissionCandidates(c,weaker)).toBeLessThan(0);
    const input=fixture();expect(evaluateSubmissionCandidates({...input,teams:input.teams.slice().reverse()})).toEqual(evaluateSubmissionCandidates(input));
  });
  it("executes at most one per evaluation, ignores duplicate/nonannual calls; debug/RNG are read-only",()=>{
    const run=(debug:boolean)=>{
      const rng=worldRandom.exportState(),system=new PeacefulSubmissionSystem(debug),input=fixture();let calls=0;
      input.teams.push(team("tiny",2,-32));input.relations.push({...relation,factionBId:"tiny"});
      for(const month of [120,120,121])system.update({...input,worldMonth:month},()=>{calls++;return true;});
      expect(calls).toBe(1);const d=system.getDiagnostics(121);
      if(debug)expect(d.sessionCumulative).toMatchObject({candidateChecks:6,eligibleCount:2,submissionCount:1});
      for(let i=0;i<50;i++)system.getDiagnostics(121);expect(worldRandom.exportState()).toEqual(rng);
      return calls;
    };expect(run(true)).toBe(run(false));
  });
  it("same-seed candidate choice and terminal digest reproduce with debug on/off",()=>{
    const run=(debug:boolean)=>{
      worldRandom.initialize("peaceful-submission-seed");const input=fixture(),system=new PeacefulSubmissionSystem(debug);
      const output:string[]=[];
      for(const month of [120,132,144])system.update({...input,worldMonth:month},c=>{
        output.push(`${c.evidence.submittedFactionId}->${c.evidence.receivingFactionId}@${month}`);
        c.submitted.status="EXTINCT";return true;
      });
      return {output,canonical:input.teams.map(t=>({id:t.name,status:t.status})),rng:worldRandom.exportState()};
    };
    const before=worldRandom.exportState();expect(run(true)).toEqual(run(false));worldRandom.restore(before);
  });
  it("bounds recent samples and 100y buckets, resets on hydration without changing facts",()=>{
    const system=new PeacefulSubmissionSystem(true),input=fixture(),original=JSON.stringify(input);
    for(let month=12;month<2400;month+=12)system.update({...input,worldMonth:month},()=>true);
    const d=system.getDiagnostics(2400);expect(d.recentCandidates.length).toBeLessThanOrEqual(10);expect(d.recent100Years.candidateChecks).toBeLessThanOrEqual(303);
    expect(JSON.stringify(input)).toBe(original);system.reset();expect(system.getDiagnostics(2400).sessionCumulative.candidateChecks).toBe(0);
  });
});
