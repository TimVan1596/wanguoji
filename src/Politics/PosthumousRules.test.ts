import { describe, expect, it } from "vitest";
import type Team from "../Components/Team";
import type { Ruler } from "./Dynasty";
import {
  evaluatePosthumousNames,
  finalizeRulerPosthumousNames,
  formatPosthumousRulerName,
  getPosthumousLabelLines,
} from "./PosthumousRules";
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

  it("does not grant an epithet from reign duration alone", () => {
    const chronicle = createRulerChronicle({
      month: 0,
      population: 50,
      territoryShare: 0.3,
      cityCount: 4,
      stability: 76,
    });
    finishRulerChronicle(chronicle, {
      month: 32 * 12,
      population: 52,
      territoryShare: 0.302,
      cityCount: 4,
      stability: 77,
    });
    const quiet = ruler({
      id: "quiet",
      accessionYear: 0,
      endYear: 32 * 12,
      chronicle,
    });
    finalizeRulerPosthumousNames(quiet, [quiet], faction(), 32 * 12);
    expect(quiet.posthumousEpithet).toBeUndefined();
    expect(quiet.templeName).toBeUndefined();
  });
});
