import { describe, expect, it } from "vitest";
import { stepLogicalMovement } from "./LogicalMovementSystem";
import { LogicalUnitState, getLogicalGridCoordinate } from "./LogicalUnitState";

function unit(overrides: Partial<LogicalUnitState> = {}): LogicalUnitState {
  return {
    unitId: "u1",
    factionId: "qin",
    logicalX: 0,
    logicalY: 0,
    logicalVX: 30,
    logicalVY: 0,
    alive: true,
    currentGridX: 0,
    currentGridY: 0,
    radius: 16,
    speed: 30,
    ...overrides,
  };
}

describe("LogicalMovementSystem", () => {
  it("matches v0.998 horizontal Phaser velocity semantics over one second", () => {
    const moving = unit({ logicalVX: 150, logicalVY: 0 });
    for (let i = 0; i < 30; i++) {
      stepLogicalMovement({
        units: [moving],
        deltaMs: 1000 / 30,
        bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
        blockSize: 32,
      });
    }
    expect(moving.logicalX).toBeCloseTo(150);
    expect(moving.logicalY).toBeCloseTo(0);
  });

  it("matches v0.998 vertical Phaser velocity semantics over one second", () => {
    const moving = unit({ logicalVX: 0, logicalVY: 150 });
    for (let i = 0; i < 30; i++) {
      stepLogicalMovement({
        units: [moving],
        deltaMs: 1000 / 30,
        bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
        blockSize: 32,
      });
    }
    expect(moving.logicalX).toBeCloseTo(0);
    expect(moving.logicalY).toBeCloseTo(150);
  });

  it("matches v0.998 diagonal Phaser velocity semantics over one second", () => {
    const speed = 150 / Math.sqrt(2);
    const moving = unit({ logicalVX: speed, logicalVY: speed });
    for (let i = 0; i < 30; i++) {
      stepLogicalMovement({
        units: [moving],
        deltaMs: 1000 / 30,
        bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
        blockSize: 32,
      });
    }
    expect(moving.logicalX).toBeCloseTo(speed);
    expect(moving.logicalY).toBeCloseTo(speed);
  });

  it("keeps simulation speed outside a single logical movement step", () => {
    const moving = unit({ logicalVX: 150, logicalVY: 0 });
    stepLogicalMovement({
      units: [moving],
      deltaMs: 1000 / 30,
      bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
      blockSize: 32,
    });
    expect(moving.logicalX).toBeCloseTo(5);
  });

  it("moves units deterministically by fixed delta", () => {
    const a = unit();
    const b = unit();
    stepLogicalMovement({
      units: [a],
      deltaMs: 1000,
      bounds: { minX: 0, minY: 0, maxX: 320, maxY: 320 },
      blockSize: 32,
    });
    for (let i = 0; i < 30; i++) {
      stepLogicalMovement({
        units: [b],
        deltaMs: 1000 / 30,
        bounds: { minX: 0, minY: 0, maxX: 320, maxY: 320 },
        blockSize: 32,
      });
    }
    expect(b.logicalX).toBeCloseTo(a.logicalX);
    expect(b.currentGridX).toBe(a.currentGridX);
  });

  it("uses the shared world-to-grid conversion", () => {
    expect(getLogicalGridCoordinate(63.9, 64, 32)).toEqual({
      gridX: 1,
      gridY: 2,
    });
  });

  it("maps world origin, centers, edges, and boundary crossings to stable grid cells", () => {
    expect(getLogicalGridCoordinate(0, 0, 32)).toEqual({ gridX: 0, gridY: 0 });
    expect(getLogicalGridCoordinate(16, 16, 32)).toEqual({ gridX: 0, gridY: 0 });
    expect(getLogicalGridCoordinate(31.999, 31.999, 32)).toEqual({
      gridX: 0,
      gridY: 0,
    });
    expect(getLogicalGridCoordinate(32, 32, 32)).toEqual({ gridX: 1, gridY: 1 });
    expect(getLogicalGridCoordinate(320 - 0.001, 320 - 0.001, 32)).toEqual({
      gridX: 9,
      gridY: 9,
    });
  });

  it("preserves old world-bound bounce semantics for logical movement", () => {
    const moving = unit({
      logicalX: 319,
      logicalVX: 60,
      currentGridX: 9,
    });
    stepLogicalMovement({
      units: [moving],
      deltaMs: 1000,
      bounds: { minX: 0, minY: 0, maxX: 320, maxY: 320 },
      blockSize: 32,
    });
    expect(moving.logicalX).toBe(320);
    expect(moving.logicalVX).toBeLessThan(0);
  });
});
