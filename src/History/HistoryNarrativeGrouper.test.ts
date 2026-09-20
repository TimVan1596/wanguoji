import { describe, expect, it } from "vitest";
import { groupHistoryNarratives } from "./HistoryNarrativeGrouper";
import { formatHistoryEventTitle } from "./HistoryRenderRules";
import type { WorldEvent } from "./WorldHistory";

function event(partial: Partial<WorldEvent> & Pick<WorldEvent, "id" | "type">): WorldEvent {
  return {
    year: 25,
    monthIndex: 25,
    category: "politics",
    title: partial.id,
    importance: "major",
    ...partial,
  };
}

describe("history narrative grouper", () => {
  it("collapses same-month ruler capture, succession, and exile into one narrative", () => {
    const grouped = groupHistoryNarratives([
      event({
        id: "captured",
        type: "ruler-captured",
        actorFactionId: "魏",
        targetFactionId: "韩",
        factionIds: ["韩", "魏"],
        metadata: { rulerName: "韩惠" },
      }),
      event({
        id: "succession",
        type: "ruler-succession",
        actorFactionId: "韩",
        factionIds: ["韩"],
        metadata: { nextRulerName: "韩烈" },
      }),
      event({
        id: "dynasty-exiled",
        type: "dynasty-exiled",
        actorFactionId: "韩",
        factionIds: ["韩"],
      }),
      event({
        id: "faction-exiled",
        type: "faction-exiled",
        targetFactionId: "韩",
        conquerorFactionId: "魏",
        factionIds: ["韩"],
      }),
    ]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0].title).toBe(
      "魏灭韩。韩王韩惠被俘处死，韩烈继位，王室流亡。"
    );
    expect(grouped[0].metadata?.groupedEventCount).toBe(4);
  });

  it("uses historyGroupId to collapse capital fall, exile, and population surrender", () => {
    const grouped = groupHistoryNarratives([
      event({
        id: "capital",
        type: "capital-fallen",
        actorFactionId: "赵",
        targetFactionId: "秦",
        conquerorFactionId: "赵",
        cityName: "咸阳",
        factionIds: ["赵", "秦"],
        historyGroupId: "collapse-qin-180",
      }),
      event({
        id: "faction-exiled",
        type: "faction-exiled",
        targetFactionId: "秦",
        conquerorFactionId: "赵",
        factionIds: ["秦"],
        historyGroupId: "collapse-qin-180",
      }),
      event({
        id: "surrender",
        type: "population-surrendered",
        actorFactionId: "秦",
        targetFactionId: "赵",
        factionIds: ["秦", "赵"],
        metadata: { surrenderedPopulation: 1 },
        historyGroupId: "collapse-qin-180",
      }),
    ]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0].metadata?.capturedCityName).toBe("咸阳");
    expect(grouped[0].metadata?.surrenderedPopulation).toBe(1);
  });

  it("uses extinction wording when no exile chain remains", () => {
    const grouped = groupHistoryNarratives([
      event({
        id: "captured",
        type: "ruler-captured",
        actorFactionId: "秦",
        targetFactionId: "赵",
        factionIds: ["赵", "秦"],
        metadata: { rulerName: "赵平" },
      }),
      event({
        id: "faction-extinct",
        type: "faction-extinct",
        targetFactionId: "赵",
        conquerorFactionId: "秦",
        factionIds: ["赵"],
      }),
    ]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0].title).toBe("秦灭赵。赵王赵平被俘处死，赵国王统断绝。");
  });

  it("groups same-month royal line end and final extinction", () => {
    const grouped = groupHistoryNarratives([
      event({
        id: "line-ended",
        type: "dynasty-line-ended",
        actorFactionId: "齐",
        factionIds: ["齐"],
      }),
      event({
        id: "faction-extinct",
        type: "faction-extinct",
        targetFactionId: "齐",
        factionIds: ["齐"],
      }),
    ]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0].metadata?.groupedEventCount).toBe(2);
  });

  it("groups provisional faction dissolution without duplicate collapse clauses", () => {
    const grouped = groupHistoryNarratives([
      event({
        id: "capital",
        type: "capital-fallen",
        actorFactionId: "魏",
        targetFactionId: "新郑义军",
        conquerorFactionId: "魏",
        factionIds: ["魏", "新郑义军"],
        historyGroupId: "collapse-rebel-88",
      }),
      event({
        id: "dissolved",
        type: "faction-dissolved",
        targetFactionId: "新郑义军",
        factionIds: ["新郑义军"],
        historyGroupId: "collapse-rebel-88",
      }),
    ]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0].metadata?.dissolved).toBe(1);
    expect(grouped[0].title).not.toContain("亡国，亡国");
  });

  it("does not collapse events from a different month or faction", () => {
    const grouped = groupHistoryNarratives([
      event({
        id: "captured",
        type: "ruler-captured",
        actorFactionId: "魏",
        targetFactionId: "韩",
      }),
      event({
        id: "faction-exiled",
        type: "faction-exiled",
        year: 26,
        monthIndex: 26,
        targetFactionId: "韩",
        conquerorFactionId: "魏",
      }),
    ]);
    expect(grouped).toHaveLength(2);
  });

  it("groups same-month new faction founding chains with founding cities", () => {
    const grouped = groupHistoryNarratives([
      event({
        id: "split",
        type: "empire-split",
        actorFactionId: "新郑义军",
        targetFactionId: "韩",
        factionIds: ["韩", "新郑义军"],
        metadata: {
          parentFactionId: "韩",
          foundingCityNames: "新郑、大梁",
          foundingRulerName: "韩威",
        },
      }),
      event({
        id: "city-revolt",
        type: "city-revolt",
        actorFactionId: "新郑义军",
        targetFactionId: "韩",
        cityName: "南阳",
        factionIds: ["韩", "新郑义军"],
      }),
      event({
        id: "acceded",
        type: "ruler-acceded",
        actorFactionId: "新郑义军",
        factionIds: ["新郑义军"],
        title: "韩威继位",
      }),
    ]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0].metadata?.groupedFoundingEventCount).toBe(3);
    expect(grouped[0].metadata?.foundingCityNames).toBe("新郑、大梁、南阳");
    expect(
      formatHistoryEventTitle(
        grouped[0],
        new Map([
          ["韩", { name: "韩", color: 1, displayName: "韩" }],
          ["新郑义军", { name: "新郑义军", color: 2, displayName: "新郑义军" }],
        ])
      )
    ).toBe("韩发生大规模叛乱。新郑、大梁、南阳脱离韩，建立新郑义军，韩威成为首任君主。");
  });

  it("groups restoration chains by historyGroupId", () => {
    const grouped = groupHistoryNarratives([
      event({
        id: "city-revolt",
        type: "city-revolt",
        actorFactionId: "魏",
        targetFactionId: "楚",
        cityName: "大梁",
        factionIds: ["魏", "楚"],
        historyGroupId: "restoration-wei-200",
      }),
      event({
        id: "restored",
        type: "faction-restored",
        actorFactionId: "魏",
        cityName: "大梁",
        factionIds: ["魏"],
        historyGroupId: "restoration-wei-200",
      }),
    ]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0].metadata?.groupedRestorationEventCount).toBe(2);
  });
});
