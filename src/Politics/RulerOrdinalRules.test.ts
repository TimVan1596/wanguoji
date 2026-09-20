import { describe, expect, it } from "vitest";
import { getNextRulerReignOrdinal } from "./RulerOrdinalRules";

describe("ruler ordinal rules", () => {
  it("counts only formally acceded rulers", () => {
    expect(
      getNextRulerReignOrdinal([
        { reignOrdinal: 1 },
        {},
        { reignOrdinal: 2 },
        {},
      ])
    ).toBe(3);
  });
});
