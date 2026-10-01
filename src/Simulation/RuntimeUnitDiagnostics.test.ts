import { describe, expect, it } from "vitest";
import { createRuntimeUnitDiagnostics } from "./RuntimeUnitDiagnostics";

describe("runtime unit diagnostics", () => {
  it("reports separate logical, root, child and active Phaser counts", () => {
    expect(createRuntimeUnitDiagnostics({
      logicalUsers: 7,
      rootPlayers: 7,
      playerChildren: 2,
      activePhaserPlayers: 9,
      missingTextureKeys: ["star", "noFace"],
    })).toEqual({
      logicalUsers: 7,
      rootPlayers: 7,
      playerChildren: 2,
      activePhaserPlayers: 9,
      missingTextureKeys: ["noFace", "star"],
    });
  });
});
