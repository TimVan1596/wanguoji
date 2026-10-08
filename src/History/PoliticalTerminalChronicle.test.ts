import { describe, expect, it } from "vitest";
import { getRulerTerminalRole, formatRulerTerminalEvent } from "./PoliticalTerminalChronicle";
import { getRulerHistoricalEvents } from "../Politics/RulerChronicle";
import type { WorldEvent } from "./WorldHistory";
import worldRandom from "../Simulation/WorldRandom";
import { CURRENT_SAVE_SCHEMA_VERSION } from "../Persistence/WorldSaveSchema";

const factions = new Map([
  ["a", { name: "a", color: 1, displayName: "新张", nameHistory: [{ name: "张", startMonth: 0, endMonth: 120 }, { name: "新张", startMonth: 121 }] }],
  ["b", { name: "b", color: 2, displayName: "秦", nameHistory: [{ name: "鄄", startMonth: 0, endMonth: 120 }, { name: "秦", startMonth: 121 }] }],
]);
const source = { id: "last", accessionYear: 20, endYear: 100, status: "abdicated", endReason: "纳土退位" };
const receiver = { id: "receiver", accessionYear: 40, endYear: 110 };
const submission: WorldEvent = { id: "end", type: "faction-submitted", year: 100, monthIndex: 100,
  category: "politics", importance: "major", title: "stored", actorFactionId: "a", targetFactionId: "b",
  factionIds: ["a", "b"], metadata: { submittedFactionId: "a", receivingFactionId: "b", submittedRulerId: "last", receivingRulerId: "receiver" } };
const merger: WorldEvent = { ...submission, type: "faction-merged", actorFactionId: undefined, targetFactionId: undefined,
  metadata: { absorbedFactionId: "a", absorbingFactionId: "b" } };

describe("political terminal chronicles, including existing V11 events", () => {
  it("attributes recorded submission roles to both actual rulers with historical identities", () => {
    expect(getRulerTerminalRole(submission, source, "a")).toBe("SOURCE");
    expect(getRulerTerminalRole(submission, receiver, "b")).toBe("RECEIVER");
    expect(formatRulerTerminalEvent(submission, source, "a", factions)).toBe("纳土退位，张纳土归附于鄄");
    expect(formatRulerTerminalEvent(submission, receiver, "b", factions)).toContain("受纳张来归");
    expect(formatRulerTerminalEvent({ ...submission, year: 130, monthIndex: 130 }, { ...source, endYear: 130 }, "a", factions)).toContain("新张纳土归附于秦");
  });
  it("does not give an event to a different ruler, another faction, or outside the recorded reign", () => {
    for (const ruler of [{ ...receiver, id: "wrong" }, { ...receiver, accessionYear: 101 }, { ...receiver, endYear: 99 }]) {
      expect(getRulerHistoricalEvents([submission], ruler, "b", 200, [submission.id])).toEqual([]);
    }
    expect(getRulerTerminalRole(submission, receiver, "unrelated")).toBeUndefined();
    expect(getRulerTerminalRole(submission, source, "b")).toBeUndefined();
  });
  it("reads legacy merger roles without inventing ruler IDs or current-ruler backfill", () => {
    const last = { ...source, endReason: "合邦退位" };
    expect(getRulerHistoricalEvents([merger], last, "a", 200, [])).toEqual([merger]);
    expect(getRulerHistoricalEvents([merger], receiver, "b", 200, [])).toEqual([merger]);
    expect(formatRulerTerminalEvent(merger, last, "a", factions)).toBe("合邦退位，张归并于鄄");
    expect(formatRulerTerminalEvent(merger, receiver, "b", factions)).toContain("吸收张归并");
    expect(getRulerTerminalRole(merger, { ...last, status: "dead" }, "a")).toBeUndefined();
    expect(getRulerTerminalRole(merger, { ...receiver, endYear: 100 }, "b")).toBeUndefined();
    expect(getRulerTerminalRole(merger, { ...receiver, accessionYear: 101 }, "b")).toBeUndefined();
    expect(getRulerTerminalRole({ ...merger, metadata: { ...merger.metadata, absorbingRulerId: "other" } }, receiver, "b")).toBeUndefined();
  });
  it("keeps terminal events ahead of ordinary diplomacy even with a one-entry selection", () => {
    const diplomacy: WorldEvent[] = Array.from({ length: 20 }, (_, i) => ({ ...submission, id: `d-${i}`, year: 50 + i, monthIndex: 50 + i,
      type: "alliance-signed", metadata: { signatoryARulerId: source.id } }));
    expect(getRulerHistoricalEvents([...diplomacy, submission], source, "a", 200, [], 1)).toEqual([submission]);
  });
  it("does not mutate canonical objects, draw RNG, or alter V11", () => {
    const state = JSON.stringify({ source, receiver, submission, merger, factions: [...factions] });
    const rng = worldRandom.exportState();
    const run = () => [getRulerHistoricalEvents([submission, merger], receiver, "b", 200, []), formatRulerTerminalEvent(submission, receiver, "b", factions)];
    expect(run()).toEqual(run());
    expect(JSON.stringify({ source, receiver, submission, merger, factions: [...factions] })).toBe(state);
    expect(worldRandom.exportState()).toEqual(rng);
    expect(CURRENT_SAVE_SCHEMA_VERSION).toBe(12);
  });
});
