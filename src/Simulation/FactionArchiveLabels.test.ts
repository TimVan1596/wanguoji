import { describe, expect, it } from "vitest";
import { createFactionArchiveLabelMap } from "./FactionArchiveLabels";

describe("faction archive labels", () => {
  it("keeps a unique formal state name unchanged", () => {
    const labels = createFactionArchiveLabelMap([
      {
        name: "liang_1",
        displayName: "梁",
        identityStage: "STATE",
        stateFoundedMonth: 10,
        nameHistory: [{ name: "梁", startMonth: 10 }],
      },
    ]);
    expect(labels.get("liang_1")).toBe("梁");
  });

  it("disambiguates repeated historical state names without numeric suffixes", () => {
    const labels = createFactionArchiveLabelMap([
      {
        name: "liang_1",
        displayName: "梁",
        identityStage: "STATE",
        stateFoundedMonth: 10,
        nameHistory: [{ name: "梁", startMonth: 10 }],
      },
      {
        name: "liang_2",
        displayName: "梁",
        identityStage: "STATE",
        stateFoundedMonth: 200,
        nameHistory: [{ name: "梁", startMonth: 200 }],
      },
    ]);
    expect(labels.get("liang_1")).toBe("前梁");
    expect(labels.get("liang_2")).toBe("后梁");
  });
});
