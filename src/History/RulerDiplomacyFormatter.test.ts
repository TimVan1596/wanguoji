import { describe, expect, it } from "vitest";
import { formatRulerDiplomacyEvent } from "./RulerDiplomacyFormatter";

describe("ruler diplomacy event summary", () => {
  it("uses actual common-threat and duration metadata without repeating signatory rulers", () => {
    const line = formatRulerDiplomacyEvent({
      id: "nap", year: 180, monthIndex: 180, category: "politics", type: "non-aggression-signed",
      title: "楚、魏订立互不侵犯", factionIds: ["chu", "wei"], importance: "major",
      metadata: { commonThreatFactionId: "qi", expiresMonth: 276, signatoryARulerId: "r1" },
    }, new Map([["chu", { name: "chu", displayName: "楚", color: 1 }], ["wei", { name: "wei", displayName: "魏", color: 2 }], ["qi", { name: "qi", displayName: "齐", color: 3 }]]));
    expect(line).toContain("齐构成共同威胁");
    expect(line).toContain("约期8年");
    expect(line).not.toContain("签约时君主");
  });
  it("leaves ordinary ruler biography events to their existing formatter", () => {
    expect(formatRulerDiplomacyEvent({
      id: "capture", year: 12, category: "war", type: "city-captured", title: "攻陷城邑", importance: "normal",
    }, new Map())).toBeUndefined();
  });
});
