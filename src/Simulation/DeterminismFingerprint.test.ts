import { describe, expect, it } from "vitest";
import { CURRENT_SAVE_SCHEMA_VERSION } from "../Persistence/WorldSaveSchema";
import { DeterminismCheckpointHistory, createDeterminismCheckpoint } from "./DeterminismFingerprint";
import { WORLD_RNG_ALGORITHM } from "./WorldRandom";

const random = { algorithm: WORLD_RNG_ALGORITHM, seed: "123", state: 456, position: 20 } as const;

describe("determinism checkpoints", () => {
  it("does not require a WorldSave schema change", () => {
    expect(CURRENT_SAVE_SCHEMA_VERSION).toBe(10);
  });

  it("hashes the canonical state projection independent of collection insertion order", () => {
    const first = createDeterminismCheckpoint({
      worldMonth: 120,
      random,
      factions: [
        { factionId: "燕", status: "ACTIVE", population: 8, rulerId: "r2" },
        { factionId: "韩", status: "ACTIVE", population: 6, rulerId: "r1" },
      ],
      cities: [{ cityId: "c2", ownerFactionId: "燕" }, { cityId: "c1", ownerFactionId: "韩" }],
      territory: [{ factionId: "燕", cells: 20 }, { factionId: "韩", cells: 10 }],
    });
    const reordered = createDeterminismCheckpoint({
      worldMonth: 120,
      random,
      factions: [
        { factionId: "韩", status: "ACTIVE", population: 6, rulerId: "r1" },
        { factionId: "燕", status: "ACTIVE", population: 8, rulerId: "r2" },
      ],
      cities: [{ cityId: "c1", ownerFactionId: "韩" }, { cityId: "c2", ownerFactionId: "燕" }],
      territory: [{ factionId: "韩", cells: 10 }, { factionId: "燕", cells: 20 }],
    });
    expect(first).toEqual(reordered);
    expect(first).toMatchObject({ worldMonth: 120, seed: "123", rngPosition: 20 });
  });

  it("records bounded decade checkpoints and omits already elapsed checkpoints after Continue", () => {
    const history = new DeterminismCheckpointHistory(2, 120);
    history.resetAt(300);
    const input = (worldMonth: number) => ({ worldMonth, random, factions: [], cities: [], territory: [] });

    expect(history.recordIfDue(input(360))?.worldMonth).toBe(360);
    expect(history.recordIfDue(input(480))?.worldMonth).toBe(480);
    expect(history.recordIfDue(input(600))?.worldMonth).toBe(600);
    expect(history.recordIfDue(input(720))?.worldMonth).toBe(720);
    expect(history.getRecent().map(({ worldMonth }) => worldMonth)).toEqual([600, 720]);
  });
});
