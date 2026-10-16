import { describe, expect, it } from "vitest";
import { getWarTornCityEvidence, warTornRestorationChance, deriveHistoricalCityRules, getHistoricalRestorationBasis, historicalRestorationChance, selectRestorationOpportunity, deriveRestorationHistoricalProfile, deriveFactionRestorationHistoricalProfile, applyRestorationHistoricalMultiplier } from "./HistoricalRestorationRules";
import type { CityHistoryEvent } from "../Components/City";
const formal = new Map([["founder", 0], ["old", 10], ["owner", 0]]);
const founded: CityHistoryEvent = { year: 0, type: "founded", title: "建城", newOwnerFactionId: "founder" };
function city(events: CityHistoryEvent[], owner = "owner", count = 2) { return { foundedYear: 0, founderFactionId: "founder", ownerFactionId: owner, captureCount: count, history: [founded, ...events] }; }
const capture = (year: number, from: string, to: string): CityHistoryEvent => ({ year, type: "captured", title: "易主", previousOwnerFactionId: from, newOwnerFactionId: to });
const capital = (year: number): CityHistoryEvent => ({ year, type: "capital-relocated", title: "迁都", newOwnerFactionId: "old", wasCapital: true });

describe("旧都与长期统治地真实历史证据", () => {
  it("国家历史与当前王统历史分别计权，异姓新epoch不继承旧王统年资", () => {
    const youngState = deriveRestorationHistoricalProfile({ factionId: "old-state", stateTenureMonths: 300 * 12,
      currentHouseTenureMonths: 100, currentHouseEpochStartMonth: 3500, worldMonth: 3600, basis: "FORMER_CAPITAL", heldMonths: 5000 });
    const matureHouse = deriveRestorationHistoricalProfile({ factionId: "old-state", stateTenureMonths: 300 * 12,
      currentHouseTenureMonths: 3600, currentHouseEpochStartMonth: 0, worldMonth: 3600, basis: "FORMER_CAPITAL", heldMonths: 5000 });
    const newState = deriveRestorationHistoricalProfile({ factionId: "new-state", stateTenureMonths: 20 * 12,
      currentHouseTenureMonths: 240, currentHouseEpochStartMonth: 0, worldMonth: 20 * 12, basis: "LONG_RULE", heldMonths: 500 });
    expect(youngState.stateTenureMonths).toBe(3600);
    expect(youngState.currentHouseTenureMonths).toBe(100);
    expect(youngState.houseHistoricalWeight).toBeLessThan(matureHouse.houseHistoricalWeight);
    expect(youngState.combinedMultiplier).toBeGreaterThan(newState.combinedMultiplier);
    expect(matureHouse.combinedMultiplier).toBeLessThanOrEqual(1.35);
    expect(youngState.combinedMultiplier).toBeLessThanOrEqual(1.35);
  });
  it("从V14既有势力累计在国月份和houseEpoch派生新旧王统差异", () => {
    const profile = deriveFactionRestorationHistoricalProfile({
      team: { name: "qin", firstFoundedYear: 0, stateFoundedMonth: 0, lastExiledYear: 3600, restorationYears: [], cumulativeActiveYears: 3600, status: "EXILED" },
      events: [{ id: "exile", year: 3600, type: "faction-exiled", targetFactionId: "qin", category: "politics", title: "流亡", importance: "major" }],
      dynasty: { houseEpochs: [{ startMonth: 0, endMonth: 3499 }, { startMonth: 3500 }] },
      worldMonth: 3600, basis: "FORMER_CAPITAL", heldMonths: 4200,
    });
    expect(profile.stateTenureMonths).toBe(3600);
    expect(profile.currentHouseEpochStartMonth).toBe(3500);
    expect(profile.currentHouseTenureMonths).toBe(100);
  });
  it("无epoch证据时保持中性家族权重，年资加成有边际递减", () => {
    const short = deriveRestorationHistoricalProfile({ factionId: "x", stateTenureMonths: 120, worldMonth: 120,
      basis: "LONG_RULE", heldMonths: 360 });
    const long = deriveRestorationHistoricalProfile({ factionId: "x", stateTenureMonths: 12000, worldMonth: 12000,
      basis: "LONG_RULE", heldMonths: 360, cap: 1.2 });
    expect(short.houseHistoricalWeight).toBe(0);
    expect(short.combinedMultiplier).toBeGreaterThan(1);
    expect(long.combinedMultiplier).toBeGreaterThan(short.combinedMultiplier);
    expect(long.combinedMultiplier).toBeLessThanOrEqual(1.2);
    expect(deriveRestorationHistoricalProfile({ factionId: "x", stateTenureMonths: -1, worldMonth: 0,
      basis: "LONG_RULE", heldMonths: 360 }).combinedMultiplier).toBe(1);
  });
  it("候选风险只作离线乘数重算且保留原路径上限", () => {
    expect(applyRestorationHistoricalMultiplier(.04, 1.15)).toBeCloseTo(.046);
    expect(applyRestorationHistoricalMultiplier(.08, 1.35)).toBe(.09);
    expect(applyRestorationHistoricalMultiplier(.02, 1.35, .03)).toBeCloseTo(.027);
  });
  it("非建立者正式旧都，实际持有十年可派生资格", () => {
    const c = city([capture(10, "founder", "old"), capital(20), capture(130, "old", "owner")]);
    const before = JSON.stringify(c);
    const rules = deriveHistoricalCityRules(c, 150, formal)!;
    expect(rules.find(r => r.factionId === "old")).toEqual({ factionId: "old", heldMonths: 120, formalCapitalRecorded: true });
    expect(getHistoricalRestorationBasis(rules.find(r => r.factionId === "old")!)).toBe("FORMER_CAPITAL");
    expect(JSON.stringify(c)).toBe(before);
  });
  it("无首都证据的实际持有三十年，有较弱历史联系", () => {
    const rule = deriveHistoricalCityRules(city([capture(10, "founder", "old"), capture(370, "old", "owner")]), 390, formal)!.find(r => r.factionId === "old")!;
    expect(rule.heldMonths).toBe(360); expect(getHistoricalRestorationBasis(rule)).toBe("LONG_RULE");
  });
  it("短暂占领不凑足期限；从未统治的国家没有记录", () => {
    const rules = deriveHistoricalCityRules(city([capture(10, "founder", "old"), capture(369, "old", "owner")]), 390, formal)!;
    expect(getHistoricalRestorationBasis(rules.find(r => r.factionId === "old")!)).toBeUndefined();
    expect(rules.some(r => r.factionId === "foreign")).toBe(false);
  });
  it("同月多次易主按原始顺序：中间所有者获得零个月", () => {
    const rules = deriveHistoricalCityRules(city([capture(20, "founder", "old"), capture(20, "old", "owner")]), 400, formal)!;
    expect(rules.find(r => r.factionId === "old")?.heldMonths).toBe(0);
    expect(rules.find(r => r.factionId === "owner")?.heldMonths).toBe(380);
  });
  it("迁都不改变所有权；正式建国前的首都不冒充正式旧都", () => {
    const rules = deriveHistoricalCityRules(city([capture(5, "founder", "old"), capital(6), capture(130, "old", "owner")]), 150, formal)!;
    expect(rules.find(r => r.factionId === "old")?.formalCapitalRecorded).toBe(false);
    expect(getHistoricalRestorationBasis(rules.find(r => r.factionId === "old")!)).toBeUndefined();
  });
  it.each(["merged", "submitted"] as const)("%s 行政转移不把之后时间归给旧政权", type => {
    const rules = deriveHistoricalCityRules(city([{ ...capture(30, "founder", "old"), type }, capture(400, "old", "owner")], "owner", 1), 450, formal)!;
    expect(rules.find(r => r.factionId === "founder")?.heldMonths).toBe(30);
    expect(rules.find(r => r.factionId === "old")?.heldMonths).toBe(370);
  });
  it.each([
    city([capture(10, "missing", "old"), capture(400, "old", "owner")]),
    city([capture(10, "founder", "old"), capture(400, "old", "owner")], "other"),
    city([capture(10, "founder", "old"), capture(400, "old", "owner")], "owner", 3),
    city([capture(400, "founder", "old"), capture(10, "old", "owner")]),
    city([capture(10, "founder", "old"), capture(600, "old", "owner")]),
    { ...city([]), history: [] },
  ])("矛盾、缺失、未来或不匹配的时间线保守拒绝", c => {
    expect(deriveHistoricalCityRules(c, 450, formal)).toBeUndefined();
  });
  it("失都说明与易主可以同月保留，不重复计持有时间", () => {
    const c = city([capture(10, "founder", "old"), capital(20), { year: 140, type: "capital-lost", title: "失都", previousOwnerFactionId: "old", newOwnerFactionId: "owner", wasCapital: true }, capture(140, "old", "owner")]);
    expect(deriveHistoricalCityRules(c, 400, formal)?.find(r => r.factionId === "old")?.heldMonths).toBe(130);
  });
  it("概率有上限、旧都权重较高、长期流亡衰减；不增加逐候选抽签", () => {
    expect(historicalRestorationChance(2, "FORMER_CAPITAL", 10000, 0)).toBe(0.09);
    expect(historicalRestorationChance(.1, "FORMER_CAPITAL", 360, 0)).toBe(.05);
    expect(historicalRestorationChance(.1, "LONG_RULE", 360, 0)).toBe(.025);
    expect(historicalRestorationChance(.1, "FORMER_CAPITAL", 360, 1200)).toBe(.025);
    const rows = Array.from({ length: 100 }, (_, i) => ({ chance: .05, value: i }));
    expect(selectRestorationOpportunity(rows, .051)).toBeUndefined();
    expect(selectRestorationOpportunity(rows, .025)).toBeDefined();
    expect(selectRestorationOpportunity(rows, .025)).toBe(selectRestorationOpportunity(rows, .025));
  });
  it("同一序列化历史派生完全一致，长局上千事件只返回有限所有者", () => {
    const events: CityHistoryEvent[] = [];
    for (let i = 1; i <= 1000; i++) events.push(capture(i, i === 1 ? "founder" : i % 2 ? "owner" : "old", i % 2 ? "old" : "owner"));
    const c = city(events, "owner", 1000);
    const result = deriveHistoricalCityRules(c, 1200, formal);
    expect(result).toHaveLength(3);
    expect(deriveHistoricalCityRules(JSON.parse(JSON.stringify(c)), 1200, formal)).toEqual(result);
  });
});


describe("战乱旧地有限复国风险", () => {
  const base = { loyalty: 33, devastation: 94, ownerStability: 30, recentTransfers: 0,
    basis: "FORMER_CAPITAL" as const, heldMonths: 390, legitimacy: 80, exileMonths: 80 };
  it.each([28, 29, 33, 35, 39, 40])("忠诚度%s的边界独立于原低忠诚公式", loyalty => {
    const chance = warTornRestorationChance({ ...base, loyalty });
    if (loyalty <= 28 || loyalty >= 40) expect(chance).toBe(0);
    else { expect(chance).toBeGreaterThan(0); expect(chance).toBeLessThanOrEqual(.03); }
  });
  it("严重破坏仍需反复易手或低稳定度，累计易手次数不能代替近期证据", () => {
    expect(warTornRestorationChance({ ...base, ownerStability: 90 })).toBe(0);
    expect(warTornRestorationChance({ ...base, ownerStability: 90, recentTransfers: 1 })).toBe(0);
    expect(warTornRestorationChance({ ...base, ownerStability: 90, recentTransfers: 2 })).toBeGreaterThan(0);
    expect(warTornRestorationChance({ ...base, devastation: 69 })).toBe(0);
    const c = { loyalty: 33, devastation: 94, history: [capture(419, "old", "owner"), capture(420, "owner", "old"), capture(480, "old", "owner"), capital(450)] };
    expect(getWarTornCityEvidence(c, 480, 90)).toEqual({ eligible: true, recentTransfers: 2 });
    expect(getWarTornCityEvidence(c, 541, 90)).toEqual({ eligible: false, recentTransfers: 0 });
  });
  it("合法性、流亡衰减、统治依据和稳定度影响风险，多候选不突破上限", () => {
    const chance = warTornRestorationChance(base);
    expect(warTornRestorationChance({ ...base, legitimacy: 0 })).toBe(0);
    expect(warTornRestorationChance({ ...base, exileMonths: 1200 })).toBeLessThan(chance);
    expect(warTornRestorationChance({ ...base, basis: "LONG_RULE" })).toBeLessThan(chance);
    const rows = Array.from({ length: 100 }, (_, value) => ({ chance, value }));
    expect(selectRestorationOpportunity(rows, .031)).toBeUndefined();
    expect(warTornRestorationChance(base)).toBe(chance);
  });
});

describe("s1居民响应危机分层与共享风险",()=>{
  const tenure={complete:true,stateTenureMonths:6000,currentHouseTenureMonths:6000};
  const base={legacyChance:.001,loyalty:39,devastation:70,recentTransfers:0,ownerStability:40,legitimacy:80,basis:"FORMER_CAPITAL" as const,tenure};
  it("强危机显著高于弱危机，年资和旧都身份有界，证据不足不补造年资",async()=>{
    const {localResidentRestorationChance:p}=await import("./HistoricalRestorationRules");
    const weak=p(base),strong=p({...base,loyalty:29,devastation:100,recentTransfers:3,ownerStability:20});
    expect(strong).toBeGreaterThan(weak);expect(strong).toBeGreaterThan(.005);expect(strong).toBeLessThan(.02);
    expect(p({...base,loyalty:29,devastation:100,recentTransfers:3,ownerStability:20,basis:"LONG_RULE"})).toBeLessThan(strong);
    expect(p({...base,loyalty:29,devastation:100,recentTransfers:3,ownerStability:20,tenure:{...tenure,currentHouseTenureMonths:240}})).toBeLessThan(strong);
    expect(p({...base,loyalty:90})).toBe(0);expect(p({...base,legitimacy:0})).toBe(0);
    expect(p({...base,legacyChance:.09})).toBe(.03);
    expect(p({...base,loyalty:0,legacyChance:.09})).toBe(.09);
    expect(p({...base,tenure:{...tenure,complete:false,stateTenureMonths:999999}})).toBe(p({...base,tenure:{...tenure,complete:false,stateTenureMonths:0}}));
    console.log("s1同一危机输入反事实（非自然长局）",{v31s:base.legacyChance,弱危机:weak,强危机:strong});
  });
  it("多个旧朝不相加突破上限，原残部槽位质量和对应draw结果不降低",async()=>{
    const {getLocalResponseDrawDistribution:d,selectLocalResponseOpportunity:select}=await import("./HistoricalRestorationRules");
    const rows=[{legacyChance:.02,chance:.02,local:false,value:"remnant"},
      {legacyChance:.001,chance:.015,local:true,value:"resident-a"}];
    const old=d(rows.map(r=>({...r,chance:r.legacyChance})),.03),next=d(rows,.03);
    expect(next.probabilities[0]).toBe(old.probabilities[0]);expect(next.extraChance).toBeCloseTo(.01);
    expect(select(rows,.01,.03)).toBe("remnant");expect(select(rows,.025,.03)).toBe("resident-a");
    const many=Array.from({length:100},(_,i)=>({legacyChance:.001,chance:.02,local:true,value:i}));
    const distribution=d(many,.03);expect(distribution.probabilities.reduce((a,b)=>a+b,0)).toBeCloseTo(.02);
    expect(d([{legacyChance:.09,chance:.09,local:false},{legacyChance:.001,chance:.02,local:true}],.09).extraChance).toBe(0);
    expect(select([{legacyChance:0,chance:.01,local:true,value:1}],0,.03)).toBe(1);
  });
});
