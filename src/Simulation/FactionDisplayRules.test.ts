import { describe, expect, it } from "vitest";
import {
  buildFactionRankingIdentity,
  getFactionListDisplayName,
  getFactionRegimeBadge,
  getFactionRegimeWeight,
} from "./FactionDisplayRules";
import { getActiveRankingFactions } from "./FactionRankingRules";

describe("faction display rules", () => {
  it("distinguishes provisional, kingdom, and imperial display labels", () => {
    expect(
      getFactionRegimeBadge({
        displayName: "邯郸义军",
        identityStage: "PROVISIONAL",
        factionType: "REBEL",
      })
    ).toBe("临时政权");
    expect(
      getFactionListDisplayName(
        {
          displayName: "郑",
          identityStage: "STATE",
          sovereigntyRank: "KING",
        },
        120
      )
    ).toBe("郑国");
    expect(
      getFactionListDisplayName(
        {
          displayName: "燕",
          identityStage: "STATE",
          sovereigntyRank: "EMPEROR",
        },
        120
      )
    ).toBe("燕朝");
    expect(getFactionRegimeWeight({ identityStage: "STATE", sovereigntyRank: "EMPEROR" })).toBe(2);
  });

  it("builds compact ranking identity without truncating the model name", () => {
    expect(
      buildFactionRankingIdentity(
        {
          displayName: "新郑义军",
          identityStage: "PROVISIONAL",
          factionType: "REBEL",
        },
        120,
        "首领韩安"
      )
    ).toEqual({
      displayName: "新郑义军",
      badge: "临时",
      rulerTitle: "首领韩安",
      prestigeWeight: 0,
    });
    expect(
      buildFactionRankingIdentity(
        {
          displayName: "秦",
          identityStage: "STATE",
          sovereigntyRank: "KING",
        },
        120,
        "秦王嬴昭"
      )
    ).toMatchObject({
      displayName: "秦国",
      badge: "王国",
      rulerTitle: "秦王嬴昭",
      prestigeWeight: 1,
    });
    expect(
      buildFactionRankingIdentity(
        {
          displayName: "燕",
          identityStage: "STATE",
          sovereigntyRank: "EMPEROR",
        },
        120,
        "燕帝姬文"
      )
    ).toMatchObject({
      displayName: "燕朝",
      badge: "帝国",
      rulerTitle: "燕帝姬文",
      prestigeWeight: 2,
    });
  });

  it("does not change current power ranking by sovereignty prestige", () => {
    const ranked = getActiveRankingFactions([
      {
        name: "帝",
        status: "ACTIVE",
        blocks: { children: { size: 10 } },
        sovereigntyRank: "EMPEROR",
      },
      {
        name: "王",
        status: "ACTIVE",
        blocks: { children: { size: 20 } },
        sovereigntyRank: "KING",
      },
    ] as any);
    expect(
      ranked.map((team) => (team as unknown as { name: string }).name)
    ).toEqual(["王", "帝"]);
  });
});
