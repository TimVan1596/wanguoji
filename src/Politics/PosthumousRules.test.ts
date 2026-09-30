import { afterEach, describe, expect, it } from "vitest";
import type Team from "../Components/Team";
import WorldHistory from "../History/WorldHistory";
import type { Ruler } from "./Dynasty";
import {
  deriveImperialOrdinal,
  evaluatePosthumousNames,
  finalizeRulerPosthumousNames,
  formatPosthumousRulerName,
  getPosthumousLabelLines,
} from "./PosthumousRules";
import { buildRulerLegacyEvidence } from "./RulerLegacyEvidence";
import { createRulerChronicle, finishRulerChronicle } from "./RulerChronicle";

function faction(overrides: Partial<Team> = {}) {
  return {
    name: "阳",
    displayName: "阳",
    identityStage: "STATE",
    stateFoundedMonth: 10,
    sovereigntyRank: "EMPEROR",
    sovereigntyHistory: [
      { rank: "KING", startMonth: 10, endMonth: 99 },
      { rank: "EMPEROR", startMonth: 100 },
    ],
    nameHistory: [{ name: "阳", startMonth: 10, reason: "state" }],
    ...overrides,
  } as Team;
}

function ruler(overrides: Partial<Ruler> = {}): Ruler {
  const chronicle = createRulerChronicle({
    month: 10,
    population: 20,
    territoryShare: 0.2,
    cityCount: 2,
    stability: 70,
  });
  finishRulerChronicle(chronicle, {
    month: 140,
    population: 120,
    territoryShare: 0.55,
    cityCount: 8,
    stability: 82,
  });
  return {
    id: "r1",
    houseName: "赵氏",
    givenName: "子宣",
    bornYear: -300,
    accessionYear: 10,
    endYear: 140,
    reignOrdinal: 1,
    status: "dead",
    chronicle,
    ...overrides,
  };
}

function rulerWithReign(
  id: string,
  accessionYear: number,
  endYear: number,
  start: { territoryShare: number; cityCount: number; stability: number },
  end: { territoryShare: number; cityCount: number; stability: number },
  overrides: Partial<Ruler> = {}
): Ruler {
  const chronicle = createRulerChronicle({ month: accessionYear, population: 40, ...start });
  finishRulerChronicle(chronicle, { month: endYear, population: 50, ...end });
  return ruler({ id, accessionYear, endYear, chronicle, ...overrides });
}

describe("posthumous rules", () => {
  afterEach(() => WorldHistory.reset());

  it("treats demographic collapse and stability loss as governance cost, not structural disorder", () => {
    const chronicle = createRulerChronicle({ month: 0, population: 15, territoryShare: 0.169, cityCount: 1, stability: 100 });
    finishRulerChronicle(chronicle, { month: 18 * 12 + 6, population: 4, territoryShare: 0.296, cityCount: 6, stability: 72 }, "自然死亡");
    const candidate = ruler({ accessionYear: 0, endYear: 18 * 12 + 6, chronicle, endReason: "自然死亡" });
    const evidence = buildRulerLegacyEvidence(chronicle, candidate.accessionYear!, candidate.endYear, candidate.endReason);
    const result = evaluatePosthumousNames(candidate, [], faction(), candidate.endYear!);
    expect(evidence.majorExpansion).toBe(true);
    expect(evidence.demographicCollapse).toBe(true);
    expect(evidence.governanceCost).toBe(true);
    expect(evidence.majorDisorder).toBe(false);
    expect(result.posthumousEpithet).not.toBe("灵");
    expect(result.posthumousEpithet).toBe("襄");
  });

  it("allows Ling only with long deterioration and structural disorder evidence", () => {
    const chronicle = createRulerChronicle({ month: 0, population: 30, territoryShare: 0.4, cityCount: 8, stability: 90 });
    finishRulerChronicle(chronicle, { month: 20 * 12, population: 22, territoryShare: 0.24, cityCount: 8, stability: 55 }, "自然死亡");
    const candidate = ruler({ accessionYear: 0, endYear: 20 * 12, chronicle, endReason: "自然死亡" });
    expect(evaluatePosthumousNames(candidate, [], faction(), candidate.endYear!).posthumousEpithet).toBe("灵");
  });

  it("favors military epithet for personal conquest and Xiang for expansion without personal capture", () => {
    const militaryChronicle = createRulerChronicle({ month: 0, population: 20, territoryShare: 0.2, cityCount: 3, stability: 70 });
    finishRulerChronicle(militaryChronicle, { month: 12 * 12, population: 30, territoryShare: 0.25, cityCount: 6, stability: 74 });
    militaryChronicle.citiesCapturedPersonally = 4;
    const military = ruler({ accessionYear: 0, endYear: 12 * 12, chronicle: militaryChronicle });
    const militaryResult = evaluatePosthumousNames(military, [], faction(), military.endYear!);
    expect(militaryResult.posthumousEpithet).toBe("武");
    expect(militaryResult.epithetReasons).toContain("亲征夺城有据");
    expect(militaryResult.epithetReasons).toContain("有亲征夺城或统一战功");

    const expansionChronicle = createRulerChronicle({ month: 0, population: 15, territoryShare: 0.2, cityCount: 2, stability: 75 });
    finishRulerChronicle(expansionChronicle, { month: 12 * 12, population: 18, territoryShare: 0.35, cityCount: 6, stability: 76 });
    const expansion = ruler({ accessionYear: 0, endYear: 12 * 12, chronicle: expansionChronicle });
    expect(evaluatePosthumousNames(expansion, [], faction(), expansion.endYear!).posthumousEpithet).toBe("襄");
  });

  it("does not call minor territory loss plus stability decline alone disorder", () => {
    const candidate = ruler({
      accessionYear: 0,
      endYear: 21 * 12 + 8,
      chronicle: (() => {
        const chronicle = createRulerChronicle({
          month: 0,
          population: 1,
          territoryShare: 0.107,
          cityCount: 2,
          stability: 95,
        });
        finishRulerChronicle(chronicle, {
          month: 21 * 12 + 8,
          population: 2,
          territoryShare: 0.104,
          cityCount: 2,
          stability: 64,
        });
        chronicle.citiesCapturedPersonally = 3;
        chronicle.citiesLostDuringReign = 4;
        chronicle.deathCause = "战死";
        return chronicle;
      })(),
    });
    expect(evaluatePosthumousNames(candidate, [], faction(), candidate.endYear!).posthumousEpithet).not.toBe("灵");
  });
  it("does not evaluate active or provisional leaders", () => {
    expect(evaluatePosthumousNames(ruler({ endYear: undefined }), [], faction(), 140).posthumousEpithet).toBeUndefined();
    expect(
      evaluatePosthumousNames(
        ruler(),
        [],
        faction({
          identityStage: "PROVISIONAL",
          stateFoundedMonth: undefined,
          sovereigntyRank: "LEADER",
          sovereigntyHistory: [{ rank: "LEADER", startMonth: 0 }],
        }),
        40
      ).posthumousEpithet
    ).toBeUndefined();
  });

  it("grants epithet and rare temple name to major formal rulers after death", () => {
    const major = ruler();
    major.chronicle!.foundedStateName = "阳";
    major.chronicle!.proclaimedEmperorMonth = 100;
    finalizeRulerPosthumousNames(major, [major], faction(), 140);
    expect(major.posthumousEpithet).toBeDefined();
    expect(major.posthumousEpithetReasons?.[0]).toBeTruthy();
    expect(major.templeName).toBe("太祖");
    expect(major.templeNameReasons?.[0]).toContain("开国");
    expect(formatPosthumousRulerName(major, faction(), 140)).toContain("阳太祖");
  });

  it("keeps temple names unique within one dynasty", () => {
    const first = ruler({ id: "r1" });
    first.chronicle!.foundedStateName = "阳";
    first.templeName = "太祖";
    const second = ruler({ id: "r2", givenName: "昭", accessionYear: 150, endYear: 280 });
    second.chronicle!.foundedStateName = "阳";
    second.chronicle!.proclaimedEmperorMonth = 180;
    finalizeRulerPosthumousNames(second, [first, second], faction(), 280);
    expect(second.templeName).not.toBe("太祖");
  });

  it("soft-dedupes repeated posthumous epithets in recent dynasty memory", () => {
    const previous = Array.from({ length: 3 }, (_, index) =>
      ruler({
        id: `old-${index}`,
        givenName: `旧${index}`,
        posthumousEpithet: "烈",
      })
    );
    const current = ruler({ id: "new", givenName: "武" });
    current.endReason = "战死";
    current.chronicle!.deathCause = "战死";
    finalizeRulerPosthumousNames(current, [...previous, current], faction(), 140);
    expect(current.posthumousEpithet).toBeDefined();
    expect(current.posthumousEpithet).not.toBe("烈");
  });

  it("lets 哀 lead for a child ruler with a short, terminal reign, while adults receive 愍", () => {
    const childChronicle = createRulerChronicle({ month: 0, population: 20, territoryShare: 0.2, cityCount: 3, stability: 70 });
    finishRulerChronicle(childChronicle, { month: 24, population: 1, territoryShare: 0.01, cityCount: 0, stability: 10 }, "彻底灭亡");
    const child = ruler({ id: "child", bornYear: -6 * 12, accessionYear: 0, endYear: 24, endReason: "彻底灭亡", chronicle: childChronicle });
    expect(evaluatePosthumousNames(child, [child], faction(), 24).posthumousEpithet).toBe("哀");

    const adult = ruler({ id: "adult-crisis", bornYear: -30 * 12, accessionYear: 0, endYear: 24, endReason: "彻底灭亡", chronicle: childChronicle });
    expect(evaluatePosthumousNames(adult, [adult], faction(), 24).posthumousEpithet).toBe("愍");
  });

  it("does not assign 哀 to an ordinary short peaceful reign", () => {
    const short = rulerWithReign("short-quiet", 0, 18, { territoryShare: 0.2, cityCount: 3, stability: 75 }, { territoryShare: 0.2, cityCount: 3, stability: 75 }, { endReason: "去世" });
    expect(evaluatePosthumousNames(short, [short], faction(), short.endYear!).posthumousEpithet).not.toBe("哀");
  });

  it("offers 顺 for long peaceful stewardship without expansion or repeated capital loss", () => {
    const calm = rulerWithReign("calm", 0, 25 * 12, { territoryShare: 0.22, cityCount: 4, stability: 78 }, { territoryShare: 0.22, cityCount: 4, stability: 82 });
    const result = evaluatePosthumousNames(calm, [calm], faction(), calm.endYear!);
    expect(result.posthumousEpithet).toBe("顺");
    expect(result.epithetReasons).toContain("长期守成，政局和顺");
  });

  it("does not call a repeatedly displaced reign 顺", () => {
    const calm = rulerWithReign("displaced", 0, 25 * 12, { territoryShare: 0.22, cityCount: 4, stability: 78 }, { territoryShare: 0.22, cityCount: 4, stability: 82 });
    WorldHistory.addCapitalRelocated(24, "阳", "新都甲", "city-a", "fall-a", { cause: "CAPITAL_FALL" });
    WorldHistory.addCapitalRelocated(48, "阳", "新都乙", "city-b", "fall-b", { cause: "CAPITAL_FALL" });
    expect(evaluatePosthumousNames(calm, [calm], faction(), calm.endYear!).posthumousEpithet).not.toBe("顺");
  });

  it("allows 桓 to compete with 襄 for territorial expansion without personal captures", () => {
    const expanding = rulerWithReign("expanding", 0, 15 * 12, { territoryShare: 0.1, cityCount: 2, stability: 72 }, { territoryShare: 0.28, cityCount: 5, stability: 75 });
    const recentXiang = [0, 1, 2].map((index) => ruler({ id: `xiang-${index}`, posthumousEpithet: "襄" }));
    expect(evaluatePosthumousNames(expanding, [...recentXiang, expanding], faction(), expanding.endYear!).posthumousEpithet).toBe("桓");
  });

  it("allows 威 to compete when personal military evidence is present", () => {
    const military = rulerWithReign("military", 0, 12 * 12, { territoryShare: 0.2, cityCount: 3, stability: 70 }, { territoryShare: 0.24, cityCount: 4, stability: 72 });
    military.chronicle!.citiesCapturedPersonally = 2;
    expect(evaluatePosthumousNames(military, [military], faction(), military.endYear!).posthumousEpithet).toBe("威");
  });

  it("uses graduated frequency and recency penalties, but permits an exceptional fit", () => {
    const ordinaryExpansion = rulerWithReign("ordinary-expansion", 0, 15 * 12,
      { territoryShare: 0.1, cityCount: 2, stability: 70 }, { territoryShare: 0.25, cityCount: 5, stability: 72 });
    const threeRecentXiang = [0, 1, 2].map((index) => ruler({ id: `recent-${index}`, posthumousEpithet: "襄" }));
    expect(evaluatePosthumousNames(ordinaryExpansion, [...threeRecentXiang, ordinaryExpansion], faction(), ordinaryExpansion.endYear!).posthumousEpithet).not.toBe("襄");

    const exceptional = rulerWithReign("exceptional", 0, 20 * 12,
      { territoryShare: 0.1, cityCount: 2, stability: 70 }, { territoryShare: 0.42, cityCount: 7, stability: 75 });
    const longRecentRun = Array.from({ length: 8 }, (_, index) => ruler({ id: `repeat-${index}`, posthumousEpithet: "襄" }));
    expect(evaluatePosthumousNames(exceptional, [...longRecentRun, exceptional], faction(), exceptional.endYear!).posthumousEpithet).toBe("襄");
  });

  it("does not introduce unsupported 献 and records evidence-based new epithet reasons", () => {
    const expansion = rulerWithReign("huan", 0, 15 * 12, { territoryShare: 0.1, cityCount: 2, stability: 70 }, { territoryShare: 0.28, cityCount: 5, stability: 75 });
    const candidates = evaluatePosthumousNames(expansion, [expansion], faction(), expansion.endYear!);
    expect(candidates.posthumousEpithet).not.toBe("献");
    expect(["襄", "桓"]).toContain(candidates.posthumousEpithet);
    expect(candidates.epithetReasons.length).toBeGreaterThan(0);
  });

  it("explains posthumous names with reasons from the selected rule", () => {
    const major = ruler();
    major.chronicle!.foundedStateName = "阳";
    major.chronicle!.proclaimedEmperorMonth = 100;
    finalizeRulerPosthumousNames(major, [major], faction(), 140);
    const lines = getPosthumousLabelLines(major, faction(), 140);
    expect(lines.join(" / ")).toContain("庙号：太祖");
    expect(lines.join(" / ")).toContain("开国并建立帝号");
    expect(lines.join(" / ")).toContain("谥号：");
  });

  it("can assign tragic epithets for rulers ending in dynasty crisis", () => {
    const chronicle = createRulerChronicle({
      month: 10,
      population: 50,
      territoryShare: 0.32,
      cityCount: 4,
      stability: 75,
    });
    finishRulerChronicle(chronicle, {
      month: 36,
      population: 3,
      territoryShare: 0.02,
      cityCount: 0,
      stability: 18,
    }, "被俘处死");
    const tragic = ruler({
      id: "tragic",
      accessionYear: 10,
      endYear: 36,
      endReason: "被俘处死",
      chronicle,
    });
    finalizeRulerPosthumousNames(tragic, [tragic], faction(), 36);
    expect(["愍", "哀", "厉", "灵"]).toContain(tragic.posthumousEpithet);
    expect(tragic.posthumousEpithetReasons?.[0]).toBeTruthy();
  });

  it("does not grant an epithet from reign duration alone but recognizes a long stable emperor", () => {
    const chronicle = createRulerChronicle({
      month: 0,
      population: 50,
      territoryShare: 0.3,
      cityCount: 4,
      stability: 76,
    });
    finishRulerChronicle(chronicle, {
      month: 32 * 12,
      population: 50,
      territoryShare: 0.3,
      cityCount: 4,
      stability: 76,
    });
    const quiet = ruler({
      id: "quiet",
      accessionYear: 0,
      endYear: 32 * 12,
      chronicle,
    });
    finalizeRulerPosthumousNames(quiet, [quiet], faction(), 32 * 12);
    expect(quiet.posthumousEpithet).toBe("顺");
    expect(["世祖", "高宗", "成宗", "世宗"]).toContain(quiet.templeName);
  });

  it("grants temple eligibility to the first emperor even below the old score cutoff", () => {
    const chronicle = createRulerChronicle({ month: 0, population: 30, territoryShare: 0.3, cityCount: 5, stability: 95 });
    chronicle.proclaimedEmperorMonth = 20;
    finishRulerChronicle(chronicle, { month: 35 * 12 + 3, population: 28, territoryShare: 0.3, cityCount: 5, stability: 90 }, "战死");
    const candidate = ruler({ id: "first-emperor", accessionYear: 0, endYear: 35 * 12 + 3, reignOrdinal: 1, chronicle });
    expect(evaluatePosthumousNames(candidate, [], faction(), candidate.endYear!).score).toBeLessThan(70);
    expect(evaluatePosthumousNames(candidate, [], faction(), candidate.endYear!).templeName).toBeDefined();
  });

  it("offers role-based temple names to a long successful later emperor, but not an ordinary short reign", () => {
    const long = ruler({ id: "long-emperor", accessionYear: 0, endYear: 30 * 12, reignOrdinal: 3 });
    expect(["高宗", "成宗", "世宗", "太宗", "景宗", "宣宗"]).toContain(
      evaluatePosthumousNames(long, [], faction(), long.endYear!).templeName
    );
    const ordinary = ruler({ id: "ordinary", reignOrdinal: 4 });
    expect(evaluatePosthumousNames(ordinary, [], faction(), ordinary.endYear!).templeName).toBeUndefined();
  });

  it("reserves Chengzu for a major second-founding restoration role", () => {
    const chronicle = createRulerChronicle({ month: 0, population: 40, territoryShare: 0.1, cityCount: 2, stability: 58 });
    chronicle.proclaimedEmperorMonth = 20;
    chronicle.restorationsDuringReign = 1;
    finishRulerChronicle(chronicle, { month: 30 * 12, population: 80, territoryShare: 0.44, cityCount: 8, stability: 82 });
    const restorer = ruler({ id: "restorer", accessionYear: 0, endYear: 30 * 12, reignOrdinal: 2, chronicle });
    const usedRoles = ["世祖", "中宗", "世宗", "高祖"].map((templeName, index) =>
      ruler({ id: `used-${index}`, templeName })
    );
    finalizeRulerPosthumousNames(restorer, [...usedRoles, restorer], faction(), restorer.endYear!);
    expect(restorer.templeName).toBe("成祖");

    const ordinary = ruler({ id: "ordinary-expander", accessionYear: 0, endYear: 30 * 12, reignOrdinal: 2 });
    ordinary.chronicle!.endSnapshot!.month = 30 * 12;
    expect(evaluatePosthumousNames(ordinary, [], faction(), ordinary.endYear!).templeName).not.toBe("成祖");
  });

  it("keeps a unique fallback when a dynasty already used a temple role name", () => {
    const first = ruler({ id: "r1" });
    first.chronicle!.foundedStateName = "阳";
    first.templeName = "太祖";
    const second = ruler({ id: "r2", accessionYear: 150, endYear: 280 });
    second.chronicle!.foundedStateName = "阳";
    second.chronicle!.proclaimedEmperorMonth = 180;
    finalizeRulerPosthumousNames(second, [first, second], faction(), 280);
    expect(second.templeName).toBe("高祖");
    expect(second.templeName).not.toBe("成祖");
  });

  it("prefers Taizu/Gaozu for a state founder who also establishes imperial rule", () => {
    const founder = ruler();
    founder.chronicle!.foundedStateName = "阳";
    founder.chronicle!.proclaimedEmperorMonth = 100;
    const result = evaluatePosthumousNames(founder, [founder], faction(), founder.endYear!);
    expect(["太祖", "高祖"]).toContain(result.templeName);
    expect(result.templeName).not.toBe("世祖");
  });

  it("gives the first emperor of a multi-generation kingdom a founding role, not Gaozong", () => {
    const kings = [
      rulerWithReign("king-1", 0, 40, { territoryShare: 0.2, cityCount: 2, stability: 70 }, { territoryShare: 0.2, cityCount: 2, stability: 70 }, { reignOrdinal: 1 }),
      rulerWithReign("king-2", 41, 99, { territoryShare: 0.2, cityCount: 2, stability: 70 }, { territoryShare: 0.2, cityCount: 2, stability: 70 }, { reignOrdinal: 2 }),
    ];
    const firstEmperor = rulerWithReign(
      "first-emperor-generation-3", 100, 100 + 35 * 12,
      { territoryShare: 0.2, cityCount: 2, stability: 70 },
      { territoryShare: 0.38, cityCount: 7, stability: 82 },
      { reignOrdinal: 3 }
    );
    firstEmperor.chronicle!.proclaimedEmperorMonth = 120;
    const empire = faction({ sovereigntyHistory: [
      { rank: "KING", startMonth: 0, endMonth: 99 },
      { rank: "EMPEROR", startMonth: 100 },
    ] });
    expect(deriveImperialOrdinal(firstEmperor, [...kings, firstEmperor], empire)).toBe(1);
    expect(evaluatePosthumousNames(firstEmperor, [...kings, firstEmperor], empire, firstEmperor.endYear!).templeName).toBe("世祖");
  });

  it("uses imperial ordinal rather than reign ordinal for a meritorious second emperor", () => {
    const firstEmperor = rulerWithReign(
      "emperor-1", 0, 100,
      { territoryShare: 0.2, cityCount: 3, stability: 75 },
      { territoryShare: 0.25, cityCount: 4, stability: 78 },
      { reignOrdinal: 3 }
    );
    firstEmperor.chronicle!.proclaimedEmperorMonth = 10;
    const secondEmperor = rulerWithReign(
      "emperor-2", 101, 101 + 20 * 12,
      { territoryShare: 0.25, cityCount: 4, stability: 75 },
      { territoryShare: 0.4, cityCount: 8, stability: 83 },
      { reignOrdinal: 4 }
    );
    const empire = faction({ sovereigntyHistory: [{ rank: "EMPEROR", startMonth: 0 }] });
    expect(deriveImperialOrdinal(secondEmperor, [firstEmperor, secondEmperor], empire)).toBe(2);
    expect(evaluatePosthumousNames(secondEmperor, [firstEmperor, secondEmperor], empire, secondEmperor.endYear!).templeName).toBe("太宗");
  });

  it("does not mechanically call a short, declining second emperor Taizong", () => {
    const firstEmperor = rulerWithReign("emperor-1", 0, 100,
      { territoryShare: 0.3, cityCount: 5, stability: 75 }, { territoryShare: 0.32, cityCount: 5, stability: 78 });
    firstEmperor.chronicle!.proclaimedEmperorMonth = 10;
    const shortSuccessor = rulerWithReign("emperor-2", 101, 101 + 5 * 12,
      { territoryShare: 0.32, cityCount: 5, stability: 70 }, { territoryShare: 0.2, cityCount: 3, stability: 45 });
    const empire = faction({ sovereigntyHistory: [{ rank: "EMPEROR", startMonth: 0 }] });
    expect(deriveImperialOrdinal(shortSuccessor, [firstEmperor, shortSuccessor], empire)).toBe(2);
    expect(evaluatePosthumousNames(shortSuccessor, [firstEmperor, shortSuccessor], empire, shortSuccessor.endYear!).templeName).not.toBe("太宗");
  });

  it("reserves Gaozong for mature imperial expansion and gives mid-dynasty renewal Shizong", () => {
    const first = rulerWithReign("emperor-1", 0, 100,
      { territoryShare: 0.2, cityCount: 3, stability: 70 }, { territoryShare: 0.22, cityCount: 3, stability: 72 });
    first.chronicle!.proclaimedEmperorMonth = 10;
    const second = rulerWithReign("emperor-2", 101, 200,
      { territoryShare: 0.22, cityCount: 3, stability: 72 }, { territoryShare: 0.24, cityCount: 4, stability: 74 });
    const empire = faction({ sovereigntyHistory: [{ rank: "EMPEROR", startMonth: 0 }] });
    const mature = rulerWithReign("emperor-3", 201, 201 + 35 * 12,
      { territoryShare: 0.24, cityCount: 4, stability: 75 }, { territoryShare: 0.4, cityCount: 9, stability: 84 });
    expect(evaluatePosthumousNames(mature, [first, second, mature], empire, mature.endYear!).templeName).toBe("高宗");

    const midRenewal = rulerWithReign("emperor-3b", 201, 201 + 20 * 12,
      { territoryShare: 0.24, cityCount: 4, stability: 60 }, { territoryShare: 0.38, cityCount: 8, stability: 80 });
    expect(evaluatePosthumousNames(midRenewal, [first, second, midRenewal], empire, midRenewal.endYear!).templeName).toBe("世宗");
  });

  it("uses Chengzong for long stable consolidation without major expansion", () => {
    const first = rulerWithReign("emperor-1", 0, 100,
      { territoryShare: 0.2, cityCount: 3, stability: 70 }, { territoryShare: 0.22, cityCount: 3, stability: 74 });
    first.chronicle!.proclaimedEmperorMonth = 10;
    const second = rulerWithReign("emperor-2", 101, 200,
      { territoryShare: 0.22, cityCount: 3, stability: 74 }, { territoryShare: 0.23, cityCount: 3, stability: 77 });
    const stable = rulerWithReign("emperor-3", 201, 201 + 35 * 12,
      { territoryShare: 0.23, cityCount: 3, stability: 78 }, { territoryShare: 0.23, cityCount: 3, stability: 82 });
    const empire = faction({ sovereigntyHistory: [{ rank: "EMPEROR", startMonth: 0 }] });
    expect(evaluatePosthumousNames(stable, [first, second, stable], empire, stable.endYear!).templeName).toBe("成宗");
  });
});
