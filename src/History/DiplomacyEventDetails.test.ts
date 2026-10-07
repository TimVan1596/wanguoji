import { describe, expect, it } from "vitest";
import type { WorldEvent } from "./WorldHistory";
import type { HistoryFactionLike } from "./HistoryRenderRules";
import { getDiplomacyEventDetails } from "./DiplomacyEventDetails";
import worldRandom from "../Simulation/WorldRandom";
const faction=(id:string,old:string,current:string):HistoryFactionLike=>({name:id,displayName:current,color:1,nameHistory:[{name:old,startMonth:0,endMonth:99},{name:current,startMonth:100}]});
const factions=new Map([["a",faction("a","梁","新梁")],["b",faction("b","关","新关")],["threat",faction("threat","赵","新赵")]]);
const event=(type:WorldEvent["type"]="non-aggression-signed"):WorldEvent=>({id:type,type,year:999,monthIndex:50,category:"politics",importance:"normal",title:type,factionIds:["a","b"],
  metadata:{reason:type==="alliance-signed"?"COMMON_THREAT_ALLIANCE":"COMMON_THREAT_NON_AGGRESSION",commonThreatFactionId:"threat",threatCredibility:"CREDIBLE",directContactA:1,directContactB:0,territoryShareA:10,territoryShareB:11,threatTerritoryShare:50}});
describe("diplomacy factual detail presentation",()=>{
  it("initial NAP shows recorded credibility and each side's known exposure",()=>{
    const lines=getDiplomacyEventDetails(event(),factions);expect(lines).toContain("威胁可信度：CREDIBLE");expect(lines).toContain("共同强敌：赵");
    expect(lines).toContain("共同强敌接触 · A方（梁）：直接战略接触");expect(lines).toContain("共同强敌接触 · B方（关）：无直接接触");
    expect(lines).toContain("梁签约时领土占比：10.0%");
  });
  it("alliance shows SEVERE contact and only explicitly recorded capture/adjacency/capital evidence",()=>{
    const e=event("alliance-signed");Object.assign(e.metadata!,{threatCredibility:"SEVERE",directContactB:1,adjacentPair:1,threatCapturedA:1,threatCapturedB:1,capitalFall:1});
    const lines=getDiplomacyEventDetails(e,factions);expect(lines).toContain("威胁可信度：SEVERE");expect(lines).toContain("共同强敌接触 · B方（关）：直接战略接触");
    expect(lines).toContain("共同压力证据：梁与关彼此接壤");expect(lines).toContain("共同压力证据：赵近期攻陷梁城邑");expect(lines).toContain("共同压力证据：赵近期攻陷关城邑");expect(lines).toContain("共同压力证据：赵近期攻陷双方之一的首都");
  });
  it("missing or false evidence never invents an attack, siege, capital fall or relationship",()=>{
    const e=event();Object.assign(e.metadata!,{adjacentPair:0,threatCapturedA:0,capitalFall:0});
    const text=getDiplomacyEventDetails(e,factions).join("\n");expect(text).not.toContain("攻陷");expect(text).not.toContain("彼此接壤");expect(text).not.toContain("吞并");expect(text).not.toContain("深感");
    delete e.metadata!.directContactB;expect(getDiplomacyEventDetails(e,factions).join("\n")).not.toContain("B方");
  });
  it("renewal displays original chain age rather than restarting at renewal or alliance upgrade",()=>{
    const e=event("relation-renewed");e.monthIndex=125;Object.assign(e.metadata!,{status:"ALLIANCE",reason:"COMMON_THREAT_ALLIANCE",originalStartedMonth:0,startedMonth:24,lastRenewedMonth:125,renewalCount:2,previousExpiresMonth:132,newExpiresMonth:252,renewalDuration:120,threatCredibility:"SEVERE"});
    const lines=getDiplomacyEventDetails(e,factions);expect(lines).toContain("连续关系始于：0年1月");expect(lines).toContain("原到期日：11年1月");expect(lines).toContain("新到期日：21年1月");expect(lines).toContain("连续关系已续约2次");expect(lines).toContain("本次再延：10年（120个月）");
    expect(lines.join("\n")).toContain("连续外交关系已维持：10年5个月");expect(lines.join("\n")).not.toContain("连续外交关系已维持：8年5个月");
  });
  it.each([[50,"梁","赵"],[150,"新梁","新赵"]] as const)("month %i resolves parties and threat historically, ignoring current identity",(month,a,t)=>{
    const e=event();e.monthIndex=month;e.metadata!.threatCapturedA=1;expect(getDiplomacyEventDetails(e,factions)).toContain(`共同压力证据：${t}近期攻陷${a}城邑`);
  });
  it("is a read-only metadata projection and consumes no RNG",()=>{
    const e=event(),before=structuredClone(e),rng=worldRandom.exportState();for(let i=0;i<10;i++)getDiplomacyEventDetails(e,factions);
    expect(e).toEqual(before);expect(worldRandom.exportState()).toEqual(rng);expect(getDiplomacyEventDetails({...e,type:"city-captured"},factions)).toEqual([]);
  });
});
