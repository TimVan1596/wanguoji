import { describe, expect, it } from "vitest";
import {
  buildRulerAssessment,
  buildRulerTags,
  createRulerChronicle,
  finishRulerChronicle,
  getRulerTerritoryDelta,
  getRulerHistoricalEvents,
} from "./RulerChronicle";
import { yearsToMonths } from "../Simulation/WorldTime";

describe("ruler chronicle", () => {
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
    const chronicle = createRulerChronicle({
      month: 0,
      population: 10,
      territoryShare: 0.12,
      cityCount: 1,
      stability: 72,
    });
    chronicle.citiesCapturedPersonally = 2;
    finishRulerChronicle(chronicle, {
      month: yearsToMonths(18),
      population: 30,
      territoryShare: 0.31,
      cityCount: 4,
      stability: 64,
    });

    expect(buildRulerTags(chronicle, yearsToMonths(18))).toEqual([
      "开疆",
      "征服者",
    ]);
  });

  it("records emperor proclamation as a fact tag without temple names", () => {
    const chronicle = createRulerChronicle({
      month: 0,
      population: 10,
      territoryShare: 0.2,
      cityCount: 2,
      stability: 80,
    });
    chronicle.proclaimedEmperorMonth = 240;
    expect(buildRulerTags(chronicle, 300)).toContain("称帝");
    expect(buildRulerTags(chronicle, 300)).not.toContain("太祖");
  });

  it("writes assessments from stored facts", () => {
    const chronicle = createRulerChronicle({
      month: 0,
      population: 10,
      territoryShare: 0.18,
      cityCount: 3,
      stability: 80,
    });
    chronicle.rebellionsDuringReign = 1;
    finishRulerChronicle(
      chronicle,
      {
        month: yearsToMonths(12),
        population: 8,
        territoryShare: 0.08,
        cityCount: 1,
        stability: 42,
      },
      "流亡"
    );

    expect(buildRulerTags(chronicle, yearsToMonths(12))).toContain("国势衰退");
    expect(buildRulerAssessment("田安", chronicle, yearsToMonths(12)).join("")).toContain(
      "国势衰退"
    );
  });

  it("does not describe positive territory delta as decline", () => {
    const chronicle = createRulerChronicle({
      month: 0,
      population: 9,
      territoryShare: 0.157,
      cityCount: 1,
      stability: 60,
    });
    finishRulerChronicle(chronicle, {
      month: yearsToMonths(8),
      population: 17,
      territoryShare: 0.211,
      cityCount: 1,
      stability: 62,
    });

    const tags = buildRulerTags(chronicle, yearsToMonths(8));
    const assessment = buildRulerAssessment("魏昭", chronicle, yearsToMonths(8)).join("");
    expect(tags).not.toContain("国势衰退");
    expect(assessment).toContain("增至21.1%");
    expect(assessment).not.toContain("降至");
  });

  it("selects direct canonical ruler events in reign order without duplicate groups", () => {
    const events = [
      { id: "late", year: 30, monthIndex: 30, type: "city-captured", importance: "major", title: "秦攻陷安邑", factionIds: ["秦"], rulerId: "r1", historyGroupId: "g1" },
      { id: "duplicate", year: 30, monthIndex: 30, type: "capital-fallen", importance: "major", title: "安邑陷落", factionIds: ["秦"], rulerId: "r1", historyGroupId: "g1" },
      { id: "early", year: 10, monthIndex: 10, type: "state-founded", importance: "major", title: "秦正式建国", factionIds: ["秦"], rulerId: "r1" },
      { id: "other", year: 20, monthIndex: 20, type: "city-captured", importance: "major", title: "楚攻城", factionIds: ["楚"], rulerId: "r2" },
    ] as any;
    const selected = getRulerHistoricalEvents(events, { id: "r1", accessionYear: 0, endYear: 40 }, "秦", 40, []);
    expect(selected.map((event) => event.id)).toEqual(["early", "late"]);
  });
});
