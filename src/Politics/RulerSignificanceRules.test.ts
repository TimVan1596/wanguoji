import { describe, expect, it } from "vitest";
import { getRulerSignificanceLabels } from "./RulerSignificanceRules";
import type { Ruler } from "./Dynasty";

function ruler(overrides: Partial<Ruler> = {}): Ruler {
  return {
    id: "r1",
    houseName: "魏氏",
    givenName: "安",
    bornYear: 0,
    accessionYear: 0,
    reignOrdinal: 1,
    status: "dead",
    chronicle: {
      accessionSnapshot: {
        month: 0,
        population: 10,
        territoryShare: 0.1,
        cityCount: 1,
        stability: 60,
      },
      endSnapshot: {
        month: 360,
        population: 100,
        territoryShare: 0.3,
        cityCount: 4,
        stability: 70,
      },
      notableEventIds: [],
      citiesCapturedPersonally: 0,
      citiesLostDuringReign: 0,
      rebellionsDuringReign: 0,
      restorationsDuringReign: 0,
      completedUnification: false,
      peakPopulation: 100,
      peakTerritoryShare: 0.3,
    },
    ...overrides,
  };
}

describe("ruler significance rules", () => {
  it("marks state founders without temple names", () => {
    const labels = getRulerSignificanceLabels(
      ruler({
        chronicle: {
          ...ruler().chronicle!,
          foundedStateName: "梁",
        },
      }),
      360
    );
    expect(labels).toContain("开国之君");
    expect(labels).not.toContain("太祖");
  });

  it("marks long reign with major expansion", () => {
    expect(getRulerSignificanceLabels(ruler(), 360)).toContain("长治开疆");
  });
});
