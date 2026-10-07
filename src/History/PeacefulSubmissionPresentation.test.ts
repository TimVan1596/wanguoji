import { describe, expect, it } from "vitest";
import { getSubmissionEventPresentation } from "./PeacefulSubmissionPresentation";
import { formatHistoryEventTitle } from "./HistoryRenderRules";
import { formatFactionHistoryEvent } from "./FactionHistoryFormatter";
import { WorldHistoryStore, type WorldEvent } from "./WorldHistory";
import { queryHistoryPage } from "./HistoryPageQuery";
import { getFactionPowerChronicleEvents, getHistorySignificance } from "./HistorySignificanceRules";
import worldRandom from "../Simulation/WorldRandom";
const factions=new Map([["a",{name:"a",displayName:"新郑",color:1,nameHistory:[{name:"郑",startMonth:0,endMonth:119},{name:"新郑",startMonth:120}]}],["b",{name:"b",displayName:"楚",color:2}]]);
const event:WorldEvent={id:"submission",type:"faction-submitted",year:100,monthIndex:100,category:"politics",importance:"major",title:"存档原文",actorFactionId:"a",targetFactionId:"b",factionIds:["a","b"],metadata:{submittedFactionId:"a",receivingFactionId:"b",relationStatus:"ALLIANCE",continuousRelationMonths:96,renewalCount:2,bilateralWarFreeMonths:60,submittedTerritoryShare:3.2,receivingTerritoryShare:28.6,submittedCityCount:1,receivingCityCount:5,submittedStability:40,submittedRulerId:"last",submittedRulerName:"陈平"}};
describe("peaceful submission factual presentation and bounded history discovery",()=>{
  it("uses event-month names, factual numbers and abdication, never inventing an enemy or death",()=>{
    const rng=worldRandom.exportState(),original=JSON.stringify(event),p=getSubmissionEventPresentation(event,factions)!;
    expect(p.title).toBe("郑纳土归附楚");expect(formatHistoryEventTitle(event,factions)).toBe(p.title);
    const text=p.lines.join("\n");expect(text).toContain("3.2%");expect(text).toContain("28.6%");expect(text).toContain("纳土退位");expect(text).not.toContain("共同强敌");expect(text).not.toContain("战死");
    expect(formatFactionHistoryEvent(event,"b",factions)).toBe("郑纳土来归");expect(getFactionPowerChronicleEvents([event],"b")).toEqual([event]);
    expect(JSON.stringify(event)).toBe(original);expect(worldRandom.exportState()).toEqual(rng);
  });
  it("displays only recorded credible pressure",()=>{
    const e={...event,metadata:{...event.metadata,commonThreatFactionId:"b",threatCredibility:"CREDIBLE"}};
    expect(getSubmissionEventPresentation(e,factions)!.lines).toContain("共同强敌：楚 · CREDIBLE");
    e.metadata.threatCredibility="WEAK";expect(getSubmissionEventPresentation(e,factions)!.lines.join("\n")).not.toContain("共同强敌");
  });
  it("is a major political event visible through 大事→纳降, including faction/era windows",()=>{
    const store=new WorldHistoryStore();for(let i=0;i<20000;i++)store.addEvent({...event,id:`event-${i}`,year:i,monthIndex:i,type:"city-founded"});store.addEvent(event);
    expect(getHistorySignificance(event)).toBe("MAJOR");
    expect(queryHistoryPage(store,{filter:"featured",eventTypeFilter:"submission",visibleCount:200,factionId:"b",startMonth:90,endMonth:110}).events.map(e=>e.id)).toEqual([event.id]);
    expect(queryHistoryPage(store,{filter:"war",visibleCount:200}).events.some(e=>e.type === "faction-submitted")).toBe(false);
  });
});
