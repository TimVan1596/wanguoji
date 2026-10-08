import { describe, expect, it } from "vitest";
import { formatHistoryEventTitle, formatHistoryEventDescription } from "./HistoryRenderRules";
import { getDiplomacyEventDetails } from "./DiplomacyEventDetails";
import { createDiplomacyEventMetadata, describeDiplomacySigning, describeDiplomacyRenewal, formatDiplomacyRelationLines } from "../Politics/DiplomacyPresentation";
import type { DiplomaticRelation, DiplomacyTriggerContext } from "../Politics/Diplomacy";
import type { WorldEvent } from "./WorldHistory";
import worldRandom from "../Simulation/WorldRandom";
import { createEmptyWorldSaveV10 } from "../Persistence/WorldSaveSchema";

const factions = new Map([
  ["a", {name:"a", displayName:"新赵", color:1, nameHistory:[{name:"赵",startMonth:0,endMonth:15000},{name:"新赵",startMonth:15001}]}],
  ["b", {name:"b", displayName:"沈",color:2}],
  ["t", {name:"t", displayName:"魏",color:3}],
]);
const names = {factionAName:"赵",factionBName:"沈",commonThreatName:"魏"};
const nap: DiplomaticRelation = {factionAId:"a",factionBId:"b",status:"NON_AGGRESSION",reason:"COMMON_THREAT_NON_AGGRESSION",startedMonth:1204*12,originalStartedMonth:1204*12,expiresMonth:1213*12,renewalCount:0};
const context: DiplomacyTriggerContext = {reason:"COMMON_THREAT_NON_AGGRESSION",commonThreatFactionId:"t",territoryShareA:10,territoryShareB:12,threatTerritoryShare:50};
const alliance: DiplomaticRelation = {...nap,status:"ALLIANCE",reason:"COMMON_THREAT_ALLIANCE",startedMonth:1206*12,expiresMonth:1218*12,preconditionStatus:"NON_AGGRESSION",preconditionStartedMonth:nap.startedMonth,preconditionDurationMonths:24,renewalCount:1};
const allianceContext: DiplomacyTriggerContext = {...context,reason:"COMMON_THREAT_ALLIANCE",priorStatus:"NON_AGGRESSION",priorDurationMonths:24};
function event(relation:DiplomaticRelation, trigger:DiplomacyTriggerContext, type:WorldEvent["type"]):WorldEvent {
  return {id:"old-v10-event",year:relation.lastRenewedMonth ?? relation.startedMonth,monthIndex:relation.lastRenewedMonth ?? relation.startedMonth,type,category:"politics",importance:"normal",title:"旧存档标题",description:"旧存档重复正文",factionIds:["a","b"],metadata:createDiplomacyEventMetadata(relation,trigger)};
}
describe("Diplomacy Narrative Clarity (recorded V10 events)",()=>{
  it("first NAP shows initial term and actual expiry in both new and existing history",()=>{
    const e=event(nap,context,"non-aggression-signed");
    for(const text of [describeDiplomacySigning(nap,context,names),formatHistoryEventTitle(e,factions)]) {
      expect(text).toContain("约期9年，至1213年1月");expect(text).toContain("赵、沈");expect(text).not.toContain("新赵");
    }
    expect(formatHistoryEventDescription(e,factions)).toBeUndefined();
    expect(getDiplomacyEventDetails(e,factions)).toContain("当前互不侵犯到期：1213年1月");
  });
  it("NAP upgrade replaces the old term and starts a new Alliance term at upgrade month",()=>{
    const e=event(alliance,allianceContext,"alliance-signed"), text=formatHistoryEventTitle(e,factions);
    expect(text).toContain("互不侵犯2年后将关系升级为战略同盟");
    expect(text).toContain("新盟约自1206年1月起，约期12年，至1218年1月");
    const lines=getDiplomacyEventDetails(e,factions);
    expect(lines).toContain("关系升级：互不侵犯 → 战略同盟");
    expect(lines).toContain("原关系开始：1204年1月");
    expect(lines).toContain("当前战略同盟开始：1206年1月");
    expect(lines).toContain("当前战略同盟到期：1218年1月");
    expect(lines).toContain("连续外交关系始于：1204年1月");
  });
  it.each(["TRUCE","NON_AGGRESSION","ALLIANCE"] as const)("%s renewal extends the old expiry, with all continuity fields",status=>{
    const relation={...alliance,status,lastRenewedMonth:1285*12,expiresMonth:1299*12,renewalCount:2};
    const trigger={...allianceContext,previousExpiresMonth:1286*12,renewalDuration:156};
    const e=event(relation,trigger,"relation-renewed"), text=formatHistoryEventTitle(e,factions);
    expect(text).toContain("原约期再延13年，新的到期日为1299年1月");
    expect(text).not.toContain("自本月起");expect(text).not.toContain("结成");
    expect(describeDiplomacyRenewal(relation,trigger,names)).toContain("原约期再延13年");
    const lines=getDiplomacyEventDetails(e,factions);
    expect(lines).toContain("原到期日：1286年1月");expect(lines).toContain("本次再延：13年（156个月）");
    expect(lines).toContain("新到期日：1299年1月");expect(lines).toContain("最近续约：1285年1月");
    expect(lines).toContain("连续关系已续约2次");expect(lines.join("\n")).not.toContain("同盟已续盟2次");
  });
  it("summary labels chain renewals even when this Alliance has not yet renewed",()=>{
    const lines=formatDiplomacyRelationLines(alliance,"沈");
    expect(lines).toContain("当前战略同盟始于：1206年1月");expect(lines).toContain("连续关系始于：1204年1月");
    expect(lines).toContain("有效至：1218年1月");expect(lines).toContain("连续关系已续约1次");
    expect(lines.join("\n")).not.toContain("已续盟1次");
    expect(formatDiplomacyRelationLines(nap,"沈").filter(x=>x.startsWith("连续关系始于"))).toEqual([]);
  });
  it("rendering leaves gameplay/V10 snapshot, events and RNG position unchanged",()=>{
    const save=createEmptyWorldSaveV10(); save.diplomacy.relations=[alliance];
    const e=event(alliance,allianceContext,"alliance-signed");
    const canonical=JSON.stringify({save,e,context:allianceContext}), rng=worldRandom.exportState();
    for(let i=0;i<20;i++) {
      formatDiplomacyRelationLines(alliance,"沈");describeDiplomacySigning(alliance,allianceContext,names);
      formatHistoryEventTitle(e,factions);formatHistoryEventDescription(e,factions);getDiplomacyEventDetails(e,factions);
    }
    expect(JSON.stringify({save,e,context:allianceContext})).toBe(canonical);
    expect(worldRandom.exportState()).toEqual(rng);expect(save.saveSchemaVersion).toBe(12);
  });
});
