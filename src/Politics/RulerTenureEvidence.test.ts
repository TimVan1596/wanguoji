import { describe, expect, it } from "vitest";
import { deriveRulerTenureEvidence } from "./RulerTenureEvidence";

const event = (id: string, type: string, month: number, group = id, extra: Record<string, unknown> = {}) => ({
  id, type, year: month, monthIndex: month, historyGroupId: group,
  category: "politics", title: id, importance: "major", ...extra,
});
const ruler = (accessionYear: number, endYear: number, status: "dead" | "ruling" = "dead") => ({
  id: "r", houseName: "姬氏", givenName: "澄", bornYear: -36,
  accessionYear, endYear, status, deathMonth: status === "dead" ? endYear : undefined, deathReason: status === "dead" ? "去世" : undefined,
} as any);

describe("ruler tenure exile evidence", () => {
  it("detects exile inherited at accession and attributes only exile months to this ruler", () => {
    const result = deriveRulerTenureEvidence(ruler(20, 100), "燕", [event("e", "faction-exiled", 10, "fall", { targetFactionId: "燕" })] as any, 100);
    expect(result).toMatchObject({ totalTenureMonths: 80, activeRuleMonths: 0, exileMonths: 80, exileEpisodeCount: 1, exiledAtAccession: true, lostStateDuringTenure: false, diedInExile: true });
  });

  it("splits active rule and exile duration around a restoration", () => {
    const events = [
      event("fall", "faction-exiled", 10, "fall", { targetFactionId: "燕" }),
      event("restore", "faction-restored", 30, "restore", { actorFactionId: "燕" }),
    ];
    expect(deriveRulerTenureEvidence(ruler(0, 30), "燕", events as any, 30)).toMatchObject({
      totalTenureMonths: 30, activeRuleMonths: 10, exileMonths: 20,
      exileEpisodeCount: 1, lostStateDuringTenure: true, restoredDuringTenure: true,
      restoredExileMonths: 20, diedInExile: false,
    });
  });

  it("counts multiple exile episodes, deduplicates groups, and ignores dynasty-exiled narration", () => {
    const events = [
      event("fall", "faction-exiled", 10, "fall", { targetFactionId: "燕" }),
      event("duplicate", "faction-exiled", 10, "fall", { targetFactionId: "燕" }),
      event("dynasty", "dynasty-exiled", 10, "fall", { targetFactionId: "燕" }),
      event("restore-1", "faction-restored", 20, "restore-1", { actorFactionId: "燕" }),
      event("fall-2", "faction-exiled", 30, "fall-2", { targetFactionId: "燕" }),
      event("restore-2", "faction-restored", 50, "restore-2", { actorFactionId: "燕" }),
    ];
    expect(deriveRulerTenureEvidence(ruler(0, 60), "燕", events as any, 60)).toMatchObject({
      totalTenureMonths: 60, activeRuleMonths: 30, exileMonths: 30,
      exileEpisodeCount: 2, restoredDuringTenure: true, restoredExileMonths: 30,
    });
  });

  it("recognizes extinction while the claimant remains exiled", () => {
    const events = [
      event("fall", "faction-exiled", 10, "fall", { targetFactionId: "燕" }),
      event("extinct", "faction-extinct", 40, "extinct", { targetFactionId: "燕" }),
    ];
    expect(deriveRulerTenureEvidence(ruler(0, 50), "燕", events as any, 50)).toMatchObject({
      exileMonths: 30, activeRuleMonths: 20, extinctInExile: true, diedInExile: false,
    });
  });
});

it("separates extinction in exile from actual death and preserves a real same-month death", () => {
  const events = [event("fall", "faction-exiled", 10, "fall", { targetFactionId: "燕" }),
    event("end", "faction-extinct", 100, "end", { targetFactionId: "燕" })] as any;
  const dead = ruler(20, 100);
  expect(deriveRulerTenureEvidence(dead, "燕", events, 100)).toMatchObject({ diedInExile: true, extinctInExile: true, activeRuleMonths: 0, exileMonths: 80 });
  const unknown = { ...dead, status: "politically-ended", deathMonth: undefined, deathReason: undefined } as any;
  expect(deriveRulerTenureEvidence(unknown, "燕", events, 1000)).toMatchObject({ diedInExile: false, extinctInExile: true, activeRuleMonths: 0, exileMonths: 80 });
});
