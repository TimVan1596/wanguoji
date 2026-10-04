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

  it("labels recorded grandchildren and siblings without inventing a more exact kin branch", () => {
    expect(formatRulerRelation("GRANDCHILD", "STATE", true)).toBe("前君之孙");
    expect(formatRulerRelation("SIBLING", "STATE", true)).toBe("前君之兄弟");
    expect(formatRulerRelation("COLLATERAL_KIN", "STATE", true)).toBe("宗室旁支");
  });

  it("formats recorded nephew, uncle, and cousin succession relations", () => {
    expect(formatRulerRelation("NEPHEW", "STATE", true)).toBe("前君之侄");
    expect(formatRulerRelation("UNCLE", "STATE", true)).toBe("前君之伯叔");
    expect(formatRulerRelation("COUSIN", "STATE", true)).toBe("前君之堂兄弟");
  });

  it("does not retroactively call a provisional founder an 开国君主 after the faction becomes a state", () => {
    expect(formatRulerRelation("FOUNDER", "STATE", false, false)).toBe("首任首领 / 势力创始人");
    expect(formatRulerLineage("FOUNDER", undefined, "STATE", false)).toBe("首任首领");
    expect(formatRulerRelation("FOUNDER", "PROVISIONAL", false, true)).toBe("开国君主");
  });
});
