import { describe, expect, it } from "vitest";
import { getMergedEventPresentation } from "./MergedEventPresentation";
import { formatHistoryEventDescription, formatHistoryEventTitle, type HistoryFactionLike } from "./HistoryRenderRules";
import type { WorldEvent } from "./WorldHistory";

const month = 1161 * 12;
const factions = new Map<string, HistoryFactionLike>([
  ["zhou", { name: "zhou", displayName: "新州", color: 1, nameHistory: [{ name: "州", startMonth: 0, endMonth: month + 11 }, { name: "新州", startMonth: month + 12 }] }],
  ["dong", { name: "dong", displayName: "秦", color: 2, nameHistory: [{ name: "董", startMonth: 0, endMonth: month + 11 }, { name: "秦", startMonth: month + 12 }] }],
]);
const event: WorldEvent = { id: "old-v12-merge", year: month, monthIndex: month, category: "politics", type: "faction-merged", importance: "major", title: "州归并董", description: "旧文案", metadata: { absorbedFactionId: "zhou", absorbingFactionId: "dong" } };
describe("legacy V12 same-origin union presentation", () => {
  it("resolves historical names and direction from IDs despite later renaming", () => {
    const p = getMergedEventPresentation(event, factions)!;
    expect(p.title).toBe("州并入董（同源合邦）");
    expect(p.lines).toEqual(["同源合邦时间：1161年1月", "被吸收方：州", "吸收方：董"]);
    expect(p.description).toContain("行政并入董");
    expect(p.title + p.description).not.toMatch(/州吞并董|新州|秦|兄弟|宗亲|血脉|战败|战死/);
  });
  it("projects the same canonical facts in history title and detail without rewriting the event", () => {
    const before = JSON.stringify(event);
    expect(formatHistoryEventTitle(event, factions)).toBe(getMergedEventPresentation(event, factions)!.title);
    expect(formatHistoryEventDescription(event, factions)).toBe(getMergedEventPresentation(event, factions)!.description);
    expect(JSON.stringify(event)).toBe(before);
    expect(getMergedEventPresentation(JSON.parse(before), factions)).toEqual(getMergedEventPresentation(event, factions));
  });
  it("does not treat peaceful submission as same-origin union", () => {
    expect(getMergedEventPresentation({ ...event, type: "faction-submitted" }, factions)).toBeUndefined();
  });
  it("does not infer missing parties from an ambiguous old title", () => {
    const p = getMergedEventPresentation({ ...event, metadata: {} }, factions)!;
    expect(p.sourceId).toBeUndefined(); expect(p.targetId).toBeUndefined();
    expect(p.title).toBe("未记录势力并入未记录势力（同源合邦）");
  });
});
