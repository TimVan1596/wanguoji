import { describe, expect, it } from "vitest";
import { createRulerChronicle, finishRulerChronicle } from "./RulerChronicle";
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
  factionOrigin?: { foundingRulerId?: string };
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
    faction: { name: "秦", origin: options.factionOrigin },
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
    expect(deriveRulerAssessment(parent).lines.join("")).toContain("储嗣先于其父君去世");
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
      endMonth: 60, endReason: "战死", deathCause: "战死", factionOrigin: { foundingRulerId: "r1" },
      start: { territoryShare: 0.3, cityCount: 4 },
      end: { territoryShare: 0.28, cityCount: 4 },
    });
    const text = deriveRulerAssessment(founder).lines.join(" ");
    expect(text).toContain("开国未久而身死军中");
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
    expect(CURRENT_SAVE_SCHEMA_VERSION).toBe(1);
  });
});
