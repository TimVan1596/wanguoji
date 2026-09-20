import { describe, expect, it } from "vitest";
import {
  formFactionState,
  getStateFormationBlockers,
  getSovereigntyRankAtMonth,
  initializeFactionIdentity,
  observeEmperorProclamationEligibility,
  observeStateFormationEligibility,
  proclaimEmperor,
  shouldApplyProvisionalDissolutionPressure,
  shouldShowFactionInHistoricalArchive,
  validateFactionIdentities,
} from "./FactionIdentity";

function rebel(overrides: Partial<any> = {}): any {
  const cityA = { id: "city-a" };
  const cityB = { id: "city-b" };
  return {
    name: "rebel_17",
    displayName: "大梁义军",
    identityStage: "PROVISIONAL",
    sovereigntyRank: "LEADER",
    sovereigntyHistory: [{ rank: "LEADER", startMonth: 0 }],
    factionType: "REBEL",
    status: "ACTIVE",
    currentActiveSinceYear: 0,
    stateFormationEligibleSinceMonth: undefined,
    stateFoundedMonth: undefined,
    nameHistory: [{ name: "大梁义军", startMonth: 0, reason: "initial" }],
    cities: [cityA, cityB],
    cityRefs: [cityA, cityB],
    currentRulerId: "r4",
    reignOrdinal: 4,
    cumulativeActiveYears: 70,
    ...overrides,
  };
}

describe("faction identity", () => {
  it("initializes name history from current name", () => {
    const faction = rebel({ name: "秦", displayName: "", factionType: "KINGDOM" });
    initializeFactionIdentity(faction, 0);
    expect(faction.displayName).toBe("秦");
    expect(faction.identityStage).toBe("STATE");
    expect(faction.sovereigntyRank).toBe("KING");
    expect(faction.sovereigntyHistory).toEqual([{ rank: "KING", startMonth: 0 }]);
    expect(faction.nameHistory).toEqual([
      { name: "秦", startMonth: 0, reason: "initial" },
    ]);
  });

  it("does not form a state before 60 active months", () => {
    const faction = rebel();
    expect(observeStateFormationEligibility(faction, 59, 80, true)).toBe(false);
    expect(faction.stateFormationEligibleSinceMonth).toBeUndefined();
  });

  it("does not form with only one city", () => {
    const faction = rebel({ cities: [{ id: "city-a" }] });
    expect(observeStateFormationEligibility(faction, 80, 80, true)).toBe(false);
  });

  it("does not form below stability threshold", () => {
    const faction = rebel();
    expect(observeStateFormationEligibility(faction, 80, 54, true)).toBe(false);
  });

  it("does not form before eligibility is continuous for twelve months", () => {
    const faction = rebel();
    expect(observeStateFormationEligibility(faction, 60, 80, true)).toBe(false);
    expect(observeStateFormationEligibility(faction, 71, 80, true)).toBe(false);
  });

  it("forms after continuous eligibility", () => {
    const faction = rebel();
    observeStateFormationEligibility(faction, 60, 80, true);
    expect(observeStateFormationEligibility(faction, 72, 80, true)).toBe(true);
  });

  it("resets continuous eligibility when conditions break", () => {
    const faction = rebel();
    observeStateFormationEligibility(faction, 60, 80, true);
    observeStateFormationEligibility(faction, 61, 40, true);
    expect(faction.stateFormationEligibleSinceMonth).toBeUndefined();
  });

  it("changes displayName and keeps immutable faction id", () => {
    const faction = rebel();
    const id = faction.name;
    formFactionState(faction, "梁", 72);
    expect(faction.name).toBe(id);
    expect(faction.displayName).toBe("梁");
    expect(faction.sovereigntyRank).toBe("KING");
  });

  it("keeps city references, ruler, ordinal, and cumulative reign data", () => {
    const faction = rebel();
    const cities = faction.cities;
    const currentRulerId = faction.currentRulerId;
    const reignOrdinal = faction.reignOrdinal;
    const cumulativeActiveYears = faction.cumulativeActiveYears;
    formFactionState(faction, "梁", 72);
    expect(faction.cities).toBe(cities);
    expect(faction.currentRulerId).toBe(currentRulerId);
    expect(faction.reignOrdinal).toBe(reignOrdinal);
    expect(faction.cumulativeActiveYears).toBe(cumulativeActiveYears);
  });

  it("closes old name and opens new state name at the formation month", () => {
    const faction = rebel({ nameHistory: [{ name: "大梁义军", startMonth: 12, reason: "initial" }] });
    formFactionState(faction, "梁", 72);
    expect(faction.nameHistory).toEqual([
      { name: "大梁义军", startMonth: 12, endMonth: 71, reason: "initial" },
      { name: "梁", startMonth: 72, reason: "state-formation" },
    ]);
    expect(faction.sovereigntyHistory).toEqual([
      { rank: "LEADER", startMonth: 0, endMonth: 71 },
      { rank: "KING", startMonth: 72 },
    ]);
  });

  it("never reverts a formed state back to rebel stage", () => {
    const faction = rebel();
    expect(formFactionState(faction, "梁", 72)).toBe(true);
    expect(formFactionState(faction, "大梁义军", 90)).toBe(false);
    expect(faction.identityStage).toBe("STATE");
    expect(faction.displayName).toBe("梁");
  });

  it("allows provisional split factions to form states", () => {
    const faction = rebel({ factionType: "SPLIT" });
    observeStateFormationEligibility(faction, 60, 80, true);
    expect(observeStateFormationEligibility(faction, 72, 80, true)).toBe(true);
    expect(formFactionState(faction, "郑", 72)).toBe(true);
    expect(faction.identityStage).toBe("STATE");
    expect(faction.name).toBe("rebel_17");
  });

  it("does not evaluate frontier factions for state formation in this patch", () => {
    const faction = rebel({ factionType: "FRONTIER" });
    observeStateFormationEligibility(faction, 120, 90, true);
    expect(faction.stateFormationEligibleSinceMonth).toBeUndefined();
    expect(formFactionState(faction, "阳", 132)).toBe(false);
  });

  it("does not proclaim emperor until stricter king eligibility is held for sixty months", () => {
    const faction = rebel();
    formFactionState(faction, "梁", 72);
    expect(
      observeEmperorProclamationEligibility(faction, 311, {
        territoryShare: 60,
        cityShare: 60,
        stability: 80,
        leadShare: 20,
        hasFormalRuler: true,
      })
    ).toBe(false);
    expect(faction.emperorEligibleSinceMonth).toBeUndefined();
    expect(
      observeEmperorProclamationEligibility(faction, 312, {
        territoryShare: 49,
        cityShare: 60,
        stability: 80,
        leadShare: 20,
        hasFormalRuler: true,
      })
    ).toBe(false);
    expect(
      observeEmperorProclamationEligibility(faction, 312, {
        territoryShare: 60,
        cityShare: 49,
        stability: 80,
        leadShare: 20,
        hasFormalRuler: true,
      })
    ).toBe(false);
    expect(
      observeEmperorProclamationEligibility(faction, 312, {
        territoryShare: 60,
        cityShare: 60,
        stability: 69,
        leadShare: 20,
        hasFormalRuler: true,
      })
    ).toBe(false);
    expect(
      observeEmperorProclamationEligibility(faction, 312, {
        territoryShare: 60,
        cityShare: 60,
        stability: 80,
        leadShare: 14,
        hasFormalRuler: true,
      })
    ).toBe(false);
    expect(
      observeEmperorProclamationEligibility(faction, 312, {
        territoryShare: 60,
        cityShare: 60,
        stability: 80,
        leadShare: 20,
        hasFormalRuler: true,
      })
    ).toBe(false);
    expect(
      observeEmperorProclamationEligibility(faction, 371, {
        territoryShare: 60,
        cityShare: 60,
        stability: 80,
        leadShare: 20,
        hasFormalRuler: true,
      })
    ).toBe(false);
    expect(
      observeEmperorProclamationEligibility(faction, 372, {
        territoryShare: 60,
        cityShare: 60,
        stability: 80,
        leadShare: 20,
        hasFormalRuler: true,
      })
    ).toBe(true);
  });

  it("proclaims emperor without changing faction identity or name history", () => {
    const faction = rebel();
    const id = faction.name;
    const cities = faction.cities;
    formFactionState(faction, "梁", 72);
    const nameHistory = faction.nameHistory;
    expect(proclaimEmperor(faction, 372)).toBe(true);
    expect(faction.name).toBe(id);
    expect(faction.cities).toBe(cities);
    expect(faction.nameHistory).toBe(nameHistory);
    expect(faction.sovereigntyRank).toBe("EMPEROR");
    expect(faction.proclaimedEmperorMonth).toBe(372);
    expect(faction.sovereigntyHistory).toEqual([
      { rank: "LEADER", startMonth: 0, endMonth: 71 },
      { rank: "KING", startMonth: 72, endMonth: 371 },
      { rank: "EMPEROR", startMonth: 372 },
    ]);
  });

  it("resolves sovereignty rank historically", () => {
    const faction = rebel();
    formFactionState(faction, "梁", 72);
    proclaimEmperor(faction, 216);
    expect(getSovereigntyRankAtMonth(faction, 50)).toBe("LEADER");
    expect(getSovereigntyRankAtMonth(faction, 100)).toBe("KING");
    expect(getSovereigntyRankAtMonth(faction, 300)).toBe("EMPEROR");
  });

  it("hides extinct never-formal provisional factions from historical archive", () => {
    expect(
      shouldShowFactionInHistoricalArchive(
        rebel({ status: "EXTINCT", identityStage: "PROVISIONAL", stateFoundedMonth: undefined })
      )
    ).toBe(false);
    expect(
      shouldShowFactionInHistoricalArchive(
        rebel({ status: "EXTINCT", identityStage: "STATE", stateFoundedMonth: 72, sovereigntyRank: "KING" })
      )
    ).toBe(true);
  });

  it("keeps origin metadata after state formation", () => {
    const faction = rebel({
      origin: {
        type: "SPLIT",
        parentFactionId: "韩",
        foundedMonth: 105,
        foundingCityIds: ["xinzheng"],
        foundingRulerId: "r1",
      },
    });
    const origin = faction.origin;
    formFactionState(faction, "郑", 120);
    expect(faction.origin).toBe(origin);
    expect(faction.origin.parentFactionId).toBe("韩");
  });

  it("allows restoration to keep the formal state name without adding history", () => {
    const faction = rebel({ status: "EXILED" });
    formFactionState(faction, "梁", 72);
    const historyLength = faction.nameHistory.length;
    faction.status = "ACTIVE";
    expect(faction.displayName).toBe("梁");
    expect(faction.nameHistory).toHaveLength(historyLength);
  });

  it("reports duplicate active formal state names", () => {
    const a = rebel({ name: "a", displayName: "梁", identityStage: "STATE", sovereigntyRank: "KING", sovereigntyHistory: [{ rank: "KING", startMonth: 72 }], stateFoundedMonth: 72 });
    const b = rebel({ name: "b", displayName: "梁", identityStage: "STATE", sovereigntyRank: "KING", sovereigntyHistory: [{ rank: "KING", startMonth: 90 }], stateFoundedMonth: 90 });
    expect(validateFactionIdentities([a, b]).some((issue) => issue.includes("duplicated ACTIVE"))).toBe(true);
  });

  it("allows extinct historical state names to be reused", () => {
    const oldLiang = rebel({
      name: "old",
      displayName: "梁",
      identityStage: "STATE",
      sovereigntyRank: "KING",
      sovereigntyHistory: [{ rank: "KING", startMonth: 72 }],
      stateFoundedMonth: 72,
      status: "EXTINCT",
      nameHistory: [{ name: "梁", startMonth: 72, reason: "state-formation" }],
    });
    const newLiang = rebel({
      name: "new",
      displayName: "梁",
      identityStage: "STATE",
      sovereigntyRank: "KING",
      sovereigntyHistory: [{ rank: "KING", startMonth: 160 }],
      stateFoundedMonth: 160,
      status: "ACTIVE",
      nameHistory: [{ name: "梁", startMonth: 160, reason: "state-formation" }],
    });
    expect(validateFactionIdentities([oldLiang, newLiang])).toEqual([]);
  });

  it("accepts a well-formed state identity", () => {
    const faction = rebel();
    formFactionState(faction, "梁", 72);
    expect(validateFactionIdentities([faction])).toEqual([]);
  });

  it("reports state formation blockers for provisional factions", () => {
    const faction = rebel({
      cities: [{ id: "city-a" }],
      currentActiveSinceYear: 0,
    });
    expect(getStateFormationBlockers(faction, 24, 40, false)).toEqual([
      "ACTIVE_DURATION",
      "CITY_COUNT",
      "STABILITY",
      "CURRENT_RULER",
    ]);
  });

  it("does not pressure strong provisional factions toward dissolution", () => {
    const faction = rebel({
      currentActiveSinceYear: 0,
      cities: [{ id: "city-a" }, { id: "city-b" }],
    });
    expect(
      shouldApplyProvisionalDissolutionPressure(faction, 80 * 12, 12, 75, true)
    ).toBe(false);
  });

  it("applies soft dissolution pressure to weak old one-city provisional factions", () => {
    const faction = rebel({
      currentActiveSinceYear: 0,
      cities: [{ id: "city-a" }],
      stateFormationEligibleSinceMonth: undefined,
    });
    expect(
      shouldApplyProvisionalDissolutionPressure(faction, 55 * 12, 4, 48, true)
    ).toBe(true);
  });

  it("does not hard-delete provisional factions by age alone", () => {
    const faction = rebel({
      currentActiveSinceYear: 0,
      cities: [{ id: "city-a" }],
    });
    expect(
      shouldApplyProvisionalDissolutionPressure(faction, 55 * 12, 4, 80, true)
    ).toBe(true);
    expect(faction.status).toBe("ACTIVE");
    expect(faction.identityStage).toBe("PROVISIONAL");
  });
});
