import { describe, expect, it } from "vitest";
import {
  getPointerCanvasPoint,
  getPointerDragDistance,
  resolveCityPointerPosition,
} from "./CityClickProbe";

describe("city click probe coordinate helpers", () => {
  it("resolves grid coordinates at zoom 1", () => {
    const result = resolveCityPointerPosition(
      { x: 80, y: 112 },
      { scrollX: 0, scrollY: 0, zoom: 1 },
      32
    );
    expect(result.gridX).toBe(2);
    expect(result.gridY).toBe(3);
  });

  it("resolves grid coordinates with camera scroll and non-1 zoom", () => {
    const result = resolveCityPointerPosition(
      { x: 64, y: 96 },
      { scrollX: 320, scrollY: 160, zoom: 2 },
      32
    );
    expect(result.worldX).toBe(352);
    expect(result.worldY).toBe(208);
    expect(result.gridX).toBe(11);
    expect(result.gridY).toBe(6);
  });

  it("normalizes DOM canvas offset and scale before camera conversion", () => {
    const canvasPoint = getPointerCanvasPoint(
      { x: 0, y: 0, event: { clientX: 210, clientY: 150 } },
      { left: 10, top: 50, width: 560, height: 560 },
      { width: 1120, height: 1120 }
    );
    expect(canvasPoint).toEqual({ x: 400, y: 200 });
  });

  it("uses normalized canvas coordinates for world to grid conversion", () => {
    const result = resolveCityPointerPosition(
      { x: 0, y: 0, event: { clientX: 210, clientY: 150 } },
      { scrollX: 32, scrollY: 64, zoom: 2 },
      32,
      { left: 10, top: 50, width: 560, height: 560 },
      { width: 1120, height: 1120 }
    );
    expect(result.canvasX).toBe(400);
    expect(result.canvasY).toBe(200);
    expect(result.worldX).toBe(232);
    expect(result.worldY).toBe(164);
    expect(result.gridX).toBe(7);
    expect(result.gridY).toBe(5);
  });

  it("detects drag distance in canvas coordinate space", () => {
    expect(getPointerDragDistance({ x: 10, y: 10 }, { x: 13, y: 14 })).toBe(5);
  });
});
