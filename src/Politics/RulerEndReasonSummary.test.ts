import { describe, expect, it } from "vitest";
import type { Ruler } from "./Dynasty";
import { summarizeRulerEndReasons } from "./RulerEndReasonSummary";

function ruler(endReason?: string): Ruler {
  return {
    id: endReason ?? "active",
    houseName: "韩氏",
    givenName: "安",
    bornYear: 0,
    accessionYear: 100,
    endYear: endReason ? 120 : undefined,
    reignOrdinal: 1,
    status: endReason ? "dead" : "ruling",
    endReason,
  };
}

describe("ruler end reason summary", () => {
  it("summarizes natural, battle, capture, and other finished reigns", () => {
    expect(
      summarizeRulerEndReasons([
        ruler("去世"),
        ruler("战死"),
        ruler("被俘处死"),
        ruler("彻底灭亡"),
        ruler(),
      ])
    ).toEqual({
      natural: 1,
      battle: 1,
      capture: 1,
      other: 1,
    });
  });
});
