import { describe, expect, it } from "vitest";
import {
  getHistorySignificance,
  getMajorPoliticalEventsForFaction,
  isFeaturedHistoryEvent,
  isMajorPoliticalEvent,
  selectMajorTimelineMarkers,
} from "./HistorySignificanceRules";
import type { WorldEvent } from "./WorldHistory";

function event(partial: Partial<WorldEvent> & Pick<WorldEvent, "type">): WorldEvent {
  return {
    id: partial.type,
    year: 100,
    monthIndex: 100,
    category: "politics",
    title: partial.type,
    importance: "normal",
    actorFactionId: "梁",
    factionIds: ["梁"],
    ...partial,
  };
}

describe("history significance rules", () => {
  it("keeps routine ruler death, succession, and city founding out of major politics", () => {
    expect(isMajorPoliticalEvent(event({ type: "ruler-died" }))).toBe(false);
    expect(isMajorPoliticalEvent(event({ type: "ruler-succession" }))).toBe(false);
    expect(isMajorPoliticalEvent(event({ type: "city-founded" }))).toBe(false);
  });

  it("keeps state formation, exile, restoration, unification, and split as major politics", () => {
    expect(isMajorPoliticalEvent(event({ type: "state-founded", importance: "major" }))).toBe(true);
    expect(isMajorPoliticalEvent(event({ type: "emperor-proclaimed", importance: "major" }))).toBe(true);
    expect(isMajorPoliticalEvent(event({ type: "faction-exiled", importance: "major" }))).toBe(true);
    expect(isMajorPoliticalEvent(event({ type: "faction-restored", importance: "major" }))).toBe(true);
    expect(isMajorPoliticalEvent(event({ type: "world-unification", importance: "major" }))).toBe(true);
    expect(isMajorPoliticalEvent(event({ type: "empire-split", importance: "major" }))).toBe(true);
  });

  it("returns only major faction chronicle events", () => {
    const events = [
      event({ type: "ruler-succession" }),
      event({ type: "state-founded", importance: "major" }),
      event({ type: "faction-restored", importance: "major" }),
    ];
    expect(getMajorPoliticalEventsForFaction(events, "梁").map((item) => item.type)).toEqual([
      "state-founded",
      "faction-restored",
    ]);
  });

  it("selects timeline markers from major events only", () => {
    const events = [
      event({ type: "ruler-succession", year: 10, monthIndex: 10 }),
      event({ type: "state-founded", year: 20, monthIndex: 20, importance: "major" }),
      event({ type: "world-unification", year: 30, monthIndex: 30, importance: "major" }),
    ];
    expect(selectMajorTimelineMarkers(events, "梁").map((item) => item.type)).toEqual([
      "state-founded",
      "world-unification",
    ]);
  });

  it("classifies featured history by shared significance levels", () => {
    expect(getHistorySignificance(event({ type: "state-founded", importance: "major" }))).toBe("LANDMARK");
    expect(getHistorySignificance(event({ type: "emperor-proclaimed", importance: "major" }))).toBe("LANDMARK");
    expect(getHistorySignificance(event({ type: "population-surrendered" }))).toBe("MINOR");
    expect(isFeaturedHistoryEvent(event({ type: "ruler-succession" }))).toBe(false);
    expect(
      isFeaturedHistoryEvent(
        event({
          type: "faction-exiled",
          importance: "major",
          metadata: { groupedEventCount: 3 },
        })
      )
    ).toBe(true);
  });
});
