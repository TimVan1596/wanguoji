import { describe, expect, it } from "vitest";
import { getHistoricalFactionIdentity } from "./HistoricalFactionIdentity";
import { formatRulerDiplomacyEvent } from "./RulerDiplomacyFormatter";
import { formatFactionHistoryEvent } from "./FactionHistoryFormatter";
import { formatHistoryEventTitle, resolveEventFactionColor, type HistoryFactionLike } from "./HistoryRenderRules";
import type { WorldEvent } from "./WorldHistory";

const faction: HistoryFactionLike = { name: "persistent-id", displayName: "C", color: 3,
  nameHistory: [{ name: "A", startMonth: 0, endMonth: 99 }, { name: "B", startMonth: 100, endMonth: 199 }, { name: "C", startMonth: 200 }],
  colorHistory: [{ color: 1, startMonth: 0, endMonth: 99, reason: "FOUNDING" },
    { color: 2, startMonth: 100, endMonth: 199, reason: "STATE_FOUNDING" }, { color: 3, startMonth: 200, reason: "USURPATION" }] };
const factions = new Map([[faction.name, faction], ["partner", { name: "partner", displayName: "同盟方", color: 4 }]]);
describe("event-month identity across provisional, founded and usurped regimes", () => {
  it.each([[50, "A", 1], [150, "B", 2], [250, "C", 3]] as const)("resolves month %i in biographies, chronicles, narratives and colored history", (month, name, color) => {
    const event: WorldEvent = { id: `alliance-${month}`, year: 999, monthIndex: month, type: "alliance-signed", category: "politics",
      importance: "major", title: "C、同盟方（错误的当前名称）", factionIds: [faction.name, "partner"], actorFactionId: faction.name,
      metadata: { commonThreatFactionId: faction.name, preconditionDurationMonths: 24, expiresMonth: month + 120 } };
    expect(getHistoricalFactionIdentity(faction, month)).toEqual({ name, color });
    for (const text of [formatRulerDiplomacyEvent(event, factions), formatFactionHistoryEvent(event, faction.name, factions), formatHistoryEventTitle(event, factions)]) {
      expect(text).toContain(`${name}、同盟方`); expect(text).toContain(`${name}势日强`);
      if (name !== "C") expect(text).not.toContain("C");
    }
    expect(resolveEventFactionColor(event, new Map([[faction.name, 3]]), factions)).toBe(color);
  });
  it.each(["truce-signed", "non-aggression-signed"] as const)("resolves %s participants and threats by historical month", type => {
    const event: WorldEvent = { id: type, year: 50, type, category: "politics", importance: "major", title: "C", factionIds: [faction.name, "partner"], metadata: { commonThreatFactionId: faction.name } };
    expect(formatRulerDiplomacyEvent(event, factions)).toContain("A、同盟方");
    expect(formatHistoryEventTitle(event, factions)).not.toContain("C");
  });
  it("uses the latest transition at the precise boundary months", () => {
    expect(getHistoricalFactionIdentity(faction, 99)).toEqual({ name: "A", color: 1 });
    expect(getHistoricalFactionIdentity(faction, 100)).toEqual({ name: "B", color: 2 });
    expect(getHistoricalFactionIdentity(faction, 199)).toEqual({ name: "B", color: 2 });
    expect(getHistoricalFactionIdentity(faction, 200)).toEqual({ name: "C", color: 3 });
  });
});
