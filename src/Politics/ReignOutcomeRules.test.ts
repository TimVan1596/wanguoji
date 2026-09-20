import { describe, expect, it } from "vitest";
import {
  evaluateReignOutcome,
  formatTerritoryTransition,
} from "./ReignOutcomeRules";
import type { RulerReignSnapshot } from "./RulerChronicle";

function snapshot(overrides: Partial<RulerReignSnapshot>): RulerReignSnapshot {
  return {
    month: 0,
    population: 10,
    territoryShare: 0.2,
    cityCount: 2,
    stability: 70,
    ...overrides,
  };
}

describe("reign outcome rules", () => {
  it("does not classify clear population and territory growth as decline", () => {
    const outcome = evaluateReignOutcome(
      snapshot({ population: 9, territoryShare: 0.157, cityCount: 1 }),
      snapshot({ population: 17, territoryShare: 0.211, cityCount: 1 })
    );
    expect(outcome.outcome).toBe("EXPANSION");
    expect(formatTerritoryTransition(0.157, 0.211)).toContain("增至21.1%");
    expect(formatTerritoryTransition(0.157, 0.211)).not.toContain("降至");
  });

  it("uses decline wording only when territory falls", () => {
    expect(formatTerritoryTransition(0.32, 0.21)).toContain("降至21.0%");
    expect(formatTerritoryTransition(0.32, 0.21)).not.toContain("增至");
  });

  it("keeps mixed reigns distinct from decline", () => {
    const outcome = evaluateReignOutcome(
      snapshot({ population: 10, territoryShare: 0.3, cityCount: 3, stability: 85 }),
      snapshot({ population: 18, territoryShare: 0.25, cityCount: 3, stability: 70 })
    );
    expect(outcome.outcome).toBe("MIXED");
  });
});
