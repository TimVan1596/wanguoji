import { describe, expect, it } from "vitest";
import { calculateImperialStrain } from "./ImperialStrain";

function createTeam({
  blocks,
  cities,
  loyalty = 80,
}: {
  blocks: number;
  cities: number;
  loyalty?: number;
}) {
  const capital = { block: { x: 0, y: 0 }, loyalty, isCapital: true };
  return {
    users: { size: 20 },
    blocks: { children: { size: blocks } },
    cities: [
      capital,
      ...Array.from({ length: Math.max(0, cities - 1) }, (_, index) => ({
        block: { x: (index + 2) * 80, y: 0 },
        loyalty,
        isCapital: false,
      })),
    ],
    capitalCity: capital,
  } as any;
}

describe("imperial strain", () => {
  it("makes large empires more strained than small factions", () => {
    const small = createTeam({ blocks: 80, cities: 2, loyalty: 85 });
    const empire = createTeam({ blocks: 760, cities: 7, loyalty: 48 });
    expect(calculateImperialStrain(empire, 1000, 120)).toBeGreaterThan(
      calculateImperialStrain(small, 1000, 0)
    );
  });
});
