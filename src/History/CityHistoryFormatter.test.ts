import { describe, expect, it } from "vitest";
import { formatCityHistoryEvent, getCityHistoricalFactionName } from "./CityHistoryFormatter";

const factions = new Map([
  ["rebel", { name: "rebel", displayName: "安", color: 1, nameHistory: [
    { name: "六安义军", startMonth: 0, endMonth: 495 },
    { name: "安", startMonth: 496 },
  ] }],
  ["old", { name: "old", displayName: "魏", color: 2, nameHistory: [
    { name: "新郑南义军", startMonth: 0, endMonth: 600 },
    { name: "郑", startMonth: 601 },
  ] }],
]);
const city = { name: "大梁", founderFactionId: "old", foundedMonth: 20 };

describe("city history presentation", () => {
  it("uses historical faction names on the event month", () => {
    expect(getCityHistoricalFactionName(factions, "rebel", 412)).toBe("六安义军");
    expect(getCityHistoricalFactionName(factions, "rebel", 500)).toBe("安");
  });

  it("keeps attacker, previous owner, and ruler aligned to the event date", () => {
    expect(formatCityHistoryEvent({ year: 500, type: "captured", title: "legacy", newOwnerFactionId: "rebel", previousOwnerFactionId: "old", rulerId: "r1" }, city, factions, "安王罗靖"))
      .toBe("安王罗靖亲征，安攻陷新郑南义军控制的大梁");
    expect(formatCityHistoryEvent({ year: 400, type: "captured", title: "legacy", newOwnerFactionId: "rebel", previousOwnerFactionId: "old" }, city, factions))
      .toBe("六安义军攻陷新郑南义军控制的大梁");
  });

  it("does not invent a ruler when the event has no ruler evidence", () => {
    const text = formatCityHistoryEvent({ year: 500, type: "captured", title: "legacy", newOwnerFactionId: "rebel", previousOwnerFactionId: "old" }, city, factions);
    expect(text).not.toContain("亲征");
  });

  it("formats restoration, capital loss, relocation and founding from structured facts", () => {
    expect(formatCityHistoryEvent({ year: 700, type: "recovered", title: "old", newOwnerFactionId: "rebel", previousOwnerFactionId: "old" }, city, factions)).toContain("安从郑手中收复大梁");
    expect(formatCityHistoryEvent({ year: 700, type: "capital-lost", title: "old", previousOwnerFactionId: "old", wasCapital: true }, city, factions)).toBe("郑失都大梁");
    expect(formatCityHistoryEvent({ year: 700, type: "capital-relocated", title: "old", newOwnerFactionId: "rebel" }, city, factions)).toBe("安迁都大梁");
    expect(formatCityHistoryEvent({ year: 700, type: "founded", title: "old" }, city, factions)).toBe("新郑南义军建立大梁");
  });

  it("falls back to frozen title when structured owner data is missing", () => {
    expect(formatCityHistoryEvent({ year: 10, type: "captured", title: "旧事件标题" }, city, factions)).toBe("旧事件标题");
  });
});
