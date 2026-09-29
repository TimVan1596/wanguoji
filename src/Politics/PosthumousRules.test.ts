import { describe, expect, it } from "vitest";
import type Team from "../Components/Team";
import type { Ruler } from "./Dynasty";
import {
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

describe("posthumous rules", () => {
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
    expect(quiet.posthumousEpithet).toBeUndefined();
    expect(["高宗", "成宗", "世宗"]).toContain(quiet.templeName);
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
});
