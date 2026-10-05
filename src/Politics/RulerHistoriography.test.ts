import { describe, expect, it } from "vitest";
import { buildRulerTags, createRulerChronicle, finishRulerChronicle } from "./RulerChronicle";
import { CURRENT_SAVE_SCHEMA_VERSION } from "../Persistence/WorldSaveSchema";
import { BASE_PLAY_RATE } from "../Simulation/SimulationDriver";
import {
  CITY_BASE_MAX_DEFENSE,
  CITY_CAPTURED_DEFENSE_RATIO,
  CITY_SIEGE_DAMAGE_INTERVAL_MONTHS,
  CITY_SIEGE_DAMAGE_PER_TICK,
  FORTIFIED_ZONE_TIERS,
  SIMULATION_SPEEDS,
} from "../config/simulation";
import {
  deriveRulerAssessment,
  deriveRulerHistoricalEvidence,
  composeRulerAssessment,
  composeHistorianVoice,
  formatPredeceasedHeirAssessment,
  formatAccessionAge,
  RulerHistoriographyContext,
} from "./RulerHistoriography";

function makeContext(options: {
  start?: Partial<{ population: number; territoryShare: number; cityCount: number; stability: number }>;
  end?: Partial<{ population: number; territoryShare: number; cityCount: number; stability: number }>;
  peakPopulation?: number;
  peakTerritory?: number;
  age?: number;
  accession?: number;
  endMonth?: number;
  endReason?: string;
  deathCause?: string;
  events?: any[];
  rulers?: any[];
  foundedStateName?: string;
  foundedStateMonth?: number;
  proclaimedEmperorMonth?: number;
  completedUnification?: boolean;
  restorations?: number;
  captures?: number;
  rebellions?: number;
  factionOrigin?: { foundingRulerId?: string; foundedMonth?: number };
  stateFoundedMonth?: number;
  posthumousEpithet?: string;
} = {}): RulerHistoriographyContext {
  const accession = options.accession ?? 0;
  const endMonth = options.endMonth ?? 120;
  const start = {
    month: accession,
    population: options.start?.population ?? 40,
    territoryShare: options.start?.territoryShare ?? 0.2,
    cityCount: options.start?.cityCount ?? 3,
    stability: options.start?.stability ?? 75,
  };
  const end = {
    month: endMonth,
    population: options.end?.population ?? start.population,
    territoryShare: options.end?.territoryShare ?? start.territoryShare,
    cityCount: options.end?.cityCount ?? start.cityCount,
    stability: options.end?.stability ?? start.stability,
  };
  const chronicle = createRulerChronicle(start);
  finishRulerChronicle(chronicle, end, options.deathCause);
  chronicle.peakPopulation = options.peakPopulation ?? end.population;
  chronicle.peakTerritoryShare = options.peakTerritory ?? end.territoryShare;
  chronicle.foundedStateName = options.foundedStateName;
  chronicle.foundedStateMonth = options.foundedStateMonth;
  chronicle.proclaimedEmperorMonth = options.proclaimedEmperorMonth;
  chronicle.completedUnification = options.completedUnification ?? false;
  chronicle.restorationsDuringReign = options.restorations ?? 0;
  chronicle.citiesCapturedPersonally = options.captures ?? 0;
  chronicle.rebellionsDuringReign = options.rebellions ?? 0;
  const ruler: any = {
    id: "r1",
    houseName: "嬴氏",
    givenName: "平",
    bornYear: accession - (options.age ?? 30) * 12,
    accessionYear: accession,
    endYear: options.endMonth === undefined ? endMonth : options.endMonth,
    endReason: options.endReason,
    status: options.endMonth === undefined ? "dead" : "dead",
    chronicle,
    posthumousEpithet: options.posthumousEpithet,
  };
  const rulers = options.rulers ?? [ruler];
  if (!rulers.includes(ruler)) rulers.push(ruler);
  return {
    ruler,
    dynasty: { rulers } as any,
    faction: { name: "秦", origin: options.factionOrigin, stateFoundedMonth: options.stateFoundedMonth },
    events: options.events ?? [],
    worldMonth: Math.max(endMonth, 120),
  };
}

describe("evidence-grounded ruler historiography", () => {
  it("evaluates a state founder as an institutional founder, not as a data recap", () => {
    const context = makeContext({ foundedStateName: "秦", foundedStateMonth: 48 });
    const result = deriveRulerAssessment(context);
    expect(result.evidence.foundedState).toBe(true);
    expect(result.lines.join("")).toContain("开创之功");
    expect(result.lines.join("")).not.toContain("人口");
  });

  it("does not call a provisional faction founder a state founder", () => {
    const context = makeContext({
      factionOrigin: { foundingRulerId: "r1", foundedMonth: 60 },
      endReason: "战死", deathCause: "战死",
    });
    const result = deriveRulerAssessment(context);
    expect(result.evidence.foundedFaction).toBe(true);
    expect(result.evidence.foundedState).toBe(false);
    expect(result.lines.join(" ")).toContain("创立势力");
    expect(result.lines.join(" ")).not.toMatch(/开国|正式建国|新建国家/);
    expect(result.evidence.monthsSinceFactionFoundationAtEnd).toBe(60);
    expect(result.lines.join(" ")).toContain("创立势力未久即身死军中");
    expect(result.lines.join(" ")).not.toContain("整合尚未完成");
    expect(buildRulerTags(result.evidence)).not.toContain("开国之君");
  });

  it("retains formal state-founder wording and the founding tag", () => {
    const result = deriveRulerAssessment(makeContext({ foundedStateName: "秦", foundedStateMonth: 48 }));
    expect(result.lines.join(" ")).toContain("正式建国");
    expect(buildRulerTags(result.evidence)).toContain("开国之君");
  });

  it("does not call a state founded decades before a founder's death newly founded or unintegrated", () => {
    const result = deriveRulerAssessment(makeContext({
      age: 13,
      endMonth: 51 * 12 + 10,
      endReason: "战死",
      deathCause: "战死",
      foundedStateName: "县",
      foundedStateMonth: 30 * 12,
      start: { territoryShare: 0.255, cityCount: 3, stability: 47 },
      end: { territoryShare: 0.135, cityCount: 1, stability: 90 },
    }));
    const text = result.lines.join(" ");
    expect(result.evidence.monthsSinceStateFoundationAtEnd).toBe(51 * 12 + 10 - 30 * 12);
    expect(text).toContain("正式建国");
    expect(text).toContain("最终身死军中");
    expect(text).not.toMatch(/开国未久|正式建国未久|整合尚未完成/);
  });

  it("allows early formal founding wording within the explicit five-year window, without claiming unfinished integration", () => {
    const result = deriveRulerAssessment(makeContext({
      endMonth: 120,
      endReason: "战死",
      deathCause: "战死",
      foundedStateName: "秦",
      foundedStateMonth: 96,
    }));
    expect(result.evidence.monthsSinceStateFoundationAtEnd).toBe(24);
    expect(result.lines.join(" ")).toContain("正式建国未久即身死军中");
    expect(result.lines.join(" ")).not.toContain("整合尚未完成");
  });

  it("only calls provisional faction creation recent when its canonical founding month supports it", () => {
    const short = deriveRulerAssessment(makeContext({
      endMonth: 120,
      endReason: "战死",
      deathCause: "战死",
      factionOrigin: { foundingRulerId: "r1", foundedMonth: 60 },
    }));
    expect(short.evidence.monthsSinceFactionFoundationAtEnd).toBe(60);
    expect(short.lines.join(" ")).toContain("创立势力未久即身死军中");
    expect(short.lines.join(" ")).not.toContain("整合尚未完成");

    const long = deriveRulerAssessment(makeContext({
      endMonth: 120,
      endReason: "战死",
      deathCause: "战死",
      factionOrigin: { foundingRulerId: "r1", foundedMonth: 0 },
    }));
    expect(long.evidence.monthsSinceFactionFoundationAtEnd).toBe(120);
    expect(long.lines.join(" ")).not.toContain("创立势力未久");
    expect(long.lines.join(" ")).toContain("最终身死军中");
    expect(long.lines.join(" ")).not.toContain("整合尚未完成");
  });

  it("uses the attributed canonical founding event when provisional origin month is unavailable", () => {
    const context = makeContext({
      endMonth: 120,
      endReason: "战死",
      deathCause: "战死",
      factionOrigin: { foundingRulerId: "r1" },
      events: [{
        id: "founded",
        type: "rebel-faction-founded",
        year: 96,
        monthIndex: 96,
        actorFactionId: "秦",
        metadata: { foundingRulerId: "r1" },
      }],
    });
    const evidence = deriveRulerHistoricalEvidence(context);
    expect(evidence.monthsSinceFactionFoundationAtEnd).toBe(24);
    expect(composeRulerAssessment(evidence).lines.join(" ")).toContain("创立势力未久即身死军中");
  });

  it("prioritizes major expansion over stewardship and names a provisional polity accurately", () => {
    const context = makeContext({
      endMonth: 31 * 12 + 3,
      start: { population: 5, territoryShare: 0.137, cityCount: 4, stability: 81 },
      end: { population: 166, territoryShare: 0.922, cityCount: 14, stability: 95 },
      captures: 2,
    });
    const result = deriveRulerAssessment(context);
    expect(result.evidence.roles).toContain("EXPANDER");
    expect(result.evidence.roles).not.toContain("STEWARD");
    expect(buildRulerTags(result.evidence)).toContain("开疆");
    expect(buildRulerTags(result.evidence)).not.toContain("守成");
    expect(result.lines.join(" ")).not.toMatch(/少有显著拓境|守成为其主要遗产/);
    const voice = composeHistorianVoice(result.evidence)!;
    expect(voice).toContain("13.7%扩至92.2%");
    expect(voice).toContain("大规模拓境");
    expect(voice).not.toContain("功在维持");

    // Defend the presentation ordering if an unexpected upstream combination appears.
    result.evidence.roles.push("STEWARD");
    expect(composeRulerAssessment(result.evidence).lines.join(" ")).not.toMatch(/少有显著拓境|守成为其主要遗产/);
    expect(buildRulerTags(result.evidence)).not.toContain("守成");
  });

  it("uses 势力 rather than 国家 for expansion before formal state formation", () => {
    const context = makeContext({
      factionOrigin: { foundingRulerId: "r1" },
      start: { territoryShare: 0.05 }, end: { territoryShare: 0.2, cityCount: 5 },
    });
    const lines = deriveRulerAssessment(context).lines.join(" ");
    expect(lines).toContain("开拓使势力");
    expect(lines).not.toContain("开拓使国家");

    const foundedState = makeContext({
      stateFoundedMonth: 0,
      start: { territoryShare: 0.05 }, end: { territoryShare: 0.2, cityCount: 5 },
    });
    expect(deriveRulerAssessment(foundedState).lines.join(" ")).toContain("开拓使国家");
  });

  it("composes young accession and crisis without repeating 承统", () => {
    const text = deriveRulerAssessment(makeContext({
      age: 7,
      start: { cityCount: 1, territoryShare: 0.08, stability: 35 },
      end: { cityCount: 1, territoryShare: 0.08, stability: 35 },
    })).lines.join(" ");
    expect(text).toContain("幼年继任，其时政权尚处危局");
    expect(text).not.toContain("幼年承统，临危承统");
    expect(text.match(/承统/g)?.length ?? 0).toBeLessThanOrEqual(1);
  });

  it("recognizes a long contested reign from losses, personal captures, and a non-collapsing territory", () => {
    const context = makeContext({
      endMonth: 55 * 12 + 7,
      start: { territoryShare: 0.229, cityCount: 3, stability: 76 },
      end: { territoryShare: 0.29, cityCount: 4, stability: 59 },
    });
    context.ruler.chronicle!.citiesLostDuringReign = 10;
    context.ruler.chronicle!.citiesCapturedPersonally = 2;
    const evidence = deriveRulerHistoricalEvidence(context);
    expect(evidence.roles).toContain("CONTESTED_REIGN");
    const voice = composeHistorianVoice(evidence)!;
    expect(voice).toContain("55年7个月");
    expect(voice).toContain("失城10座");
    expect(voice).toContain("亲征夺城2座");
    expect(voice).toContain("22.9%至29.0%");
    expect(voice).not.toMatch(/勇猛|无能|穷兵黩武|好战/);
  });

  it("keeps a +60pp expansion primary when the ruler dies in battle", () => {
    const context = makeContext({
      age: 8, endMonth: 34 * 12 + 1, endReason: "战死", deathCause: "战死",
      start: { population: 5, territoryShare: 0.103, cityCount: 3, stability: 73 },
      end: { population: 166, territoryShare: 0.704, cityCount: 11, stability: 95 },
    });
    const evidence = deriveRulerHistoricalEvidence(context);
    expect(evidence.roles).toContain("EXPANDER");
    expect(evidence.roles).not.toContain("STEWARD");
    expect(buildRulerTags(evidence)).toContain("开疆");
    expect(buildRulerTags(evidence)).not.toContain("守成");
    const voice = composeHistorianVoice(evidence)!;
    expect(voice).toMatch(/大规模拓境|改变天下格局|重塑.*力量对比|版图大幅外展/);
    expect(voice).toContain("战死");
    expect(voice).not.toMatch(/事业未竟|止于兵事$/);
  });

  it("does not describe a 79-year-old long-reigning battlefield death as premature", () => {
    const context = makeContext({
      age: 47, endMonth: 32 * 12 + 2, endReason: "战死", deathCause: "战死",
      start: { territoryShare: 0.18, cityCount: 3, stability: 70 },
      end: { territoryShare: 0.818, cityCount: 12, stability: 84 },
    });
    const evidence = deriveRulerHistoricalEvidence(context);
    expect(evidence.finalAge).toBe(79);
    expect(evidence.roles).toContain("EXPANDER");
    expect(evidence.roles).toContain("TRAGIC_RULER");
    const voice = composeHistorianVoice(evidence)!;
    expect(voice).toContain("大规模拓境");
    expect(voice).toContain("战死");
    expect(voice).not.toMatch(/过早|骤逝|未及展开|英年/);
  });

  it("keeps neutral tragic wording for ordinary expansion and short-reign wording evidence-gated", () => {
    const ordinary = deriveRulerHistoricalEvidence(makeContext({
      age: 30, endMonth: 15 * 12, endReason: "战死", deathCause: "战死",
      start: { territoryShare: 0.1 }, end: { territoryShare: 0.29 },
    }));
    expect(ordinary.roles).toContain("EXPANDER");
    const ordinaryVoice = composeHistorianVoice(ordinary)!;
    expect(ordinaryVoice).toMatch(/最终|止于军中|因战死而终/);
    expect(ordinaryVoice).not.toMatch(/过早|骤逝|未及展开|英年/);

    const shortYoung = deriveRulerHistoricalEvidence(makeContext({
      age: 15, endMonth: 24, endReason: "战死", deathCause: "战死",
      start: { territoryShare: 0.1 }, end: { territoryShare: 0.25 },
    }));
    expect(shortYoung.roles).toContain("SHORT_REIGN");
    expect(shortYoung.roles).toContain("TRAGIC_RULER");
    expect(composeHistorianVoice(shortYoung)).toMatch(/短祚|短暂|短促|有限|年少/);
  });

  it("recognizes the first emperor's institutional turning point", () => {
    const context = makeContext({ proclaimedEmperorMonth: 60 });
    const result = deriveRulerAssessment(context);
    expect(result.evidence.proclaimedEmperor).toBe(true);
    expect(result.lines.join("")).toContain("王权到帝制");
  });

  it("gives restoration a distinct historical interpretation", () => {
    expect(deriveRulerAssessment(makeContext({ restorations: 1 })).lines.join("")).toContain("复国与重建王统");
  });

  it("interprets major expansion as a political legacy", () => {
    const result = deriveRulerAssessment(makeContext({ end: { territoryShare: 0.36, cityCount: 7 } }));
    expect(result.evidence.roles).toContain("EXPANDER");
    expect(result.lines.join("")).toContain("进取之主");
  });

  it("judges expansion with demographic and stability costs without inventing character", () => {
    const text = deriveRulerAssessment(makeContext({
      end: { population: 20, territoryShare: 0.36, cityCount: 7, stability: 50 },
      peakTerritory: 0.4,
    })).lines.join("");
    expect(text).toContain("得地而失民");
    expect(text).not.toMatch(/英明|昏庸|暴虐|仁慈|残暴|荒淫|好大喜功|雄才大略|懦弱|聪慧|穷兵黩武/);
  });

  it("identifies peak territory followed by a substantial retreat", () => {
    const result = deriveRulerAssessment(makeContext({
      start: { territoryShare: 0.2 },
      end: { territoryShare: 0.31 },
      peakTerritory: 0.56,
    }));
    expect(result.evidence.territorialPeakRetreat).toBeCloseTo(0.25);
    expect(result.lines.join("")).toContain("一度达到56%");
    expect(result.lines.join("")).toContain("明显回落");
    expect(result.lines.join("")).toContain("一度达到鼎盛");
  });

  it("describes inherited high-position decline without claiming the ruler created the peak", () => {
    const result = deriveRulerAssessment(makeContext({
      start: { territoryShare: 0.407 },
      end: { territoryShare: 0.226 },
      peakTerritory: 0.41,
    }));
    expect(result.evidence.territorialPeakGain).toBeCloseTo(0.003);
    expect(result.evidence.roles).toContain("INHERITED_HIGH_DECLINE");
    expect(result.lines.join("")).toContain("承统时国势已居高位");
    expect(result.lines.join("")).not.toContain("一度达到鼎盛");
    expect(result.lines.join("")).not.toContain("疆域一度达到41%");
  });

  it("only describes population as a reign peak when it actually rose above accession", () => {
    const inherited = deriveRulerAssessment(makeContext({
      start: { population: 15 },
      end: { population: 5 },
      peakPopulation: 15,
    })).lines.join("");
    expect(inherited).toContain("承统时人口已有15");
    expect(inherited).not.toContain("人口一度达到15");

    const created = deriveRulerAssessment(makeContext({
      start: { population: 5 },
      end: { population: 8 },
      peakPopulation: 20,
    })).lines.join("");
    expect(created).toContain("人口一度达到20");
  });

  it("recognizes moderate recovery without overstating it as major expansion", () => {
    const result = deriveRulerAssessment(makeContext({
      start: { population: 5, territoryShare: 0.144, cityCount: 3, stability: 52 },
      end: { population: 15, territoryShare: 0.229, cityCount: 2, stability: 66 },
      peakTerritory: 0.229,
      peakPopulation: 15,
    }));
    expect(result.evidence.roles).toContain("MODERATE_RECOVERY");
    expect(result.lines.join("")).toContain("治绩更近恢复而非开创");
    expect(result.lines.join("")).not.toContain("未见足以改写政权格局");
  });

  it("scales expansion language to absolute peak territory", () => {
    const regional = deriveRulerAssessment(makeContext({
      start: { territoryShare: 0.01, cityCount: 1 },
      end: { territoryShare: 0.15, cityCount: 4 },
      peakTerritory: 0.15,
    })).lines.join("");
    expect(regional).toContain("形成相当规模");
    expect(regional).not.toContain("天下强权");

    const hegemon = deriveRulerAssessment(makeContext({
      start: { territoryShare: 0.1, cityCount: 2 },
      end: { territoryShare: 0.32, cityCount: 6 },
      peakTerritory: 0.32,
    })).lines.join("");
    expect(hegemon).toContain("天下强权");
  });

  it("counts forced capital falls separately and reports repeated displacement", () => {
    const events = [1, 2].map((month) => ({
      id: `relocation-${month}`, year: month, monthIndex: month,
      type: "capital-relocated", actorFactionId: "秦",
      metadata: { cause: "CAPITAL_FALL", rulerId: month === 1 ? "r1" : undefined },
      importance: "major",
    }));
    const result = deriveRulerAssessment(makeContext({ events }));
    expect(result.evidence.forcedCapitalRelocationsDuringReign).toBe(2);
    expect(result.evidence.directlyAttributedCapitalRelocations).toBe(1);
    expect(result.lines.join("")).toContain("两度失都");
  });

  it("counts faction-level state destruction once per collapse group without claiming personal action", () => {
    const events = ["魏", "韩"].map((targetFactionId) => ({
      id: `extinct-${targetFactionId}`, year: 50, monthIndex: 50,
      type: "faction-extinct", targetFactionId, conquerorFactionId: "秦",
      metadata: { conquerorFactionId: "秦" }, historyGroupId: `collapse-${targetFactionId}`,
      importance: "major",
    }));
    const result = deriveRulerAssessment(makeContext({ events }));
    expect(result.evidence.factionsDestroyedByFactionDuringReign).toBe(2);
    expect(result.evidence.factionsDestroyedDirectlyAttributedToRuler).toBe(0);
    expect(result.lines.join("")).toContain("其治下先后覆灭2个政权");
    expect(result.lines.join("")).not.toContain("亲自");
  });

  it("requires ruler-linked capture evidence before attributing a state's fall personally", () => {
    const events = [
      { id: "collapse", year: 50, monthIndex: 50, type: "faction-extinct", targetFactionId: "魏", conquerorFactionId: "秦", historyGroupId: "g1", importance: "major" },
      { id: "capture", year: 50, monthIndex: 50, type: "city-captured", actorFactionId: "秦", targetFactionId: "魏", rulerId: "r1", historyGroupId: "g1", importance: "major" },
    ];
    const result = deriveRulerAssessment(makeContext({ events }));
    expect(result.evidence.factionsDestroyedDirectlyAttributedToRuler).toBe(1);
    expect(result.lines.join("")).toContain("直接参与攻灭1个政权");
  });

  it("recognizes a predeceased biological heir but ignores a dynasty archive", () => {
    const parent = makeContext({ endMonth: 120 });
    const heir = { id: "heir", parentId: "r1", bornYear: -240, endYear: 80, endReason: "自然去世", status: "dead" };
    const archived = { id: "archived", parentId: "r1", bornYear: -240, politicalEndYear: 90, endReason: "王统断绝", status: "dead" };
    parent.dynasty.rulers.push(heir as any, archived as any);
    expect(deriveRulerHistoricalEvidence(parent).predeceasedHeirCount).toBe(1);
    expect(deriveRulerAssessment(parent).lines.join("")).toContain("有1名继承候选先于其去世");
  });

  it.each([
    [1, "有1名继承候选"],
    [2, "先后有2名继承候选"],
    [3, "先后有3名继承候选"],
  ])("formats the exact predeceased candidate count: %i", (count, expected) => {
    const text = formatPredeceasedHeirAssessment(count);
    expect(text).toContain(expected);
    expect(text).not.toContain("折嗣");
  });

  it("distinguishes an accession crisis from decline caused during a reign", () => {
    const text = deriveRulerAssessment(makeContext({
      start: { cityCount: 1, territoryShare: 0.08, stability: 35 },
      end: { cityCount: 0, territoryShare: 0.02, stability: 10 },
      endReason: "彻底灭亡",
    })).lines.join("");
    expect(text).toContain("并非由盛转衰的始作俑者");
    expect(text).toContain("这一结局始于承统前的危局");
  });

  it("does not mistake a one-city but broad and stable accession for a crisis", () => {
    const result = deriveRulerAssessment(makeContext({
      start: { cityCount: 1, territoryShare: 0.15, stability: 94 },
      end: { cityCount: 1, territoryShare: 0.15, stability: 94 },
    }));
    expect(result.evidence.accessionCrisis).toBe(false);
    expect(result.evidence.roles).not.toContain("CRISIS_SURVIVOR");
  });

  it("keeps crisis and expansion together instead of denying the expansion", () => {
    const text = deriveRulerAssessment(makeContext({
      start: { cityCount: 1, territoryShare: 0.004, stability: 50 },
      end: { cityCount: 4, territoryShare: 0.152, stability: 65 },
    })).lines.join(" ");
    expect(text).toContain("由危局转入进取");
    expect(text).not.toContain("而非开拓疆土");
    expect(text).toContain("开拓");
  });

  it("rejects stable-governance merit when territory and cities sharply contract", () => {
    const result = deriveRulerAssessment(makeContext({
      start: { cityCount: 3, territoryShare: 0.295, stability: 70 },
      end: { cityCount: 1, territoryShare: 0.127, stability: 100 },
      endMonth: 25 * 12,
    }));
    expect(result.evidence.stabilityDelta).toBe(30);
    expect(result.evidence.stableGovernanceEligible).toBe(false);
    expect(result.evidence.roles).not.toContain("STEWARD");
    expect(result.lines.join(" ")).not.toContain("长期维持政权与秩序");
    expect(result.lines.join(" ")).toContain("残余核心虽稳");
    expect(result.lines.join(" ")).not.toContain("疆域一度达到30%");
  });

  it("can describe severe decline when the ruler inherited a stable state", () => {
    const text = deriveRulerAssessment(makeContext({
      start: { cityCount: 5, territoryShare: 0.4, stability: 85 },
      end: { cityCount: 2, territoryShare: 0.2, stability: 50 },
    })).lines.join("");
    expect(text).toContain("国势在其任内显著衰退");
  });

  it("uses cautious language for a short, uneventful reign", () => {
    const text = deriveRulerAssessment(makeContext({ endMonth: 36 })).lines.join("");
    expect(text).toContain("现有史实尚不足以形成明确的治绩判断");
  });

  it("describes a child who inherited a long exile without treating it as governance", () => {
    const context = makeContext({
      accession: 240, endMonth: 840, age: 3,
      start: { population: 0, territoryShare: 0, cityCount: 0, stability: 0 },
      end: { population: 0, territoryShare: 0, cityCount: 0, stability: 0 },
      events: [{ id: "exile", year: 120, monthIndex: 120, type: "faction-exiled", targetFactionId: "秦", importance: "major" }],
    });
    const result = deriveRulerAssessment(context);
    expect(result.evidence.tenure).toMatchObject({ exiledAtAccession: true, totalTenureMonths: 600, activeRuleMonths: 0, exileMonths: 600 });
    expect(result.evidence.roles).toContain("LONG_EXILE");
    expect(result.lines.join(" ")).toContain("幼年承接流亡王统");
    expect(result.lines.join(" ")).not.toContain("长期维持政权");
    expect(result.lines.join(" ")).not.toContain("幼年承统，临危承统");
  });

  it("makes restoration after exile the primary life turning point", () => {
    const context = makeContext({
      accession: 0, endMonth: 180,
      events: [
        { id: "exile", year: 12, monthIndex: 12, type: "faction-exiled", targetFactionId: "秦", importance: "major" },
        { id: "restore", year: 132, monthIndex: 132, type: "faction-restored", actorFactionId: "秦", importance: "major" },
      ],
    });
    const result = deriveRulerAssessment(context);
    expect(result.evidence.roles).toContain("RESTORED_FROM_EXILE");
    expect(result.evidence.tenure.restoredExileMonths).toBe(120);
    expect(result.lines.join(" ")).toContain("流亡10年后恢复国家");
  });

  it("does not award STEWARD for years spent in exile and keeps founder battle-death wording grounded", () => {
    const exiled = deriveRulerAssessment(makeContext({
      endMonth: 240,
      events: [{ id: "fall", year: 1, monthIndex: 1, type: "faction-exiled", targetFactionId: "秦", importance: "major" }],
    }));
    expect(exiled.evidence.roles).not.toContain("STEWARD");

    const founder = makeContext({
      endMonth: 60, endReason: "战死", deathCause: "战死", factionOrigin: { foundingRulerId: "r1", foundedMonth: 0 },
      start: { territoryShare: 0.3, cityCount: 4 },
      end: { territoryShare: 0.28, cityCount: 4 },
    });
    const text = deriveRulerAssessment(founder).lines.join(" ");
    expect(text).toContain("创立势力未久即身死军中");
    expect(text).not.toMatch(/开国未久|整合尚未完成/);
    expect(text).not.toContain("扩张与秩序仍有未竟");
  });

  it("labels a living ruler's assessment as provisional and avoids final verdict language", () => {
    const context = makeContext({ endMonth: 120 });
    context.ruler.endYear = undefined;
    context.ruler.status = "ruling";
    const result = deriveRulerAssessment(context);
    expect(result.heading).toBe("在位评议");
    expect(result.lines.join("")).toContain("截至目前");
    expect(result.lines.join("")).not.toMatch(/身后|终亡于其世|盖棺/);
  });

  it("is deterministic and does not use finalized posthumous titles as evidence", () => {
    const first = deriveRulerAssessment(makeContext({ end: { territoryShare: 0.35 }, posthumousEpithet: "武" }));
    const second = deriveRulerAssessment(makeContext({ end: { territoryShare: 0.35 }, posthumousEpithet: "愍" }));
    expect(first.lines).toEqual(deriveRulerAssessment(makeContext({ end: { territoryShare: 0.35 }, posthumousEpithet: "武" })).lines);
    expect(first.evidence.roles).toEqual(second.evidence.roles);
  });

  it("adds a deterministic, evidence-grounded historian voice only for finalized rulers", () => {
    const evidence = deriveRulerHistoricalEvidence(makeContext({
      start: { territoryShare: 0.2 }, end: { territoryShare: 0.4, cityCount: 7 }, peakTerritory: 0.42,
    }));
    const voice = composeHistorianVoice(evidence);
    expect(voice).toBeTruthy();
    expect(composeHistorianVoice(evidence)).toBe(voice);
    expect(voice).not.toMatch(/贤明|昏庸|刚愎|好大喜功|仁慈|残暴|民心尽失|聪慧/);

    const livingContext = makeContext({ end: { territoryShare: 0.4, cityCount: 7 } });
    livingContext.ruler.endYear = undefined;
    expect(composeHistorianVoice(deriveRulerHistoricalEvidence(livingContext))).toBeUndefined();
  });

  it("does not attribute expansion costs to a founder-expander without cost evidence", () => {
    const context = makeContext({
      start: { population: 40, territoryShare: 0.2, cityCount: 3, stability: 75 },
      end: { population: 42, territoryShare: 0.4, cityCount: 7, stability: 78 },
      peakTerritory: 0.4,
      factionOrigin: { foundingRulerId: "r1" },
    });
    const evidence = deriveRulerHistoricalEvidence(context);
    const voice = composeHistorianVoice(evidence)!;
    expect(evidence.roles).toContain("FOUNDER");
    expect(evidence.roles).toContain("EXPANDER");
    expect(evidence.governanceCost).toBe(false);
    expect(voice).not.toMatch(/代价|患|失衡|收束困难/);
    expect(composeHistorianVoice(evidence)).toBe(voice);
  });

  it("permits founder-expansion cost language only when governanceCost is evidenced", () => {
    const context = makeContext({
      start: { population: 40, territoryShare: 0.2, cityCount: 3, stability: 80 },
      end: { population: 20, territoryShare: 0.4, cityCount: 7, stability: 55 },
      peakTerritory: 0.4,
      factionOrigin: { foundingRulerId: "r1" },
    });
    const evidence = deriveRulerHistoricalEvidence(context);
    expect(evidence.governanceCost).toBe(true);
    expect(composeHistorianVoice(evidence)).toMatch(/代价|患/);
  });

  it("allows deterministic wording variants for rulers with the same role", () => {
    const makeVoice = (id: string) => {
      const context = makeContext({ end: { territoryShare: 0.4, cityCount: 7 }, start: { territoryShare: 0.2 } });
      context.ruler.id = id;
      return composeHistorianVoice(deriveRulerHistoricalEvidence(context));
    };
    expect(new Set(["a", "b", "c", "d", "e"].map(makeVoice)).size).toBeGreaterThan(1);
  });

  it("provides five stable deterministic variants for common voice roles", () => {
    const voices = Array.from({ length: 40 }, (_, index) => {
      const context = makeContext({
        start: { territoryShare: 0.1, cityCount: 2, stability: 70 },
        end: { territoryShare: 0.25, cityCount: 5, stability: 72 },
      });
      context.ruler.id = `expander-variant-${index}`;
      return composeHistorianVoice(deriveRulerHistoricalEvidence(context));
    });
    expect(new Set(voices).size).toBe(5);
    expect(new Set(voices)).toEqual(new Set(voices));
  });

  it("uses only objective accession-age bands", () => {
    expect([formatAccessionAge(7), formatAccessionAge(14), formatAccessionAge(52), formatAccessionAge(68)]).toEqual([
      "7岁幼年即位。", "14岁少年即位。", "52岁即位。", "68岁晚年即位。",
    ]);
  });

  it("does not alter the e2 combat, playback, or save-schema baseline", () => {
    expect(CITY_BASE_MAX_DEFENSE).toBe(5);
    expect(CITY_SIEGE_DAMAGE_INTERVAL_MONTHS).toBe(2);
    expect(CITY_SIEGE_DAMAGE_PER_TICK).toBe(1);
    expect(CITY_CAPTURED_DEFENSE_RATIO).toBe(0.35);
    expect(FORTIFIED_ZONE_TIERS.map(({ minDefense, maxDefense }) => [minDefense, maxDefense])).toEqual([
      [1, 6], [7, 8], [9, 10], [11, 99],
    ]);
    expect(SIMULATION_SPEEDS).toEqual([1, 2, 4]);
    expect(BASE_PLAY_RATE).toBe(2);
    expect(CURRENT_SAVE_SCHEMA_VERSION).toBe(7);
  });
});
