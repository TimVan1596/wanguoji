import { describe, expect, it } from "vitest";
import type { Ruler } from "./Dynasty";
import { formatHeirDeathText, getFormalRulers, getLivingHeirs } from "./RulerPresentationRules";

const formal = { id: "r1", houseName: "姬氏", givenName: "安", bornYear: 0, status: "dead" as const, accessionYear: 20, reignOrdinal: 1, chronicle: {} as NonNullable<Ruler["chronicle"]> };
const heir = { id: "h1", houseName: "姬氏", givenName: "衡", bornYear: 30, status: "heir" as const };
const deadHeir = { ...heir, id: "h2", status: "dead" as const, endYear: 50, endReason: "自然去世" };

describe("ruler presentation rules", () => {
  it("keeps non-accessed heirs in dynasty data but excludes them from formal ruler rows", () => {
    const rulers: Ruler[] = [formal, heir, deadHeir];
    expect(getFormalRulers(rulers).map(({ id }) => id)).toEqual(["r1"]);
    expect(getLivingHeirs(rulers).map(({ id }) => id)).toEqual(["h1"]);
    expect(rulers).toHaveLength(3);
  });

  it("formats heir death with the recorded cause", () => {
    expect(formatHeirDeathText("姬衡", "natural", "燕王")).toBe("储君姬衡去世，先于燕王而卒。");
    expect(formatHeirDeathText("姬衡", "combat", "燕王")).toContain("战死");
  });
});
