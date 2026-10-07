import { describe, expect, it } from "vitest";
import type { WorldEvent } from "./WorldHistory";
import { getFactionPowerChronicleEvents, getHistorySignificance, selectMajorTimelineMarkers } from "./HistorySignificanceRules";
import { WorldHistoryStore } from "./WorldHistory";
import { queryHistoryPage } from "./HistoryPageQuery";
import { describeDiplomacyRenewal, createDiplomacyEventMetadata } from "../Politics/DiplomacyPresentation";
import { formatRulerDiplomacyEvent } from "./RulerDiplomacyFormatter";
function event(type:WorldEvent["type"],month=12):WorldEvent { return {id:`${type}-${month}`,year:month,monthIndex:month,type,category:"politics",importance:"major",title:type,actorFactionId:"a",factionIds:["a","b"]}; }
const diplomaticTypes=["truce-signed","non-aggression-signed","alliance-signed","relation-renewed","treaty-expired","alliance-expired"] as const;
describe("Diplomacy II presentation hygiene",()=>{
  it("diplomacy query retains signing, upgrades, renewal and expiry; renewal is NORMAL",()=>{
    const store=new WorldHistoryStore(); diplomaticTypes.forEach((type,i)=>store.addEvent(event(type,i)));
    expect(queryHistoryPage(store,{visibleCount:30,filter:"diplomacy"}).events.map(e=>e.type)).toEqual([...diplomaticTypes].reverse());
    expect(getHistorySignificance(event("relation-renewed"))).toBe("NORMAL");
    expect(queryHistoryPage(store,{visibleCount:30,filter:"featured"}).events.some(e=>e.type === "relation-renewed")).toBe(false);
    expect(getHistorySignificance(event("alliance-signed"))).toBe("MAJOR");
  });
  it("national trajectory excludes every ordinary diplomatic lifecycle event",()=>{
    expect(getFactionPowerChronicleEvents(diplomaticTypes.map(type=>event(type)),"a")).toEqual([]);
    expect(selectMajorTimelineMarkers(diplomaticTypes.map(type=>event(type)),"a")).toEqual([]);
  });
  it("power chronicle retains meaningful events newest-first; chart markers stay chronological",()=>{
    const types=["state-founded","dynasty-usurped","emperor-proclaimed","capital-fallen","capital-relocated","faction-restored","faction-extinct","world-unification"] as const;
    const events=types.map((type,i)=>({...event(type,i*12),targetFactionId:type === "faction-extinct" ? "a" : undefined}));
    const chronicle=getFactionPowerChronicleEvents([...events,...diplomaticTypes.map(type=>event(type,999))],"a");
    expect(chronicle.map(e=>e.type)).toEqual([...types].reverse());
    expect(selectMajorTimelineMarkers([...events,...diplomaticTypes.map(type=>event(type,999))],"a").map(e=>e.type)).toEqual(types);
  });
  it("a conqueror only receives collapse of a genuinely formal historical state",()=>{
    const collapse={...event("faction-extinct"),targetFactionId:"b",conquerorFactionId:"a"};
    expect(getFactionPowerChronicleEvents([collapse],"a",()=>false)).toEqual([]);
    expect(getFactionPowerChronicleEvents([collapse],"a",(id,month)=>id==="b"&&month>=10)).toEqual([collapse]);
    expect(getFactionPowerChronicleEvents([collapse],"b")).toEqual([collapse]);
  });
  it("renewal metadata and prose record actual extension, not a newly formed alliance",()=>{
    const relation={factionAId:"a",factionBId:"b",status:"ALLIANCE" as const,reason:"COMMON_THREAT_ALLIANCE" as const,originalStartedMonth:0,startedMonth:24,expiresMonth:240,lastRenewedMonth:120,renewalCount:1};
    const context={reason:"COMMON_THREAT_ALLIANCE" as const,commonThreatFactionId:"threat",territoryShareA:10,territoryShareB:10,threatTerritoryShare:60,priorStatus:"NON_AGGRESSION" as const,priorDurationMonths:96,credibility:"SEVERE" as const,directA:true,directB:true,previousExpiresMonth:180,renewalDuration:60};
    const metadata=createDiplomacyEventMetadata(relation,context);
    expect(metadata).toMatchObject({originalStartedMonth:0,startedMonth:24,previousExpiresMonth:180,newExpiresMonth:240,renewalDuration:60,renewalCount:1,threatCredibility:"SEVERE",directContactA:1,directContactB:1});
    const prose=describeDiplomacyRenewal(relation,context,{factionAName:"楚",factionBName:"燕",commonThreatName:"魏"});expect(prose).toContain("续盟5年");expect(prose).not.toContain("结成");
    const e={...event("relation-renewed",120),metadata};expect(formatRulerDiplomacyEvent(e,new Map())).toContain("续盟5年");
  });
});
