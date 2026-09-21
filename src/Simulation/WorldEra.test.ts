import { describe, expect, it, beforeEach } from "vitest";
import type Team from "../Components/Team";
import WorldHistory from "../History/WorldHistory";
import WorldEra, { classifyEra } from "./WorldEra";

function faction(
  name: string,
  territory: number,
  cities: number,
  overrides: Partial<Team> = {}
) {
  return {
    name,
    displayName: name,
    nameHistory: [{ name, startMonth: 0, reason: "initial" }],
    sovereigntyHistory: [{ rank: "KING", startMonth: 0 }],
    status: "ACTIVE",
    identityStage: "STATE",
    sovereigntyRank: "KING",
    blocks: { children: { size: territory } },
    cities: Array.from({ length: cities }, (_, index) => ({ id: `${name}-${index}` })),
    ...overrides,
  } as Team;
}

describe("world era", () => {
  beforeEach(() => {
    WorldHistory.reset();
    WorldEra.reset();
  });

  it("keeps WorldPhase and WorldEra as separate concepts", () => {
    const era = classifyEra(
      [faction("秦", 34, 3), faction("楚", 33, 3), faction("魏", 33, 2)],
      100,
      0,
      "CONTESTED"
    );
    expect(era?.type).toBe("MULTIPOLAR");
    expect(era?.name).toBe("群雄争衡");
  });

  it("exposes an active era candidate and its confirmation duration", () => {
    const teams = [faction("秦", 34, 3), faction("楚", 33, 3), faction("魏", 33, 2)];
    WorldEra.observe(0, teams, 100, "CONTESTED");
    WorldEra.observe(360, [faction("秦", 34, 3), faction("燕", 33, 3), faction("魏", 33, 2)], 100, "CONTESTED");
    const candidate = WorldEra.getCandidateDiagnostics(360);
    expect(candidate?.type).toBe("MULTIPOLAR");
    expect(candidate?.sustainedMonths).toBe(0);
    expect(candidate?.requiredMonths).toBe(360);
  });

  it("clears the candidate when no era condition is currently met", () => {
    const teams = [faction("秦", 34, 3), faction("楚", 33, 3), faction("魏", 33, 2)];
    WorldEra.observe(0, teams, 100, "CONTESTED");
    WorldEra.observe(360, [faction("秦", 34, 3), faction("燕", 33, 3), faction("魏", 33, 2)], 100, "CONTESTED");
    WorldEra.observe(361, [
      faction("秦", 20, 2, { identityStage: "PROVISIONAL" }),
      faction("楚", 10, 1, { identityStage: "PROVISIONAL" }),
    ], 100, "CONTESTED");
    expect(WorldEra.getCandidateDiagnostics(361)).toBeUndefined();
  });

  it("establishes an initial multipolar era even before territory shares spread out", () => {
    const teams = [
      faction("秦", 0, 1),
      faction("楚", 0, 1),
      faction("燕", 0, 1),
      faction("魏", 0, 1),
    ];
    WorldEra.observe(0, teams, 100, "CONTESTED");
    expect(WorldEra.getCurrentEra()?.name).toBe("群雄争衡");
    expect(WorldEra.getEras()).toHaveLength(1);
  });

  it("detects dual rivalry between two formal powers", () => {
    const era = classifyEra(
      [faction("秦", 32, 4), faction("楚", 30, 4), faction("魏", 10, 1)],
      100,
      0,
      "CONTESTED"
    );
    expect(era?.type).toBe("DUAL_RIVALRY");
    expect(era?.name).toBe("秦楚争霸");
  });

  it("detects hegemony before dynastic conditions are met", () => {
    const era = classifyEra(
      [faction("秦", 44, 4), faction("楚", 18, 2), faction("魏", 10, 1)],
      100,
      0,
      "CONTESTED"
    );
    expect(era?.type).toBe("HEGEMONY");
    expect(era?.name).toBe("秦霸天下");
  });

  it("does not treat emperor rank alone as a dynastic world era", () => {
    const era = classifyEra(
      [
        faction("阳", 46, 4, { sovereigntyRank: "EMPEROR" }),
        faction("魏", 39, 4),
        faction("梁", 15, 1),
      ],
      100,
      165,
      "CONTESTED"
    );
    expect(era?.type).not.toBe("DYNASTIC");
  });

  it("confirms dynastic era only after thirty-year candidate persistence", () => {
    const teams = [
      faction("阳", 65, 6, {
        sovereigntyRank: "EMPEROR",
        sovereigntyHistory: [{ rank: "EMPEROR", startMonth: 120 }],
      }),
      faction("魏", 20, 2),
      faction("梁", 5, 1),
    ];
    for (let month = 120; month < 480; month++) {
      WorldEra.observe(month, teams, 100, "CONTESTED");
    }
    expect(WorldEra.getCurrentEra()).toBeUndefined();
    WorldEra.observe(480, teams, 100, "CONTESTED");
    expect(WorldEra.getCurrentEra()?.type).toBe("DYNASTIC");
    expect(WorldEra.getCurrentEra()?.name).toBe("阳朝");
    expect(WorldEra.getCurrentEra()?.startMonth).toBe(120);
  });

  it("does not confirm a short emperor dominance as a dynastic era", () => {
    const teams = [
      faction("楚", 65, 6, {
        sovereigntyRank: "EMPEROR",
        sovereigntyHistory: [{ rank: "EMPEROR", startMonth: 120 }],
      }),
      faction("魏", 18, 2),
    ];
    for (let month = 120; month <= 240; month++) {
      WorldEra.observe(month, teams, 100, "CONTESTED");
    }
    expect(WorldEra.getCurrentEra()).toBeUndefined();
  });

  it("does not create adjacent duplicate eras with the same type and name", () => {
    const firstBalance = [
      faction("秦", 34, 3),
      faction("楚", 33, 3),
      faction("魏", 33, 2),
    ];
    for (let month = 0; month <= 48; month++) {
      WorldEra.observe(month, firstBalance, 100, "CONTESTED");
    }
    expect(WorldEra.getEras()).toHaveLength(1);
    expect(WorldEra.getCurrentEra()?.name).toBe("群雄争衡");

    const secondBalance = [
      faction("燕", 34, 3),
      faction("韩", 33, 3),
      faction("赵", 33, 2),
    ];
    for (let month = 60; month <= 180; month++) {
      WorldEra.observe(month, secondBalance, 100, "CONTESTED");
    }
    expect(WorldEra.getEras()).toHaveLength(1);
    expect(WorldEra.getCurrentEra()?.name).toBe("群雄争衡");
  });

  it("does not renew multipolar chapter when the same cohort only changes order", () => {
    const firstBalance = [
      faction("秦", 34, 3),
      faction("楚", 33, 2),
      faction("魏", 33, 2),
      faction("韩", 5, 1),
    ];
    WorldEra.observe(0, firstBalance, 100, "CONTESTED");
    expect(WorldEra.getCurrentEra()?.name).toBe("群雄争衡");

    const reordered = [
      faction("楚", 34, 3),
      faction("秦", 33, 2),
      faction("魏", 33, 2),
      faction("韩", 5, 1),
    ];
    WorldEra.observe(80 * 12, reordered, 100, "CONTESTED");
    expect(WorldEra.getEras()).toHaveLength(1);
  });

  it("renews a very long multipolar chapter after dominant cohort turnover", () => {
    const oldCohort = [
      faction("秦", 34, 3),
      faction("楚", 33, 2),
      faction("魏", 33, 2),
      faction("韩", 5, 1),
    ];
    WorldEra.observe(0, oldCohort, 100, "CONTESTED");

    const newCohort = [
      faction("燕", 34, 3),
      faction("赵", 33, 2),
      faction("魏", 33, 2),
      faction("韩", 5, 1),
    ];
    WorldEra.observe(80 * 12, newCohort, 100, "CONTESTED");
    const eras = WorldEra.getEras();
    expect(eras).toHaveLength(2);
    expect(eras.map((era) => era.name)).toEqual(["群雄争衡", "群雄争衡"]);
    expect(eras[0].endMonth).toBe(80 * 12 - 1);
    expect(eras[1].dominantFactionIds).toEqual(["燕", "赵", "魏"]);
  });

  it("uses controlled territory share in multipolar explanations", () => {
    const era = classifyEra(
      [
        faction("秦", 10, 3),
        faction("赵", 10, 3),
        faction("燕", 10, 2),
      ],
      10000,
      120,
      "CONTESTED"
    );
    expect(era?.type).toBe("MULTIPOLAR");
    expect(era?.explanation).toContain("当前诸国领土的33.3%");
    expect(era?.explanation).not.toContain("0.1%");
  });

  it("snapshots multipolar cohort labels at era creation", () => {
    const teams = [
      faction("秦", 34, 3),
      faction("赵", 33, 3),
      faction("燕", 33, 2),
    ];
    WorldEra.observe(0, teams, 1000, "CONTESTED");
    const era = WorldEra.getCurrentEra();
    expect(era?.cohortLabelSnapshot).toBe("秦 · 赵 · 燕");
    teams[0].displayName = "秦朝";
    expect(WorldEra.getCurrentEra()?.cohortLabelSnapshot).toBe("秦 · 赵 · 燕");
  });

  it("keeps the same dual rivalry when first and second place swap", () => {
    const yanFirst = [
      faction("燕", 32, 4),
      faction("楚", 30, 4),
      faction("魏", 10, 1),
    ];
    for (let month = 0; month <= 48; month++) {
      WorldEra.observe(month, yanFirst, 100, "CONTESTED");
    }
    expect(WorldEra.getCurrentEra()?.name).toBe("燕楚争霸");

    const chuFirst = [
      faction("楚", 32, 4),
      faction("燕", 30, 4),
      faction("魏", 10, 1),
    ];
    for (let month = 140; month <= 520; month++) {
      WorldEra.observe(month, chuFirst, 100, "CONTESTED");
    }
    expect(WorldEra.getEras()).toHaveLength(1);
    expect(WorldEra.getCurrentEra()?.name).toBe("燕楚争霸");
  });

  it("starts a new dual rivalry candidate only when the unordered pair changes", () => {
    const yanChu = [
      faction("燕", 32, 4),
      faction("楚", 30, 4),
      faction("魏", 10, 1),
    ];
    for (let month = 0; month <= 48; month++) {
      WorldEra.observe(month, yanChu, 100, "CONTESTED");
    }
    const qinChu = [
      faction("秦", 32, 4),
      faction("楚", 30, 4),
      faction("燕", 10, 1),
    ];
    for (let month = 370; month <= 730; month++) {
      WorldEra.observe(month, qinChu, 100, "CONTESTED");
    }
    expect(WorldEra.getEras().map((era) => era.name)).toEqual([
      "燕楚争霸",
      "秦楚争霸",
    ]);
  });

  it("writes retrospective confirmation wording when era start predates confirmation", () => {
    const teams = [
      faction("秦", 32, 4),
      faction("楚", 30, 4),
      faction("魏", 10, 1),
    ];
    for (let month = 10; month <= 370; month++) {
      WorldEra.observe(month, teams, 100, "CONTESTED");
    }
    const event = WorldHistory.getEvents().find((item) => item.type === "world-era-started");
    expect(event?.title).toBe("秦楚争霸格局确立，追溯始于0年11月。");
    expect(event?.metadata?.eraStartMonth).toBe(10);
    expect(event?.metadata?.confirmedMonth).toBe(370);
  });

  it("does not record short unified or fragmentation interludes as eras", () => {
    const unifiedTeams = [faction("阳", 100, 7, { sovereigntyRank: "EMPEROR" })];
    WorldEra.observe(200, unifiedTeams, 100, "UNIFIED");
    expect(WorldEra.getCurrentEra()).toBeUndefined();

    const splitTeams = [
      faction("阳", 60, 5, { sovereigntyRank: "EMPEROR" }),
      faction("郑", 20, 2),
      faction("梁", 12, 1),
    ];
    WorldEra.observe(210, splitTeams, 100, "IMPERIAL_FRACTURE");
    expect(WorldEra.getCurrentEra()).toBeUndefined();
    expect(WorldHistory.getEvents().some((event) => event.type === "world-era-started")).toBe(false);
  });
});
