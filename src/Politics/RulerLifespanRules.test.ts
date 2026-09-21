import { describe, expect, it } from "vitest";
import {
  createNaturalDeathMonth,
  deriveHeirBirthMonth,
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

  it("derives an heir birth month from the parent timeline", () => {
    const birthMonth = deriveHeirBirthMonth(0, 33 * 12, () => 0);
    expect(birthMonth).toBe(18 * 12);
    expect(birthMonth).toBeGreaterThan(0);
    expect(33 * 12 - birthMonth).toBe(15 * 12);
  });

  it("allows a minor heir and refuses a child before adulthood", () => {
    expect(deriveHeirBirthMonth(0, 18 * 12, () => 0)).toBe(18 * 12);
    expect(deriveHeirBirthMonth(0, 17 * 12, () => 0)).toBeUndefined();
  });

  it("keeps an heir's natural death on the derived birth timeline", () => {
    const birthMonth = deriveHeirBirthMonth(0, 33 * 12, () => 0) ?? 0;
    const deathMonth = createNaturalDeathMonth(birthMonth, () => 0);
    expect(deathMonth).toBe(birthMonth + 45 * 12);
  });
});
