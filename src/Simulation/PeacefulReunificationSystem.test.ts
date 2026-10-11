import { describe, expect, it } from "vitest";
import type Team from "../Components/Team";
import type { WorldEvent } from "../History/WorldHistory";
import type { DiplomaticRelation } from "../Politics/Diplomacy";
import { createDiplomacyEventMetadata } from "../Politics/DiplomacyPresentation";
import { diagnosePeacefulReunificationCandidates, verifyNonAggressionPeace } from "./PeacefulReunificationSystem";
import worldRandom from "./WorldRandom";

function fixture() {
  const team = (name:string,count:number,x:number) => ({ name,status:"ACTIVE",identityStage:"STATE",isDie:false,
    origin:{type:"SPLIT",parentFactionId:"parent"},cities:[{loyalty:80}],
    blocks:{children:{size:count,entries:Array.from({length:count},(_,i)=>({x:i ? 100+i*5 : x,y:0}))}} } as unknown as Team);
  const strong = team("a",15,0), weak = team("b",3,1), threat = team("z",82,2);
  const r: DiplomaticRelation = { factionAId:"a",factionBId:"b",status:"NON_AGGRESSION",reason:"COMMON_THREAT_NON_AGGRESSION",
    startedMonth:12,originalStartedMonth:0,expiresMonth:144,renewalCount:0,commonThreatFactionId:"z" };
  const sign:WorldEvent = { id:"sign",year:12,monthIndex:12,type:"non-aggression-signed",category:"politics",title:"签约",
    factionIds:["a","b"],importance:"major",metadata:createDiplomacyEventMetadata(r) };
  const events = [sign];
  return {strong,weak,threat,r,events,input:{teams:[strong,weak,threat],relations:[r],worldMonth:132,totalCells:100,blockSize:1,getRelationEvents:()=>events}};
}
const chosen = (f:ReturnType<typeof fixture>) => diagnosePeacefulReunificationCandidates(f.input)[0];
describe("同源长期互不侵犯归并资格",()=>{
  it("同时满足全部约束、正面条约证据和战争核验才合格，不消费随机数",()=>{
    const f=fixture(),before=worldRandom.exportState(),snapshot=JSON.stringify(f);
    const row=chosen(f);
    expect(row.blockers).toEqual([]);
    expect(row.candidate).toMatchObject({absorbingFaction:f.strong,absorbedFaction:f.weak,unionPath:"LONG_NON_AGGRESSION",
      commonThreatFactionId:"z",bilateralWarFreeMonths:120,peaceEvidence:{signingEventId:"sign"}});
    expect(worldRandom.exportState()).toEqual(before);expect(JSON.stringify(f)).toBe(snapshot);
  });
  it.each([
    ["不同源",(f:ReturnType<typeof fixture>)=>{f.weak.origin!.parentFactionId="other";},"NOT_SAME_ORIGIN"],
    ["未满十年",(f:ReturnType<typeof fixture>)=>{f.input.worldMonth=131;},"NON_AGGRESSION_TOO_SHORT"],
    ["过期",(f:ReturnType<typeof fixture>)=>{f.r.expiresMonth=132;},"TREATY_EXPIRED"],
    ["缺少签约",(f:ReturnType<typeof fixture>)=>{f.events.length=0;},"PEACE_EVIDENCE_INSUFFICIENT"],
    ["没有正式建制",(f:ReturnType<typeof fixture>)=>{f.weak.identityStage="PROVISIONAL";},"NO_ACTIVE_STATE"],
    ["不接壤",(f:ReturnType<typeof fixture>)=>{f.weak.blocks.children.entries.length=0;},"NOT_ADJACENT"],
    ["实力接近",(f:ReturnType<typeof fixture>)=>{f.weak.blocks.children.size=10;},"POWER_GAP_TOO_SMALL"],
    ["弱国两城",(f:ReturnType<typeof fixture>)=>{f.weak.cities.push({loyalty:80} as never);},"WEAKER_TOO_MANY_CITIES"],
    ["没有共同压力且非极弱",(f:ReturnType<typeof fixture>)=>{f.r.commonThreatFactionId=undefined;},"NO_PRESSURE_TRIGGER"],
  ] as const)("阻断：%s",(_name,mutate,blocker)=>{
    const f=fixture();mutate(f);expect(chosen(f).blockers).toContain(blocker);expect(chosen(f).candidate).toBeUndefined();
  });
  it("不能将最初停战时间或缺失历史当作十年和平",()=>{
    const f=fixture();f.r.startedMonth=72;f.events[0].year=f.events[0].monthIndex=72;
    f.events[0].metadata=createDiplomacyEventMetadata(f.r);
    expect(chosen(f).blockers).toContain("NON_AGGRESSION_TOO_SHORT");
    f.r.startedMonth=12;f.events[0].type="truce-signed";
    expect(verifyNonAggressionPeace(f.r,132,f.events)).toBeUndefined();
  });
  it("检查完整120个月窗口，包含旧五年窗口之外的战争，忽略未来与第三方事件",()=>{
    const f=fixture();const battle:WorldEvent={id:"war",year:30,type:"city-captured",category:"war",title:"战事",
      actorFactionId:"a",targetFactionId:"b",importance:"major"};
    f.events.push(battle);expect(chosen(f).candidate).toBeUndefined();
    battle.year=140;expect(chosen(f).candidate).toBeDefined();
    battle.year=30;battle.targetFactionId="z";expect(chosen(f).candidate).toBeDefined();
  });
  it("按真实续约逐段证明，不允许期限缺口、缺失续约或政治关系中断",()=>{
    const f=fixture();f.events[0].metadata!.expiresMonth=108;
    Object.assign(f.r,{renewalCount:1,lastRenewedMonth:96,expiresMonth:240});
    const renewal:WorldEvent={id:"renew",year:96,type:"relation-renewed",category:"politics",title:"续约",importance:"normal",
      factionIds:["a","b"],metadata:createDiplomacyEventMetadata(f.r,{reason:"COMMON_THREAT_NON_AGGRESSION",
        commonThreatFactionId:"z",territoryShareA:15,territoryShareB:3,threatTerritoryShare:82,previousExpiresMonth:108,renewalDuration:132})};
    f.events.push(renewal);expect(chosen(f).candidate?.peaceEvidence?.eventIds).toEqual(["sign","renew"]);
    expect(verifyNonAggressionPeace(f.r,132,[f.events[0]])).toBeUndefined();
    renewal.year=120;expect(chosen(f).candidate).toBeUndefined();renewal.year=96;
    f.events.push({...renewal,id:"expired",type:"treaty-expired"});expect(chosen(f).candidate).toBeUndefined();
  });
  it("原有极弱事实可替代共同压力，不能伪造共同威胁",()=>{
    const f=fixture();f.r.commonThreatFactionId=undefined;f.weak.cities[0].loyalty=40;
    expect(chosen(f).candidate).toBeDefined();expect(chosen(f).candidate?.commonThreatFactionId).toBeUndefined();
    expect(f.r.status).toBe("NON_AGGRESSION");expect(f.r.reason).toBe("COMMON_THREAT_NON_AGGRESSION");
  });
  it("同年多个候选稳定选择，JSON恢复后证据与角色不变",()=>{
    const f=fixture(),second={...f.r,factionAId:"a",factionBId:"c"};
    const c={...f.weak,name:"c"} as Team;f.input.teams.push(c);
    f.input.relations=[second,f.r];f.events.push({...f.events[0],id:"sign-c",factionIds:["a","c"]});
    const rows=diagnosePeacefulReunificationCandidates(f.input);
    expect(rows.map(r=>r.factionBId)).toEqual(["b","c"]);
    const clone=JSON.parse(JSON.stringify(f.input));clone.getRelationEvents=()=>JSON.parse(JSON.stringify(f.events));
    expect(diagnosePeacefulReunificationCandidates(clone)).toEqual(rows);
  });
});
