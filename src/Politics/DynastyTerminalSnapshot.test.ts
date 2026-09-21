import { describe, expect, it } from "vitest";
import { createTerminalRulerSnapshot } from "./RulerTerminalSnapshot";

describe("terminal ruler snapshots", () => {
  it("normalizes extinct political state even when runtime references remain", () => {
    expect(createTerminalRulerSnapshot(120)).toEqual({
      month: 120,
      population: 0,
      territoryShare: 0,
      cityCount: 0,
      stability: 0,
    });
  });
});
