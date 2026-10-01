import { describe, expect, it } from "vitest";
import { captureEraMapSnapshot, decodeOwnerRuns, encodeOwnerRuns, isEraMapSnapshotV1 } from "./EraMapSnapshot";

describe("Era map snapshots", () => {
  it("RLE round-trips row-major ownership and uses palette index zero for neutral", () => {
    const source = [0, 0, 1, 1, 1, 0, 2, 2];
    const runs = encodeOwnerRuns(source);
    expect(runs).toEqual([
      { paletteIndex: 0, length: 2 },
      { paletteIndex: 1, length: 3 },
      { paletteIndex: 0, length: 1 },
      { paletteIndex: 2, length: 2 },
    ]);
    expect(decodeOwnerRuns({ ownerRuns: runs, widthCells: 4, heightCells: 2 })).toEqual(source);
  });

  it("freezes deterministic historical faction names, colors, cell ownership, and city markers only", () => {
    const makeTeam = (name: string, displayName: string, color: number, x: number) => ({
      name,
      displayName,
      color,
      nameHistory: [{ name: displayName, startMonth: 0, endMonth: 9 }, { name: "新国号", startMonth: 10 }],
      cities: [{
        id: `${name}-city`, name: "郢", ownerFactionId: name, founderFactionId: name, isCapital: true,
        block: { x: x * 32, y: 32, width: 32, height: 32 },
      }],
    } as any);
    const snapshot = captureEraMapSnapshot({
      capturedMonth: 5,
      widthCells: 3,
      heightCells: 2,
      factions: [makeTeam("B", "旧名乙", 0x112233, 2), makeTeam("A", "旧名甲", 0xaabbcc, 0)],
      ownerAt: (x, y) => y === 0 && x === 2 ? "B" : y === 1 && x === 0 ? "A" : undefined,
    });
    expect(snapshot.factionPalette.map(({ factionId, displayName, color }) => ({ factionId, displayName, color }))).toEqual([
      { factionId: "A", displayName: "旧名甲", color: 0xaabbcc },
      { factionId: "B", displayName: "旧名乙", color: 0x112233 },
    ]);
    expect(decodeOwnerRuns(snapshot)).toEqual([0, 0, 2, 1, 0, 0]);
    expect(snapshot.cities).toEqual([
      { cityId: "A-city", name: "郢", gridX: 0, gridY: 1, ownerFactionId: "A", founderFactionId: "A", isCapital: true },
      { cityId: "B-city", name: "郢", gridX: 2, gridY: 1, ownerFactionId: "B", founderFactionId: "B", isCapital: true },
    ]);
    expect(Object.keys(snapshot)).not.toContain("phaser");
    expect(JSON.stringify(snapshot)).not.toMatch(/physics|unit|\bhp\b/i);
    expect(isEraMapSnapshotV1(snapshot)).toBe(true);
  });
});
