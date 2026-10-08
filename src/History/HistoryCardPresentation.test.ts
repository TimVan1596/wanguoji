import { describe, expect, it } from "vitest";
import { getHistoryCardFactionView, getHistoryCardPresentation } from "./HistoryCardPresentation";
import { formatHistoryEventDescription, formatHistoryEventTitle, type HistoryFactionLike } from "./HistoryRenderRules";
import type { WorldEvent } from "./WorldHistory";
function faction(name: string): HistoryFactionLike { return { name, displayName: name, color: 0, nameHistory: [{ name, startMonth: 0 }], sovereigntyHistory: [{ rank: "KING", startMonth: 0 }] }; }
const factions = new Map(["韩", "齐", "燕", "秦"].map(id => [id, faction(id)]));
const han: WorldEvent = { id: "han-xinzheng", year: 59 * 12, type: "capital-fallen", category: "war", importance: "major", title: "旧标题", actorFactionId: "秦", targetFactionId: "韩", cityName: "新郑", cityId: "xinzheng", metadata: { rulerId: "qin-real" } };
const qi: WorldEvent = { ...han, id: "qi-linzi", year: 64 * 12 + 3, actorFactionId: "燕", targetFactionId: "齐", cityName: "临淄", cityId: "linzi", metadata: { rulerId: "yan-real" } };
describe("history card identity and historical terminal descriptions", () => {
  it.each([han.id, qi.id])("expands only its own event and preserves its own metadata (%s)", expanded => {
    const cards = [qi, han].map(e => getHistoryCardPresentation(e, expanded, factions));
    expect(cards.filter(c => c.expanded)).toHaveLength(1);
    for (const card of cards) {
      expect(card.event).toBe(card.id === han.id ? han : qi);
      expect(card.title).toContain(card.event.cityName); expect(card.description).toContain(card.event.targetFactionId);
      expect(card.title).not.toContain(card.id === han.id ? "临淄" : "新郑");
      expect(card.event.metadata!.rulerId).toBe(card.id === han.id ? "qin-real" : "yan-real");
    }
    expect([han, qi].map(e => getHistoryCardPresentation(e, expanded, factions)).find(c => c.expanded)!.id).toBe(expanded);
  });
  it("projects provisional and formal identities at their event month without changing source text", () => {
    const id = "郢义军";
    const map = new Map([[id, { ...faction(id), displayName: "新郢", stateFoundedMonth: 100, nameHistory: [{ name: id, startMonth: 0, endMonth: 99 }, { name: "郢", startMonth: 100, endMonth: 3999 }, { name: "新郢", startMonth: 4000 }] }]]);
    const event: WorldEvent = { ...han, id: "ying-end", type: "faction-extinct", year: 264 * 12 + 7, targetFactionId: id, actorFactionId: undefined, title: "郢义军国残部消散，郢义军国彻底灭亡", description: "郢义军国残部消散。" };
    const original = JSON.stringify(event);
    expect(formatHistoryEventTitle(event, map)).toContain("郢国彻底灭亡");
    expect(formatHistoryEventDescription(event, map)).toBe("郢国残部消散，政权彻底终结。");
    expect(formatHistoryEventDescription(event, map)).not.toMatch(/郢义军|新郢/);
    expect(formatHistoryEventDescription({ ...event, year: 50 }, map)).toContain(id);
    expect(JSON.stringify(event)).toBe(original);
  });
  it("details faction labels and colors use this event month, including across regime changes", () => {
    const original = { ...faction("old-id"), displayName: "新国号", nameHistory: [{ name: "旧国号", startMonth: 0, endMonth: 99 }, { name: "新国号", startMonth: 100 }], color: 2, colorHistory: [{ color: 1, startMonth: 0, endMonth: 99, reason: "FOUNDING" }, { color: 2, startMonth: 100, reason: "USURPATION" }] };
    const map = new Map([[original.name, original]]);
    expect(getHistoryCardFactionView(map, 50).get(original.name)).toMatchObject({ displayName: "旧国号", color: 1 });
    expect(getHistoryCardFactionView(map, 150).get(original.name)).toMatchObject({ displayName: "新国号", color: 2 });
    expect(map.get(original.name)).toBe(original); expect(original.displayName).toBe("新国号");
  });
  it("does not replay grouped old raw titles or duplicate the narrative", () => {
    const event = { ...han, type: "faction-extinct" as const, description: "旧义军国失都 / 旧义军国残部消散", metadata: { groupedEventCount: 3 } };
    expect(formatHistoryEventDescription(event, factions)).toBeUndefined();
  });
  it("a dynasty-line-ended description uses the end-month name, not the internal faction ID", () => {
    const id = "郢义军", map = new Map([[id, { ...faction(id), displayName: "郢", nameHistory: [{ name: "郢", startMonth: 100 }] }]]);
    expect(formatHistoryEventDescription({ ...han, type: "dynasty-line-ended", actorFactionId: id, description: "郢义军国流亡王室已无合法继承人" }, map)).toBe("郢流亡王室已无合法继承人，王统断绝。");
  });
});
