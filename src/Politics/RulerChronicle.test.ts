import { describe, expect, it } from "vitest";
import {
  buildRulerTags,
  createRulerChronicle,
  finishRulerChronicle,
  getRulerTerritoryDelta,
  getRulerHistoricalEvents,
  recordPersonalCityCapture,
} from "./RulerChronicle";
import { deriveRulerHistoricalEvidence, formatAccessionAge } from "./RulerHistoriography";
import { yearsToMonths } from "../Simulation/WorldTime";

describe("ruler chronicle", () => {
  it("includes a structured heir-death event in the parent's notable history", () => {
    const event = {
      id: "heir-death",
      year: 50,
      monthIndex: 50,
      category: "politics" as const,
      type: "heir-died" as const,
      title: "储君姬衡去世",
      actorFactionId: "燕",
      rulerId: "parent",
      metadata: { parentRulerId: "parent", heirName: "姬衡", age: 23, reason: "natural" },
      importance: "normal" as const,
    };
    expect(getRulerHistoricalEvents([event], { id: "parent", accessionYear: 10 }, "燕", 100, [event.id]))
      .toEqual([event]);
  });

  it("uses objective accession-age context bands", () => {
    expect(formatAccessionAge(7)).toContain("幼年即位");
    expect(formatAccessionAge(14)).toContain("少年即位");
    expect(formatAccessionAge(52)).toBe("52岁即位。");
    expect(formatAccessionAge(68)).toContain("晚年即位");
  });

  it("records personal captures without inventing a death location", () => {
    const chronicle = createRulerChronicle({ month: 0, population: 10, territoryShare: 0.2, cityCount: 2, stability: 70 });
    recordPersonalCityCapture(chronicle, "capture-event");
    expect(chronicle.citiesCapturedPersonally).toBe(1);
    expect(chronicle.notableEventIds).toEqual(["capture-event"]);
    expect(chronicle.deathCityId).toBeUndefined();
  });
  it("keeps accession and end snapshots", () => {
    const chronicle = createRulerChronicle({
      month: 0,
      population: 10,
      territoryShare: 0.12,
      cityCount: 1,
      stability: 80,
    });

    finishRulerChronicle(chronicle, {
      month: 120,
      population: 24,
      territoryShare: 0.28,
      cityCount: 3,
      stability: 72,
    });

    expect(chronicle.accessionSnapshot.population).toBe(10);
    expect(chronicle.endSnapshot?.population).toBe(24);
    expect(getRulerTerritoryDelta(chronicle)).toBeCloseTo(0.16);
  });

  it("keeps historical snapshots fixed after later world changes", () => {
    const chronicle = createRulerChronicle({
      month: 0,
      population: 10,
      territoryShare: 0.12,
      cityCount: 1,
      stability: 80,
    });
    finishRulerChronicle(chronicle, {
      month: 24,
      population: 2,
      territoryShare: 0.04,
      cityCount: 0,
      stability: 0,
    });

    const afterOneHundredYears = {
      population: 1000,
      territoryShare: 0.9,
      cityCount: 12,
      stability: 90,
    };

    expect(afterOneHundredYears.population).toBe(1000);
    expect(chronicle.endSnapshot?.population).toBe(2);
    expect(chronicle.endSnapshot?.cityCount).toBe(0);
    expect(chronicle.accessionSnapshot.population).toBe(10);
  });

  it("creates fact-based tags for conquerors", () => {
    const evidence = createTagEvidence({
      start: { territoryShare: 0.12, cityCount: 1, stability: 72 },
      end: { territoryShare: 0.31, cityCount: 4, stability: 64 },
      captures: 2,
      months: yearsToMonths(18),
    });
    expect(buildRulerTags(evidence)).toEqual([
      "开疆",
      "征服者",
    ]);
  });

  it("records emperor proclamation as a fact tag without temple names", () => {
    const evidence = createTagEvidence({ months: 300, proclaimedEmperorMonth: 240 });
    expect(buildRulerTags(evidence)).toContain("称帝");
    expect(buildRulerTags(evidence)).not.toContain("太祖");
  });

  it("builds decline tags from stored facts", () => {
    const evidence = createTagEvidence({
      start: { territoryShare: 0.18, cityCount: 3, stability: 80 },
      end: { territoryShare: 0.08, cityCount: 1, stability: 42 },
      months: yearsToMonths(12), rebellions: 1, endReason: "流亡",
    });
    expect(buildRulerTags(evidence)).toContain("国势衰退");
  });

  it("does not tag positive territory delta as decline", () => {
    const evidence = createTagEvidence({
      start: { territoryShare: 0.157, cityCount: 1, stability: 60 },
      end: { territoryShare: 0.211, cityCount: 1, stability: 62 },
      months: yearsToMonths(8),
    });
    const tags = buildRulerTags(evidence);
    expect(tags).not.toContain("国势衰退");
  });

  it("keeps EXPANDER, DECLINER, and STEWARD tags aligned with historiography roles", () => {
    const smallGain = createTagEvidence({
      start: { territoryShare: 0.082, cityCount: 2 },
      end: { territoryShare: 0.117, cityCount: 2 },
    });
    expect(smallGain.roles).not.toContain("EXPANDER");
    expect(buildRulerTags(smallGain)).not.toContain("开疆");

    const expander = createTagEvidence({ start: { territoryShare: 0.2 }, end: { territoryShare: 0.34, cityCount: 5 } });
    expect(buildRulerTags(expander)).toContain("开疆");
    const steward = createTagEvidence({
      months: yearsToMonths(20),
      start: { stability: 78, territoryShare: 0.2 },
      end: { stability: 80, territoryShare: 0.22 },
    });
    expect(steward.roles).toContain("STEWARD");
    expect(buildRulerTags(steward)).toContain("守成");
  });

  it("selects direct canonical ruler events in reign order without duplicate groups", () => {
    const events = [
      { id: "late", year: 30, monthIndex: 30, type: "city-captured", importance: "major", title: "秦攻陷安邑", factionIds: ["秦"], rulerId: "r1", historyGroupId: "g1" },
      { id: "duplicate", year: 30, monthIndex: 30, type: "capital-fallen", importance: "major", title: "安邑陷落", factionIds: ["秦"], rulerId: "r1", historyGroupId: "g1" },
      { id: "early", year: 10, monthIndex: 10, type: "state-founded", importance: "major", title: "秦正式建国", factionIds: ["秦"], rulerId: "r1" },
      { id: "other", year: 20, monthIndex: 20, type: "city-captured", importance: "major", title: "楚攻城", factionIds: ["楚"], rulerId: "r2" },
    ] as any;
    const selected = getRulerHistoricalEvents(events, { id: "r1", accessionYear: 0, endYear: 40 }, "秦", 40, []);
    expect(selected.map((event) => event.id)).toEqual(["early", "duplicate"]);
  });

  it("keeps a founding milestone when earlier wars would otherwise fill the six slots", () => {
    const wars = Array.from({ length: 6 }, (_, index) => ({
      id: `war-${index}`,
      year: index + 1,
      monthIndex: index + 1,
      type: "city-captured",
      importance: "major",
      title: `攻陷${index}`,
      factionIds: ["秦"],
      rulerId: "r1",
    }));
    const selected = getRulerHistoricalEvents(
      [...wars, {
        id: "founding",
        year: 20,
        monthIndex: 20,
        type: "state-founded",
        importance: "major",
        title: "秦正式建国",
        factionIds: ["秦"],
        rulerId: "r1",
      }] as any,
      { id: "r1", accessionYear: 0, endYear: 40 },
      "秦",
      40,
      ["founding"]
    );
    expect(selected.map((event) => event.id)).toContain("founding");
    expect(selected.map((event) => event.monthIndex)).toEqual(
      [...selected].sort((a, b) => (a.monthIndex ?? a.year) - (b.monthIndex ?? b.year)).map((event) => event.monthIndex)
    );
  });
});

function createTagEvidence(options: {
  start?: Partial<{ population: number; territoryShare: number; cityCount: number; stability: number }>;
  end?: Partial<{ population: number; territoryShare: number; cityCount: number; stability: number }>;
  months?: number;
  captures?: number;
  rebellions?: number;
  foundedStateName?: string;
  proclaimedEmperorMonth?: number;
  completedUnification?: boolean;
  endReason?: string;
  events?: any[];
} = {}) {
  const months = options.months ?? 120;
  const start = {
    month: 0, population: 10, territoryShare: 0.2, cityCount: 2, stability: 75,
    ...options.start,
  };
  const end = {
    month: months, population: start.population, territoryShare: start.territoryShare,
    cityCount: start.cityCount, stability: start.stability, ...options.end,
  };
  const chronicle = createRulerChronicle(start);
  chronicle.citiesCapturedPersonally = options.captures ?? 0;
  chronicle.rebellionsDuringReign = options.rebellions ?? 0;
  chronicle.foundedStateName = options.foundedStateName;
  chronicle.proclaimedEmperorMonth = options.proclaimedEmperorMonth;
  chronicle.completedUnification = options.completedUnification ?? false;
  finishRulerChronicle(chronicle, end, options.endReason === "战死" ? "战死" : undefined);
  const ruler: any = {
    id: "tag-ruler", houseName: "嬴氏", givenName: "平", bornYear: -360,
    accessionYear: 0, endYear: months, endReason: options.endReason,
    status: "dead", chronicle,
  };
  return deriveRulerHistoricalEvidence({
    ruler, dynasty: { rulers: [ruler] }, faction: { name: "秦" },
    events: options.events ?? [], worldMonth: months,
  });
}
