import { describe, expect, it } from "vitest";
import { deriveWorldRecords } from "./WorldRecords";

describe("world records", () => {
  it("derives objective records from canonical events and eras", () => {
    const records = deriveWorldRecords([], [
      { name: "秦", displayName: "秦", firstFoundedYear: 0, cumulativeActiveYears: 80, getCumulativeActiveYears: () => 80 },
    ] as any, [
      { id: "e1", year: 12, type: "emperor-proclaimed", title: "秦称帝" },
      { id: "e2", year: 30, type: "world-unification", title: "秦统一天下" },
    ] as any, [
      { id: "era", name: "群雄争衡", startMonth: 0, endMonth: 120, type: "MULTIPOLAR" },
    ] as any);
    expect(records.map((record) => record.label)).toContain("最长国祚");
    expect(records.map((record) => record.label)).toContain("最早称帝");
    expect(records.map((record) => record.label)).toContain("首次统一天下");
  });
});
