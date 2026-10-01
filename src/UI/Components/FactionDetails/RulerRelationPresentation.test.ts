import { describe, expect, it } from "vitest";
import {
  formatRulerLineage,
  formatRulerRelation,
} from "./RulerRelationPresentation";

describe("ruler relation presentation", () => {
  it("describes provisional leader succession without implying heredity", () => {
    expect(formatRulerRelation("LEADER_SUCCESSOR", "PROVISIONAL", false)).toBe(
      "非世袭首领继任"
    );
    expect(formatRulerLineage("LEADER_SUCCESSOR")).toBe("无直系世系记录");
  });

  it("keeps direct-child and formal new-house lineage distinct", () => {
    expect(formatRulerRelation("DIRECT_CHILD", "STATE", true)).toBe("前君之子");
    expect(formatRulerLineage("DIRECT_CHILD", "秦王嬴平")).toBe("父：秦王嬴平");
    expect(formatRulerRelation("NEW_HOUSE", "STATE", false)).toBe(
      "易姓 / 新家族继位"
    );
    expect(formatRulerLineage("NEW_HOUSE", undefined, "STATE")).toBe(
      "易姓 / 新家族继位"
    );
  });
});
