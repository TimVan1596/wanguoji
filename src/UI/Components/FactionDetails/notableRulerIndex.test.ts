import { describe, expect, it } from "vitest";
import { buildNotableRulerIndexEntry } from "./notableRulerIndex";

describe("notable ruler index", () => {
  it("shows reign date range before the posthumous display name", () => {
    expect(
      buildNotableRulerIndexEntry({
        start: "130年7月",
        end: "145年4月",
        displayName: "襄王 · 熊怀",
        tags: ["开国"],
      })
    ).toEqual({
      dateRange: "130年7月—145年4月",
      displayName: "襄王 · 熊怀",
      tagLine: "开国",
    });
  });

  it("does not create an empty duplicated name tag line", () => {
    const entry = buildNotableRulerIndexEntry({
      start: "182年12月",
      end: "195年8月",
      displayName: "穆王 · 熊靖",
      tags: [],
    });
    expect(entry.displayName).toBe("穆王 · 熊靖");
    expect(entry.tagLine).toBeUndefined();
  });
});
