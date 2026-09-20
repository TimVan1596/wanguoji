import { describe, expect, it } from "vitest";
import {
  createNaturalDeathMonth,
  isNaturallyDeadByMonth,
} from "./RulerLifespanRules";

describe("ruler lifespan rules", () => {
  it("creates a natural death month on the person timeline", () => {
    const deathMonth = createNaturalDeathMonth(120, () => 0);
    expect(deathMonth).toBe(120 + 45 * 12);
  });

  it("does not depend on accession month", () => {
    const rolls = [70, 3];
    const roll = (max: number) => (rolls.shift() ?? 0) % max;
    const deathMonth = createNaturalDeathMonth(0, roll);
    expect(deathMonth).toBe(58 * 12);
    expect(deathMonth - 55 * 12).toBe(36);
    expect(deathMonth - 57 * 12).toBe(12);
  });

  it("lets heirs die before accession on the same natural timeline", () => {
    const deathMonth = createNaturalDeathMonth(0, () => 0);
    expect(isNaturallyDeadByMonth(deathMonth, deathMonth - 1)).toBe(false);
    expect(isNaturallyDeadByMonth(deathMonth, deathMonth)).toBe(true);
  });
});
