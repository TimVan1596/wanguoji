import { describe, expect, it } from "vitest";
import {
  createFactionColorMap,
  formatHistoryEventDescription,
  formatHistoryEventTitle,
  getFilteredHistoryEvents,
  getRenderedHistoryEvents,
  HISTORY_RENDER_BATCH,
  resolveFactionHistoricalName,
  resolveEventFactionColor,
} from "./HistoryRenderRules";
import type { WorldEvent } from "./WorldHistory";

function event(index: number, category: WorldEvent["category"] = "politics"): WorldEvent {
  return {
    id: `event-${index}`,
    year: index,
    category,
    type: "ruler-succession",
    title: `事件${index}`,
    actorFactionId: index % 2 === 0 ? "新郑义军" : "韩",
    factionIds: [index % 2 === 0 ? "新郑义军" : "韩"],
    importance: "normal",
  };
}

describe("history render rules", () => {
  it("limits default rendered rows for long histories", () => {
    const events = Array.from({ length: 5000 }, (_, index) => event(index));
    expect(getRenderedHistoryEvents(events, "all", HISTORY_RENDER_BATCH)).toHaveLength(
      HISTORY_RENDER_BATCH
    );
  });

  it("keeps featured history focused on selected major narratives", () => {
    const routineSuccession = event(1, "politics");
    routineSuccession.type = "ruler-succession";
    const routineCity = event(2, "politics");
    routineCity.type = "city-founded";
    const collapse = event(3, "politics");
    collapse.type = "faction-exiled";
    collapse.importance = "major";
    collapse.metadata = { groupedEventCount: 3 };
    expect(getFilteredHistoryEvents([routineSuccession, routineCity, collapse], "featured")).toEqual([
      collapse,
    ]);
  });

  it("keeps category and faction filters working before batching", () => {
    const events = [
      { ...event(0, "politics"), type: "state-founded" as const, importance: "major" as const },
      event(1, "war"),
      event(2, "god"),
      event(3, "politics"),
    ];
    expect(getFilteredHistoryEvents(events, "war")).toHaveLength(1);
    expect(getFilteredHistoryEvents(events, "politics", "新郑义军")).toHaveLength(1);
    expect(getFilteredHistoryEvents(events, "god")).toHaveLength(1);
  });

  it("resolves runtime faction colors by actor faction id before text names", () => {
    const colors = createFactionColorMap([
      { name: "韩", color: 0xf57c00 },
      { name: "新郑义军", color: 0x123456 },
    ]);
    const succession = event(0);
    succession.title = "新郑义军王韩昭战死，韩怀继位";

    expect(resolveEventFactionColor(succession, colors)).toBe(0x123456);
  });

  it("resolves old faction display names before rename month", () => {
    const factions = new Map([
      [
        "rebel_17",
        {
          name: "rebel_17",
          color: 0x123456,
          displayName: "梁",
          nameHistory: [
            { name: "大梁义军", startMonth: 20, endMonth: 479 },
            { name: "梁", startMonth: 480 },
          ],
        },
      ],
    ]);
    expect(resolveFactionHistoricalName(factions, "rebel_17", 240)).toBe("大梁义军");
  });

  it("resolves new faction display names after rename month", () => {
    const factions = new Map([
      [
        "rebel_17",
        {
          name: "rebel_17",
          color: 0x123456,
          displayName: "梁",
          nameHistory: [
            { name: "大梁义军", startMonth: 20, endMonth: 479 },
            { name: "梁", startMonth: 480 },
          ],
        },
      ],
    ]);
    expect(resolveFactionHistoricalName(factions, "rebel_17", 500)).toBe("梁");
  });

  it("formats old city capture events with the historical rebel name", () => {
    const factions = new Map([
      [
        "rebel_17",
        {
          name: "rebel_17",
          color: 0x123456,
          displayName: "梁",
          nameHistory: [
            { name: "大梁义军", startMonth: 20, endMonth: 479 },
            { name: "梁", startMonth: 480 },
          ],
        },
      ],
      ["齐", { name: "齐", color: 0x00aa00, displayName: "齐" }],
    ]);
    const capture = event(240, "war");
    capture.type = "city-captured";
    capture.actorFactionId = "rebel_17";
    capture.targetFactionId = "齐";
    capture.founderFactionId = "齐";
    capture.cityName = "临淄";
    capture.metadata = { wasCapital: 1 };
    expect(formatHistoryEventTitle(capture, factions)).toContain("大梁义军攻陷齐都临淄");
  });

  it("formats new city capture events with the formal state name", () => {
    const factions = new Map([
      [
        "rebel_17",
        {
          name: "rebel_17",
          color: 0x123456,
          displayName: "梁",
          nameHistory: [
            { name: "大梁义军", startMonth: 20, endMonth: 479 },
            { name: "梁", startMonth: 480 },
          ],
        },
      ],
      ["赵", { name: "赵", color: 0x00aa00, displayName: "赵" }],
    ]);
    const capture = event(500, "war");
    capture.type = "city-captured";
    capture.actorFactionId = "rebel_17";
    capture.targetFactionId = "赵";
    capture.founderFactionId = "赵";
    capture.cityName = "邯郸";
    capture.metadata = { wasCapital: 1 };
    expect(formatHistoryEventTitle(capture, factions)).toContain("梁攻陷赵都邯郸");
  });

  it("keeps ruler title snapshots for pre-state and post-state events", () => {
    const factions = new Map([
      [
        "rebel_17",
        {
          name: "rebel_17",
          color: 0x123456,
          displayName: "梁",
          nameHistory: [
            { name: "大梁义军", startMonth: 20, endMonth: 479 },
            { name: "梁", startMonth: 480 },
          ],
        },
      ],
      ["齐", { name: "齐", color: 0x00aa00, displayName: "齐" }],
    ]);
    const before = event(240, "war");
    before.type = "city-captured";
    before.actorFactionId = "rebel_17";
    before.targetFactionId = "齐";
    before.founderFactionId = "齐";
    before.cityName = "临淄";
    before.metadata = { wasCapital: 1, rulerName: "大梁义军首领魏安" };
    const after = event(500, "war");
    after.type = "city-captured";
    after.actorFactionId = "rebel_17";
    after.targetFactionId = "齐";
    after.founderFactionId = "齐";
    after.cityName = "临淄";
    after.metadata = { wasCapital: 1, rulerName: "梁王魏安" };

    expect(formatHistoryEventTitle(before, factions)).toContain(
      "大梁义军首领魏安亲征"
    );
    expect(formatHistoryEventTitle(after, factions)).toContain("梁王魏安亲征");
  });

  it("formats grouped collapse with capital fall and exile", () => {
    const factions = new Map([
      ["赵", { name: "赵", color: 0x00aa00, displayName: "赵" }],
      ["秦", { name: "秦", color: 0xaa0000, displayName: "秦" }],
    ]);
    const collapse = event(180, "politics");
    collapse.type = "faction-exiled";
    collapse.actorFactionId = "赵";
    collapse.conquerorFactionId = "赵";
    collapse.targetFactionId = "秦";
    collapse.metadata = {
      groupedEventCount: 3,
      capturedCityName: "咸阳",
      capitalCaptured: 1,
      exiled: 1,
      surrenderedPopulation: 1,
    };
    expect(formatHistoryEventTitle(collapse, factions)).toBe(
      "赵攻陷秦都咸阳，秦亡国，王室流亡。"
    );
    expect(formatHistoryEventDescription(collapse, factions)).toBe("1名败兵投降。");
  });

  it("formats provisional grouped collapse as dissolution instead of royal extinction", () => {
    const factions = new Map([
      [
        "rebel_1",
        {
          name: "rebel_1",
          color: 0x00aa00,
          displayName: "新郑义军",
          identityStage: "PROVISIONAL",
          sovereigntyRank: "LEADER",
          sovereigntyHistory: [{ rank: "LEADER" as const, startMonth: 10 }],
          nameHistory: [{ name: "新郑义军", startMonth: 10 }],
        },
      ],
      ["魏", { name: "魏", color: 0xaa0000, displayName: "魏" }],
    ]);
    const collapse = event(180, "politics");
    collapse.type = "faction-dissolved";
    collapse.targetFactionId = "rebel_1";
    collapse.conquerorFactionId = "魏";
    collapse.metadata = {
      groupedEventCount: 2,
      dissolved: 1,
    };
    expect(formatHistoryEventTitle(collapse, factions)).toBe("新郑义军覆灭。");
  });
});
