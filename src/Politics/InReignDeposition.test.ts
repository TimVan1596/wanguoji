import {WorldRandom} from "../Simulation/WorldRandom";
import {validDepositionSelection} from "../Persistence/DepositionSelectionValidation";
import { describe, expect, it } from "vitest";
import { evaluateDepositionOpportunity, getRecentDepositionEvidence, selectDepositionCandidates, chooseDepositionClaimant } from "./InReignDeposition";
import type { Ruler } from "./Dynasty";
import type { WorldEvent } from "../History/WorldHistory";

const ruler = (overrides: Partial<Ruler>): Ruler => ({ id: "r", houseName: "秦氏", givenName: "平", bornYear: -600,
  naturalDeathYear: 1200, status: "kin", ...overrides });
const crisis = (id: string, group: string, month: number, faction = "qin"): WorldEvent => ({
  id, year: month, monthIndex: month, type: "capital-fallen", category: "war", title: id,
  factionIds: ["enemy", faction], actorFactionId: "enemy", targetFactionId: faction,
  historyGroupId: group, importance: "major",
});

describe("InReignDeposition evidence and opportunity", () => {
  it("attributes shocks only to the affected faction and collapses one history group", () => {
    const events = [crisis("capture", "siege-1", 90), crisis("capital", "siege-1", 90), crisis("foreign", "foreign-war", 95, "wei")];
    expect(getRecentDepositionEvidence("qin", events, 100).map(e => e.eventId)).toEqual(["capture"]);
    expect(getRecentDepositionEvidence("qin", [crisis("stale", "stale", 63)], 100)).toEqual([]);
    expect(getRecentDepositionEvidence("qin", [crisis("future", "future", 101)], 100)).toEqual([]);
  });

  it("requires a pre-existing adult recorded close kin and retains all legal candidates for coup selection", () => {
    const current = ruler({ id: "current", bornYear: -600, accessionYear: 0, status: "ruling" });
    const children = ["child1", "child2", "child3"].map((id, index) => ruler({ id, bornYear: -400 - index * 12,
      parentId: current.id, status: "heir" }));
    const disqualified = [
      ruler({ id: "young", bornYear: -50, parentId: current.id, status: "heir" }),
      ruler({ id: "foreign-house", houseName: "魏氏", parentId: current.id, status: "kin" }),
      ruler({ id: "previous-ruler", parentId: current.id, status: "kin", reignOrdinal: 1 }),
      ruler({ id: "unknown-kin", parentId: undefined, status: "kin" }),
      ruler({ id: "dead", parentId: current.id, status: "dead", deathMonth: 1, deathReason: "去世" }),
    ];
    expect(selectDepositionCandidates({ currentRuler: current, rulers: [current, ...children, ...disqualified], houseName: "秦氏", worldMonth: 100 })
      .map(({ ruler: candidate }) => candidate.id)).toEqual(["child3", "child2", "child1"]);
  });

  it("separates current vulnerability, real crisis qualification, conservative/control risk and cooldown", () => {
    const current = ruler({ id: "current", accessionYear: 0, status: "ruling" });
    const kin = ruler({ id: "kin", bornYear: -400, parentId: current.id, status: "heir" });
    const events = [crisis("one", "one", 100)];
    const input = { factionId: "qin", status: "ACTIVE", identityStage: "STATE", cityCount: 3, stability: 40, currentRuler: current,
      rulers: [current, kin], houseName: "秦氏", worldMonth: 108, events };
    const conservative = evaluateDepositionOpportunity(input);
    const control = evaluateDepositionOpportunity({ ...input, riskGroup: "CONTROL" });
    expect(conservative).toMatchObject({ eligible: true, probability: 0.005 });
    expect(control).toMatchObject({ eligible: true, probability: 0.02 });
    expect(evaluateDepositionOpportunity({ ...input, stability: 41, cityCount: 3 }).blockers).toContain("NO_CURRENT_VULNERABILITY");
    expect(evaluateDepositionOpportunity({ ...input, events: [] }).blockers).toContain("NO_RECENT_REAL_CRISIS");
    expect(evaluateDepositionOpportunity({ ...input, identityStage: "PROVISIONAL" }).blockers).toContain("NOT_FORMAL_STATE");
    expect(evaluateDepositionOpportunity({ ...input, lastAttemptMonth: 60 }).blockers).toContain("COOLDOWN");
    expect(evaluateDepositionOpportunity({ ...input, cityCount: 1, stability: 90 }).eligible).toBe(true);
  });
});

it("compares real adult sons and brothers without fixing either as winner or consuming a second roll",()=>{
 const parent=ruler({id:"father",status:"dead",deathMonth:0,deathReason:"去世"});
 const current=ruler({id:"king",parentId:parent.id,status:"ruling",accessionYear:0});
 const son=ruler({id:"son",parentId:current.id,bornYear:-192,status:"heir"});
 const brother=ruler({id:"brother",parentId:parent.id,bornYear:-400});
 const child=ruler({id:"minor",parentId:current.id,bornYear:50});
 const dead=ruler({id:"dead",parentId:current.id,bornYear:-300,status:"dead",deathMonth:50,deathReason:"去世"});
 const e=evaluateDepositionOpportunity({factionId:"qin",status:"ACTIVE",identityStage:"STATE",cityCount:1,stability:20,currentRuler:current,rulers:[parent,current,son,brother,child,dead],houseName:"秦氏",worldMonth:108,events:[crisis("loss","loss",100)]});
 expect(e.candidates.map(c=>c.ruler.id).sort()).toEqual(["brother","son"]);
 const winners=new Set(Array.from({length:100},(_,i)=>chooseDepositionClaimant(e,108,e.probability*i/100)!.claimant.ruler.id));
 expect([...winners].sort()).toEqual(["brother","son"]);
 expect(chooseDepositionClaimant(e,108,e.probability)).toBeUndefined();
 expect(chooseDepositionClaimant(e,108,0)).toEqual(chooseDepositionClaimant(e,108,0));
 for(const id of ["son","brother"]){const only={...e,candidates:e.candidates.filter(c=>c.ruler.id===id)};expect(chooseDepositionClaimant(only,108,.001)!.claimant.ruler.id).toBe(id);}
});

it("records deterministic per-seed claimant distributions separately from the unchanged coup lottery",()=>{
 const parent=ruler({id:"root",status:"dead",deathMonth:0,deathReason:"去世"});
 const current=ruler({id:"king",parentId:parent.id,status:"ruling",accessionYear:0});
 const children=[ruler({id:"son",parentId:current.id,bornYear:-192,status:"heir"}),ruler({id:"brother",parentId:parent.id,bornYear:-400})];
 const rulers=[parent,current,...children],month=108;
 const e=evaluateDepositionOpportunity({factionId:"qin",status:"ACTIVE",identityStage:"STATE",cityCount:1,stability:20,currentRuler:current,rulers,houseName:"秦氏",worldMonth:month,events:[crisis("loss","loss",100)]});
 const rows=Array.from({length:24},(_,seed)=>{
  const rng=new WorldRandom();rng.initialize(`claimant-${seed+1}`);const distribution:Record<string,number>={};
  for(let i=0;i<1000;i++){
   const result=chooseDepositionClaimant(e,month,rng.next()*e.probability)!;
   distribution[result.claimant.relation]=(distribution[result.claimant.relation]??0)+1;
   const raw=JSON.stringify(result.evidence);
   expect(validDepositionSelection(raw,rulers,current.id,result.claimant.ruler.id,month)).toBe(true);
   if(i===0){expect(validDepositionSelection(JSON.stringify({...result.evidence,selectedRulerId:"missing"}),rulers,current.id,result.claimant.ruler.id,month)).toBe(false);}
  }
  expect(Object.keys(distribution).sort()).toEqual(["DIRECT_CHILD","SIBLING"]);
  return {seed:`claimant-${seed+1}`,conditionalSuccesses:1000,old:{DIRECT_CHILD:1000},candidate:distribution,probability:e.probability,randomDraws:rng.exportState().position};
 });
 console.info("[DepositionSelection] "+JSON.stringify(rows));
});
