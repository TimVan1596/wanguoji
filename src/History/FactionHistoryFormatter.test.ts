import { describe, expect, it } from "vitest";
import { getFactionEventRelation } from "./FactionEventRelation";
import { formatFactionHistoryEvent } from "./FactionHistoryFormatter";
import { groupHistoryNarratives } from "./HistoryNarrativeGrouper";
import type { WorldEvent } from "./WorldHistory";

function event(partial: Partial<WorldEvent> & Pick<WorldEvent, "type">): WorldEvent {
  return {
    id: partial.type,
    year: 100,
    monthIndex: 100,
    category: "politics",
    title: partial.type,
    importance: "major",
    ...partial,
  };
}

const factions = new Map([
  [
    "魏",
    {
      name: "魏",
      color: 2,
      displayName: "魏",
      identityStage: "STATE",
      stateFoundedMonth: 0,
      sovereigntyRank: "KING",
      sovereigntyHistory: [{ rank: "KING" as const, startMonth: 0 }],
      nameHistory: [{ name: "魏", startMonth: 0 }],
    },
  ],
  [
    "韩",
    {
      name: "韩",
      color: 3,
      displayName: "韩",
      identityStage: "STATE",
      stateFoundedMonth: 0,
      sovereigntyRank: "KING",
      sovereigntyHistory: [{ rank: "KING" as const, startMonth: 0 }],
      nameHistory: [{ name: "韩", startMonth: 0 }],
    },
  ],
  [
    "楚",
    {
      name: "楚",
      color: 4,
      displayName: "楚",
      identityStage: "STATE",
      stateFoundedMonth: 0,
      sovereigntyRank: "KING",
      sovereigntyHistory: [{ rank: "KING" as const, startMonth: 0 }],
      nameHistory: [{ name: "楚", startMonth: 0 }],
    },
  ],
  [
    "齐",
    {
      name: "齐",
      color: 5,
      displayName: "齐",
      identityStage: "STATE",
      stateFoundedMonth: 0,
      sovereigntyRank: "KING",
      sovereigntyHistory: [{ rank: "KING" as const, startMonth: 0 }],
      nameHistory: [{ name: "齐", startMonth: 0 }],
    },
  ],
  [
    "秦",
    {
      name: "秦",
      color: 0,
      displayName: "秦",
      identityStage: "STATE",
      stateFoundedMonth: 0,
      sovereigntyRank: "EMPEROR",
      sovereigntyHistory: [{ rank: "EMPEROR" as const, startMonth: 0 }],
      nameHistory: [{ name: "秦", startMonth: 0 }],
    },
  ],
  [
    "yang_1",
    {
      name: "yang_1",
      color: 1,
      displayName: "阳",
      identityStage: "STATE",
      stateFoundedMonth: 120,
      sovereigntyRank: "EMPEROR",
      sovereigntyHistory: [
        { rank: "LEADER" as const, startMonth: 100, endMonth: 119 },
        { rank: "KING" as const, startMonth: 120, endMonth: 164 },
        { rank: "EMPEROR" as const, startMonth: 165 },
      ],
      nameHistory: [
        { name: "邯郸义军", startMonth: 100, endMonth: 119 },
        { name: "阳", startMonth: 120 },
      ],
    },
  ],
]);

describe("faction history formatter", () => {
  it("does not relate world start to every faction chronicle", () => {
    expect(getFactionEventRelation(event({ type: "world-born", factionIds: ["秦"] }), "秦")).toBe("NONE");
  });

  it("formats child founding from parent split metadata", () => {
    const text = formatFactionHistoryEvent(
      event({
        type: "empire-split",
        actorFactionId: "yang_1",
        targetFactionId: "秦",
        metadata: {
          parentFactionId: "秦",
          foundingCityNames: "邯郸、巨鹿",
          foundingRulerName: "赵平",
          groupedFoundingEventCount: 3,
        },
      }),
      "yang_1",
      factions
    );
    expect(text).toContain("邯郸、巨鹿脱离秦");
    expect(text).toContain("邯郸义军建立");
    expect(text).toContain("赵平成为首任首领");
  });

  it("formats emperor proclamation as dynasty establishment", () => {
    expect(
      formatFactionHistoryEvent(
        event({
          type: "emperor-proclaimed",
          year: 165,
          monthIndex: 165,
          actorFactionId: "yang_1",
          metadata: { rulerName: "赵子宣" },
        }),
        "yang_1",
        factions
      )
    ).toBe("阳王赵子宣称帝，阳朝建立。");
  });

  it("formats conquest from conqueror and conquered perspectives without flipping subject", () => {
    const grouped = groupHistoryNarratives([
      event({
        id: "capital-fallen-1",
        type: "capital-fallen",
        category: "war",
        actorFactionId: "魏",
        targetFactionId: "韩",
        conquerorFactionId: "魏",
        factionIds: ["魏", "韩"],
        cityName: "新郑",
      }),
      event({
        id: "faction-exiled-1",
        type: "faction-exiled",
        actorFactionId: "魏",
        targetFactionId: "韩",
        conquerorFactionId: "魏",
        factionIds: ["魏", "韩"],
      }),
    ]);
    const collapse = grouped.find((item) => item.metadata?.groupedEventCount);
    expect(collapse).toBeDefined();
    expect(formatFactionHistoryEvent(collapse!, "魏", factions)).toContain("魏攻陷韩都新郑，灭韩");
    expect(formatFactionHistoryEvent(collapse!, "魏", factions)).not.toContain("魏亡国");
    expect(formatFactionHistoryEvent(collapse!, "韩", factions)).toContain("韩亡国");
  });

  it("keeps captured victim ruler inside the same collapse narrative", () => {
    const grouped = groupHistoryNarratives([
      event({
        id: "capital-fallen-qi",
        type: "capital-fallen",
        category: "war",
        actorFactionId: "魏",
        targetFactionId: "齐",
        conquerorFactionId: "魏",
        factionIds: ["魏", "齐"],
        cityName: "临淄",
      }),
      event({
        id: "ruler-captured-qi",
        type: "ruler-captured",
        actorFactionId: "魏",
        targetFactionId: "齐",
        conquerorFactionId: "魏",
        factionIds: ["魏", "齐"],
        metadata: {
          capturedRulerTitle: "齐王田安",
          rulerName: "田安",
        },
      }),
      event({
        id: "faction-exiled-qi",
        type: "faction-exiled",
        actorFactionId: "魏",
        targetFactionId: "齐",
        conquerorFactionId: "魏",
        factionIds: ["魏", "齐"],
      }),
    ]);
    const collapse = grouped.find((item) => item.metadata?.groupedEventCount);
    expect(formatFactionHistoryEvent(collapse!, "魏", factions)).toBe(
      "魏攻陷齐都临淄，灭齐；齐王田安被俘处死。"
    );
    expect(formatFactionHistoryEvent(collapse!, "齐", factions)).toContain(
      "齐亡国，齐王田安被俘处死，王室流亡"
    );
  });

  it("formats fallback exile events by relation when no narrative group is available", () => {
    const exile = event({
      type: "faction-exiled",
      actorFactionId: "魏",
      targetFactionId: "楚",
      conquerorFactionId: "魏",
      factionIds: ["魏", "楚"],
    });
    expect(formatFactionHistoryEvent(exile, "魏", factions)).toBe("魏灭楚。");
    expect(formatFactionHistoryEvent(exile, "楚", factions)).toBe("楚亡国，王室流亡。");
  });
});
