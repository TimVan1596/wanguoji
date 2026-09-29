import { describe, expect, it } from "vitest";
import {
  CITY_BASE_MAX_DEFENSE,
  CITY_CAPITAL_DEFENSE_BONUS,
  CITY_CAPTURED_DEFENSE_RATIO,
  CITY_CAPTURE_GRACE_MONTHS,
  CITY_CAPITAL_LABEL_FONT_SIZE,
  CITY_REPAIR_INTERVAL_MONTHS,
  CITY_SIEGE_DAMAGE_INTERVAL_MONTHS,
  CITY_SIEGE_DAMAGE_PER_TICK,
  CITY_LABEL_FONT_SIZE,
  FORTIFIED_ZONE_TIERS,
} from "./simulation";

describe("simulation display config", () => {
  it("keeps city labels in the same readable base range", () => {
    expect(CITY_LABEL_FONT_SIZE).toBeGreaterThanOrEqual(12);
    expect(CITY_CAPITAL_LABEL_FONT_SIZE - CITY_LABEL_FONT_SIZE).toBeLessThanOrEqual(1);
  });

  it("raises only the base defense number while preserving the e1 siege and capture values", () => {
    expect(CITY_BASE_MAX_DEFENSE).toBe(5);
    expect(CITY_CAPITAL_DEFENSE_BONUS).toBe(2);
    expect(CITY_SIEGE_DAMAGE_INTERVAL_MONTHS).toBe(2);
    expect(CITY_SIEGE_DAMAGE_PER_TICK).toBe(1);
    expect(CITY_CAPTURED_DEFENSE_RATIO).toBe(0.35);
    expect(CITY_REPAIR_INTERVAL_MONTHS).toBe(9);
    expect(CITY_CAPTURE_GRACE_MONTHS).toBe(3);
    const maxDefense = (development: number, capital = false) =>
      CITY_BASE_MAX_DEFENSE + development + (capital ? CITY_CAPITAL_DEFENSE_BONUS : 0);
    expect([maxDefense(1), maxDefense(5)]).toEqual([6, 10]);
    expect([maxDefense(1, true), maxDefense(5, true)]).toEqual([8, 12]);
    expect(FORTIFIED_ZONE_TIERS.map(({ minDefense, maxDefense: max, shape }) => [minDefense, max, shape])).toEqual([
      [1, 6, "single"], [7, 8, "cross"], [9, 10, "square"], [11, 99, "diamond"],
    ]);
  });
});
