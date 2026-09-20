import { describe, expect, it } from "vitest";
import {
  buildFactionIdentityLines,
  buildEmperorQualificationLines,
  buildFactionOverviewSections,
  buildFactionLifecycleLines,
  buildStateFormationStatusLines,
  getCumulativeActiveMonthsSafe,
  resolveFactionNameAtMonthSafe,
} from "./model";

describe("faction details model", () => {
  it("resolves historical names without requiring Team prototype methods", () => {
    expect(
      resolveFactionNameAtMonthSafe(
        {
          name: "rebel_1",
          displayName: "梁",
          nameHistory: [
            { name: "大梁义军", startMonth: 10, endMonth: 99 },
            { name: "梁", startMonth: 100 },
          ],
        },
        50
      )
    ).toBe("大梁义军");
  });

  it("builds origin lines when parent is missing", () => {
    const lines = buildFactionIdentityLines(
      {
        name: "rebel_1",
        displayName: "郑",
        factionType: "SPLIT",
        identityStage: "STATE",
        stateFoundedMonth: 120,
        firstFoundedYear: 105,
        nameHistory: [{ name: "新郑义军", startMonth: 105, endMonth: 119 }],
        origin: {
          type: "SPLIT",
          parentFactionId: "韩",
          foundedMonth: 105,
          foundingCityIds: ["city-x"],
          foundingRulerId: "r1",
        },
      },
      [],
      new Map([["city-x", "新郑"]]),
      new Map([["r1", "韩威"]])
    );
    expect(lines).toContain("政权来源：韩分裂");
    expect(lines).toContain("发源：新郑");
    expect(lines).toContain("首任首领：韩威");
  });

  it("does not throw when founding city or major history is absent", () => {
    expect(() =>
      buildFactionIdentityLines(
        {
          name: "rebel_2",
          factionType: "REBEL",
          identityStage: "PROVISIONAL",
          firstFoundedYear: 80,
          origin: { type: "REBEL", foundedMonth: 80 },
        },
        [],
        new Map(),
        new Map()
      )
    ).not.toThrow();
  });

  it("builds lifecycle lines for active, exiled, and extinct plain snapshots", () => {
    expect(
      buildFactionLifecycleLines(
        { name: "秦", status: "ACTIVE", firstFoundedYear: 0 },
        60,
        0
      )
    ).toContain("国祚：5年");
    expect(
      buildFactionLifecycleLines(
        { name: "秦", status: "EXILED", firstFoundedYear: 0, lastExiledYear: 24 },
        60,
        3
      )
    ).toContain("流亡：3年");
    expect(
      buildFactionLifecycleLines(
        { name: "秦", status: "EXTINCT", firstFoundedYear: 0, extinctionYear: 24 },
        60,
        0
      )
    ).toContain("累计国祚：2年");
  });

  it("keeps selected archived factions sortable without Team methods", () => {
    expect(
      getCumulativeActiveMonthsSafe(
        { name: "赵", status: "EXTINCT", firstFoundedYear: 0, extinctionYear: 36 },
        120
      )
    ).toBe(36);
  });

  it("shows provisional state formation status without exposing internal enums", () => {
    const lines = buildStateFormationStatusLines(
      {
        name: "rebel_1",
        factionType: "REBEL",
        identityStage: "PROVISIONAL",
        status: "ACTIVE",
        firstFoundedYear: 10,
        currentActiveSinceYear: 10,
        cities: [{ id: "a" }],
      },
      52,
      67,
      true
    );
    expect(lines).toContain("建国条件：存续 42/60个月");
    expect(lines).toContain("建国条件：城市 1/2");
    expect(lines).toContain("建国条件：稳定度 67/55");
  });

  it("shows political integration when provisional requirements are being held", () => {
    const lines = buildStateFormationStatusLines(
      {
        name: "split_1",
        factionType: "SPLIT",
        identityStage: "PROVISIONAL",
        status: "ACTIVE",
        firstFoundedYear: 0,
        currentActiveSinceYear: 0,
        stateFormationEligibleSinceMonth: 70,
        cities: [{ id: "a" }, { id: "b" }],
      },
      76,
      72,
      true
    );
    expect(lines).toContain("政治整合中：6/12个月");
  });

  it("builds overview sections without duplicate establish or status lines", () => {
    const sections = buildFactionOverviewSections({
      team: {
        name: "zheng_1",
        displayName: "郑",
        factionType: "SPLIT",
        identityStage: "STATE",
        status: "ACTIVE",
        firstFoundedYear: 82,
        stateFoundedMonth: 112,
        nameHistory: [
          { name: "新郑西义军", startMonth: 82, endMonth: 111 },
          { name: "郑", startMonth: 112 },
        ],
        origin: {
          type: "SPLIT",
          foundedMonth: 82,
          parentFactionId: "韩",
          foundingCityIds: ["xinzheng"],
          foundingRulerId: "r1",
        },
      },
      teams: [{ name: "韩", displayName: "韩国", nameHistory: [{ name: "韩国", startMonth: 0 }] }],
      cityNameById: new Map([["xinzheng", "新郑"]]),
      rulerNameById: new Map([["r1", "韩康"]]),
      worldMonth: 180,
      remnantPopulation: 0,
      foundingKingName: "韩成",
    });
    const allLines = [...sections.identityLines, ...sections.legacyLines];
    expect(allLines.filter((line) => line.startsWith("建立："))).toHaveLength(1);
    expect(allLines.some((line) => line.startsWith("状态："))).toBe(false);
    expect(sections.identityLines).toContain("政权源流：新郑西义军 → 郑");
    expect(sections.identityLines).toContain("首任首领：韩康");
    expect(sections.identityLines).toContain("开国之王：韩成");
  });

  it("builds king emperor qualification progress and hides it after emperor rank", () => {
    const kingLines = buildEmperorQualificationLines({
      team: {
        name: "郑",
        identityStage: "STATE",
        status: "ACTIVE",
        sovereigntyRank: "KING",
        stateFoundedMonth: 0,
        emperorEligibleSinceMonth: 130,
      },
      worldMonth: 308,
      territoryShare: 54,
      cityShare: 52,
      leadShare: 18,
      effectiveStability: 74,
      hasFormalRuler: true,
    });
    expect(kingLines).toContain("帝号资格：政治条件成熟");
    expect(kingLines).toContain("领先优势 18.0pp / 15pp ✓");
    expect(kingLines).toContain("整合进程：60 / 60个月");
    expect(
      buildEmperorQualificationLines({
        team: {
          name: "郑",
          identityStage: "STATE",
          status: "ACTIVE",
          sovereigntyRank: "EMPEROR",
          proclaimedEmperorMonth: 165,
        },
        worldMonth: 200,
        territoryShare: 10,
        cityShare: 10,
        effectiveStability: 10,
        hasFormalRuler: true,
      })
    ).toEqual(["帝统已立", "称帝：13年10月"]);
  });
});
