import { describe, expect, it } from "vitest";
import { WORLD_RNG_ALGORITHM, WorldRandom } from "./WorldRandom";

function makeSeededDecisionProjection(seed: string, count: number) {
  const rng = new WorldRandom();
  rng.initialize(seed);
  const projection = Array.from({ length: count }, (_, month) => ({
    month,
    event: rng.int(0, 5),
    populationGrowth: rng.next() < 0.2,
    successorNameIndex: rng.pickIndex(40),
    unitHeading: rng.int(0, 359),
  }));
  return { projection, random: rng.exportState() };
}

describe("WorldRandom", () => {
  it("repeats the same seeded canonical-decision projection and diverges for another seed", () => {
    expect(makeSeededDecisionProjection("wanguoji-test-seed", 120))
      .toEqual(makeSeededDecisionProjection("wanguoji-test-seed", 120));
    expect(makeSeededDecisionProjection("wanguoji-test-seed", 120).projection)
      .not.toEqual(makeSeededDecisionProjection("other-seed", 120).projection);
  });

  it("continues exactly from persisted state after an arbitrary save/hydrate split", () => {
    const uninterrupted = new WorldRandom();
    uninterrupted.initialize("split-run-seed");
    const firstHalf = Array.from({ length: 64 }, () => uninterrupted.next());
    const saveBoundary = uninterrupted.exportState();
    const continued = Array.from({ length: 64 }, () => uninterrupted.next());

    const hydrated = new WorldRandom();
    hydrated.restore(JSON.parse(JSON.stringify(saveBoundary)));
    expect(Array.from({ length: 64 }, () => hydrated.next())).toEqual(continued);
    expect(hydrated.exportState()).toEqual(uninterrupted.exportState());
    expect(firstHalf).toHaveLength(64);
  });

  it("records a stable algorithm id, seed, uint32 state, and draw position", () => {
    const rng = new WorldRandom();
    rng.initialize("state-check");
    rng.next();
    expect(rng.exportState()).toMatchObject({ algorithm: WORLD_RNG_ALGORITHM, seed: "state-check", position: 1 });
    expect(rng.exportState().state).toBeGreaterThanOrEqual(0);
    expect(rng.exportState().state).toBeLessThanOrEqual(0xffffffff);
  });
});
