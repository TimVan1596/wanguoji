import { describe, expect, it } from "vitest";
import { createDiplomacyEventMetadata, describeDiplomacySigning, formatDiplomacyRelationLines, getFactionDiplomacyBadges } from "./DiplomacyPresentation";
import type { DiplomaticRelation } from "./Diplomacy";

const truce: DiplomaticRelation = {
  factionAId: "qi", factionBId: "wei", status: "TRUCE", startedMonth: 133, expiresMonth: 169,
  reason: "WAR_EXHAUSTION_TRUCE",
};

describe("diplomacy presentation", () => {
  it("formats agreement dates and actual term from month difference", () => {
    expect(formatDiplomacyRelationLines(truce, "魏")).toEqual([
      "魏 · 停战 · 战后休兵", "11年2月订立 · 约期3年 · 至14年2月",
    ]);
    const text = describeDiplomacySigning(truce, {
      reason: "WAR_EXHAUSTION_TRUCE", recentBilateralCaptureCount: 4, stabilityA: 44, stabilityB: 53,
    }, { factionAName: "齐", factionBName: "魏" });
    expect(text).toContain("4次城邑易手");
    expect(text).toContain("停战3年");
    expect(text).not.toContain("五年");
  });

  it("uses common-threat identity and the actual non-aggression term", () => {
    const relation: DiplomaticRelation = {
      ...truce, status: "NON_AGGRESSION", startedMonth: 12, expiresMonth: 108,
      reason: "COMMON_THREAT_NON_AGGRESSION",
    };
    expect(describeDiplomacySigning(relation, {
      reason: "COMMON_THREAT_NON_AGGRESSION", commonThreatFactionId: "yan",
      territoryShareA: 5, territoryShareB: 7, threatTerritoryShare: 60,
    }, { factionAName: "赵", factionBName: "韩", commonThreatName: "燕" })).toContain("燕势明显强于赵、韩");
    expect(formatDiplomacyRelationLines(relation, "韩")[1]).toContain("约期8年");
  });

  it("shows at most two counterpart-specific badges with the correct relation", () => {
    const relations: DiplomaticRelation[] = [
      truce,
      { ...truce, factionBId: "han", status: "NON_AGGRESSION", reason: "COMMON_THREAT_NON_AGGRESSION" },
      { ...truce, factionBId: "yan" },
    ];
    expect(getFactionDiplomacyBadges(relations, "qi")).toEqual([
      { relation: truce, counterpartId: "wei" },
      { relation: relations[1], counterpartId: "han" },
    ]);
    expect(getFactionDiplomacyBadges(relations, "missing")).toEqual([]);
  });

  it("freezes both rulers and the selected rule evidence in signing metadata", () => {
    const metadata = createDiplomacyEventMetadata(truce, {
      reason: "WAR_EXHAUSTION_TRUCE", recentBilateralCaptureCount: 2, stabilityA: 51, stabilityB: 47,
    }, [
      { factionId: "qi", rulerId: "r-qi", title: "齐王姬某", role: "君主" },
      { factionId: "wei", rulerId: "r-wei", title: "魏王姬某", role: "君主" },
    ]);
    expect(metadata).toMatchObject({
      reason: "WAR_EXHAUSTION_TRUCE", recentBilateralCaptureCount: 2,
      stabilityA: 51, stabilityB: 47,
      signatoryAFactionId: "qi", signatoryARulerId: "r-qi", signatoryATitle: "齐王姬某",
      signatoryBFactionId: "wei", signatoryBRulerId: "r-wei", signatoryBTitle: "魏王姬某",
    });
    expect(createDiplomacyEventMetadata({ ...truce, reason: "COMMON_THREAT_NON_AGGRESSION" }, {
      reason: "COMMON_THREAT_NON_AGGRESSION", commonThreatFactionId: "yan",
      territoryShareA: 4, territoryShareB: 6, threatTerritoryShare: 55,
    })).toMatchObject({ commonThreatFactionId: "yan", territoryShareA: 4, territoryShareB: 6, threatTerritoryShare: 55 });
    const alliance = createDiplomacyEventMetadata({
      ...truce, status: "ALLIANCE", reason: "COMMON_THREAT_ALLIANCE", preconditionStatus: "NON_AGGRESSION",
      preconditionStartedMonth: 24, preconditionDurationMonths: 24, commonThreatFactionId: "yan",
    }, {
      reason: "COMMON_THREAT_ALLIANCE", commonThreatFactionId: "yan", territoryShareA: 4,
      territoryShareB: 6, threatTerritoryShare: 55, priorStatus: "NON_AGGRESSION", priorDurationMonths: 24,
    });
    expect(alliance).toMatchObject({
      commonThreatFactionId: "yan", preconditionStatus: "NON_AGGRESSION",
      preconditionDurationMonths: 24, preconditionStartedMonth: 24,
    });
  });
});
