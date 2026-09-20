import { describe, expect, it } from "vitest";
import { validateDynastyInvariants, validateRulerInvariant } from "./DynastyInvariant";

describe("dynasty invariant", () => {
  it("rejects current rulers for extinct factions", () => {
    const issues = validateDynastyInvariants(
      [
        {
          factionId: "齐",
          houseName: "田氏",
          currentRulerId: "r1",
          heirIds: [],
          rulers: [],
        },
      ],
      () => "EXTINCT"
    );
    expect(issues.some((issue) => issue.includes("current ruler"))).toBe(true);
  });

  it("rejects heir records with formal ruler data", () => {
    const issues = validateRulerInvariant("齐", {
      id: "heir",
      houseName: "田氏",
      givenName: "成",
      bornYear: 0,
      status: "heir",
      accessionYear: 10,
      reignOrdinal: 8,
      chronicle: {
        accessionSnapshot: {
          month: 10,
          population: 1,
          territoryShare: 0.01,
          cityCount: 1,
          stability: 50,
        },
        notableEventIds: [],
        citiesCapturedPersonally: 0,
        citiesLostDuringReign: 0,
        rebellionsDuringReign: 0,
        restorationsDuringReign: 0,
        completedUnification: false,
        peakPopulation: 1,
        peakTerritoryShare: 0.01,
      },
    });
    expect(issues.some((issue) => issue.includes("heir has ruler reign data"))).toBe(true);
  });

  it("accepts archived heirs without chronicle or ordinal", () => {
    expect(
      validateRulerInvariant("齐", {
        id: "heir",
        houseName: "田氏",
        givenName: "成",
        bornYear: 0,
        politicalStartYear: 10,
        politicalEndYear: 20,
        endReason: "王统断绝",
        status: "dead",
      })
    ).toEqual([]);
  });
});
