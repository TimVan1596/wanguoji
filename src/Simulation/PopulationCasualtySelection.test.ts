import { describe, expect, it } from "vitest";
import { orderCasualtyCandidates } from "./PopulationCasualtySelection";

function candidates(count = 8) {
  return Array.from({ length: count }, (_, index) => ({
    id: index,
    identity: { userId: index + 1, name: `User-${index + 1}`, bornMonth: -300 - index, logicalUnitId: `unit-${index + 1}` },
  }));
}

describe("deterministic casualty selection", () => {
  it("does not depend on Set insertion order and is stable for the same event", () => {
    const original = candidates();
    const context = { factionId: "qin", worldMonth: 120, damageSource: "CITY_SIEGE", triggerCityId: "city-a" };
    const first = orderCasualtyCandidates(original, context)?.[0].id;
    const reversed = orderCasualtyCandidates([...original].reverse(), context)?.[0].id;
    expect(first).toBeDefined();
    expect(reversed).toBe(first);
  });

  it("uses city, month and source context to distribute first selection", () => {
    const pool = candidates();
    const selected = new Set<number>();
    for (let month = 0; month < 36; month += 1) {
      for (const city of ["city-a", "city-b", "city-c"]) {
        const order = orderCasualtyCandidates(pool, {
          factionId: "qin", worldMonth: month, damageSource: "CITY_SIEGE", triggerCityId: city,
        });
        selected.add(order![0].id);
      }
    }
    expect(selected.size).toBeGreaterThan(1);
  });

  it("fails closed when a stable identity is missing or ambiguous", () => {
    const pool = candidates(2);
    expect(orderCasualtyCandidates(pool, { factionId: "qin", worldMonth: 1, damageSource: "CITY_SIEGE" })).toHaveLength(2);
    expect(orderCasualtyCandidates([
      { id: 1, identity: { userId: 1, name: "same", bornMonth: 0 } },
      { id: 2, identity: { userId: 1, name: "same", bornMonth: 0 } },
    ], { factionId: "qin", worldMonth: 1, damageSource: "CITY_SIEGE" })).toBeUndefined();
    expect(orderCasualtyCandidates([
      { id: 1, identity: { userId: Number.NaN, name: "missing", bornMonth: 0 } },
    ], { factionId: "qin", worldMonth: 1, damageSource: "CITY_SIEGE" })).toBeUndefined();
  });
});
