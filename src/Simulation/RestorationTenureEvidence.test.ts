import { describe, expect, it } from "vitest";
import { deriveRestorationTenureEvidence, type RestorationTenureInput } from "./RestorationTenureEvidence";
import type { WorldEvent } from "../History/WorldHistory";
import { buildRestorationMemoryLines } from "../UI/Components/FactionDetails/model";
import { getRemnantDecayChance, compareExileResourceProtection, getProductionRemnantProtection, PRODUCTION_REMNANT_PROTECTION } from "./ExileResourceExperiments";
import { getRestorationDrawExpectation } from "./HistoricalRestorationRules";
function event(type: "faction-exiled" | "faction-restored", at: number, id = type + at, faction = "qin"): WorldEvent {
  return { id, year: at, type, category: "politics", title: type, importance: "major",
    ...(type === "faction-exiled" ? { targetFactionId: faction } : { actorFactionId: faction }) };
}
function input(): RestorationTenureInput {
  return { team: { name: "qin", status: "ACTIVE", firstFoundedYear: 0, stateFoundedMonth: 0,
    cumulativeActiveYears: 0, currentActiveSinceYear: 0, restorationYears: [] },
    dynasty: { factionId: "qin", houseEpochs: [{ startMonth: 0 }] }, events: [], worldMonth: 6000 };
}
describe("真实正式在国年资", () => {
  it("500年国家与20年新王统分别计权", () => {
    const i = input();
    expect(deriveRestorationTenureEvidence(i)).toMatchObject({ complete: true, stateTenureMonths: 6000, currentHouseTenureMonths: 6000 });
    i.dynasty!.houseEpochs = [{ startMonth: 0, endMonth: 5759 }, { startMonth: 5760 }];
    expect(deriveRestorationTenureEvidence(i)).toMatchObject({ complete: true, stateTenureMonths: 6000, currentHouseTenureMonths: 240 });
  });
  it("裁去临时政权期，15年在国5年流亡不变成20年统治", () => {
    const i = input(); i.worldMonth = 600; i.team.stateFoundedMonth = 360;
    expect(deriveRestorationTenureEvidence(i)).toMatchObject({ complete: true, stateTenureMonths: 240, currentHouseTenureMonths: 240 });
    i.team.stateFoundedMonth = 0; i.worldMonth = 240; i.team.status = "EXILED";
    i.team.lastExiledYear = 180; i.team.cumulativeActiveYears = 180; i.events = [event("faction-exiled",180)];
    const evidence = deriveRestorationTenureEvidence(i);
    expect(evidence).toMatchObject({ complete: true, stateTenureMonths: 180, currentHouseTenureMonths: 180, currentHouseContinuityMonths: 240 });
    expect(buildRestorationMemoryLines(evidence, { worldMonth:240, exileStartedMonth:180, legitimacy:80,remnants:1,hasClaimant:true }).join("\n")).toContain("当前王统正式在国累计：15年");
  });
  it("同月真实追加顺序、重复复国及外国语义不串联", () => {
    const i = input(); i.worldMonth=240;
    i.events=[event("faction-exiled",60,"z"),event("faction-restored",120,"y"), event("faction-exiled",120,"x"),event("faction-restored",180,"w"),event("faction-exiled",5,"foreign","other")];
    Object.assign(i.team,{cumulativeActiveYears:60,currentActiveSinceYear:180,lastExiledYear:120,restorationYears:[120,180]});
    expect(deriveRestorationTenureEvidence(i)).toMatchObject({ complete:true,stateTenureMonths:120,currentHouseTenureMonths:120 });
    i.events=[i.events[0],i.events[2],i.events[1],i.events[3]];
    expect(deriveRestorationTenureEvidence(i).complete).toBe(false);
  });
  it.each(["missing", "future", "counter", "epoch", "foreign"])("%s证据保守拒绝且UI不显示零年", reason => {
    const i=input();
    if(reason==="missing") i.team.restorationYears=undefined;
    if(reason==="future") i.events=[event("faction-exiled",6001)];
    if(reason==="counter") i.team.cumulativeActiveYears=5;
    if(reason==="epoch") i.dynasty!.houseEpochs=[{startMonth:0,endMonth:500},{startMonth:500}];
    if(reason==="foreign") i.dynasty!.factionId="other";
    const e=deriveRestorationTenureEvidence(i);
    expect(e.complete).toBe(false);
    expect(getRemnantDecayChance(e,18,.5)).toBe(.45);
    expect(buildRestorationMemoryLines(e,{worldMonth:6000,remnants:0,hasClaimant:false})[0]).toContain("历史证据不足");
  });
});
describe("轻度生产保护及有限资源对照",()=>{
  it("基线45%、轻中公式、240月退出、无证据中性",()=>{
    const e=deriveRestorationTenureEvidence(input());
    expect(PRODUCTION_REMNANT_PROTECTION).toBe(.25);
    expect(getRemnantDecayChance(e,0,0)).toBe(.45);
    expect(getRemnantDecayChance(e,0)).toBeCloseTo(.3796875);
    expect(getRemnantDecayChance(e,120)).toBeCloseTo(.41484375);
    expect(getRemnantDecayChance(e,240)).toBe(.45);
    expect(getRemnantDecayChance(e,1000)).toBe(.45);
    expect(getRemnantDecayChance(e,0,.25)).toBeCloseTo(.3796875);
    expect(getRemnantDecayChance(e,0,.5)).toBeCloseTo(.309375);
    expect(getRemnantDecayChance(e,240,.5)).toBe(.45);
    expect(getRemnantDecayChance(e,1,.5)).toBeGreaterThan(.225);
    expect(getRemnantDecayChance({...e,currentHouseTenureMonths:240},0,.25)).toBeCloseTo(.4271484375);
    expect(getRemnantDecayChance({...e,stateTenureMonths:240,currentHouseTenureMonths:240},0,.25)).toBeCloseTo(.44296875);
  });
  it("精确分布复用实际衰减，0残部不复生；模型不是城市机会",()=>{
    const tenure=deriveRestorationTenureEvidence(input());
    const sample={factionId:"qin",startedMonth:6000,initialRemnants:1,initialLegitimacy:80,emperor:false,tenure};
    const rows=compareExileResourceProtection(sample);
    expect(rows[0].checkpoints[0].remnantSurvival).toBeCloseTo(.55**3);
    expect(rows[0].checkpoints[1].remnantSurvival).toBeCloseTo(.55**6);
    expect(rows[1].checkpoints[0].remnantSurvival).toBeCloseTo(.226703,5);
    expect(rows[2].checkpoints[0].remnantSurvival).toBeCloseTo(.300058,5);
    expect(rows.every(r=>r.checkpoints[2].positiveResources===0)).toBe(true);
    expect(compareExileResourceProtection({...sample,initialRemnants:0}).every(r=>r.checkpoints.every(c=>c.remnantSurvival===0))).toBe(true);
    for(const n of [5,12]) expect(compareExileResourceProtection({...sample,initialRemnants:n})[0].checkpoints[0].remnantSurvival).toBeCloseTo(1);
    console.log("条件资源对照（无战争/城市/继统者死亡；非自然发生率）",JSON.stringify(rows));
  });
  it("一个城市多候选只积一次概率，非复国槽位不算期望",()=>{
    expect(getRestorationDrawExpectation([{chance:.05,restoration:true},{chance:.03,restoration:true}])).toBeCloseTo(.05);
    expect(getRestorationDrawExpectation([{chance:.05,restoration:false},{chance:.05,restoration:true}])).toBeCloseTo(.025);
  });
});

it("5000年、4000条生命周期事件按本国区间派生，结果确定",()=>{
  const i=input(); i.worldMonth=60000;
  const events:WorldEvent[]=[];
  for(let n=1;n<=2000;n++) events.push(event("faction-exiled",2*n-1),event("faction-restored",2*n));
  i.events=events;
  Object.assign(i.team,{cumulativeActiveYears:2000,currentActiveSinceYear:4000,lastExiledYear:3999,restorationYears:Array.from({length:2000},(_,n)=>2*(n+1))});
  const start=performance.now(); const e=deriveRestorationTenureEvidence(i);
  expect(e).toMatchObject({complete:true,stateTenureMonths:58000,currentHouseTenureMonths:58000});
  expect(deriveRestorationTenureEvidence(JSON.parse(JSON.stringify(i)))).toEqual(e);
  console.log("5000年规模纯派生（非Core自然长局）",{events:events.length,elapsedMs:performance.now()-start});
});

it("生产和页面复用相同概率；流亡起点不符回退，零残部不显示仍有保护", () => {
  const i=input(); Object.assign(i.team,{status:"EXILED",lastExiledYear:6000,cumulativeActiveYears:6000});
  i.events=[event("faction-exiled",6000)]; i.worldMonth=6018;
  const e=deriveRestorationTenureEvidence(i);
  const p=getProductionRemnantProtection(e,6018,6000,6000);
  expect(p).toMatchObject({status:"LIGHT",exileMonths:18,remainingMonths:222});
  expect(p.chance).toBeCloseTo(.3849609375);
  expect(getProductionRemnantProtection(e,6018,6001,6000)).toMatchObject({status:"INSUFFICIENT",chance:.45});
  expect(getProductionRemnantProtection(e,6019,6000,6000)).toMatchObject({status:"INSUFFICIENT",chance:.45});
  const viewInput={worldMonth:6018,exileStartedMonth:6000,lastExiledMonth:6000,remnants:1,legitimacy:80,hasClaimant:true};
  expect(buildRestorationMemoryLines(e,viewInput).join("\n")).toContain("当前残部衰减命中率：38.496%");
  const empty=buildRestorationMemoryLines(e,{...viewInput,remnants:0}).join("\n");
  expect(empty).toContain("无残部可保护"); expect(empty).not.toContain("当前残部衰减命中率");
});
