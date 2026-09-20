import { describe, expect, it } from "vitest";
import { CityInteractionIndex } from "./CityInteractionIndex";

const blockSize = 32;

function cell(x: number, y: number) {
  return { x: x * blockSize, y: y * blockSize };
}

function city(id: string, cells: Array<{ x: number; y: number }>, destroyed = false) {
  return {
    id,
    destroyed,
    fortifiedCells: cells.map((item) => cell(item.x, item.y)),
  };
}

describe("city interaction index", () => {
  it("resolves an initial historical city", () => {
    const index = new CityInteractionIndex();
    index.rebuild([city("xianyang", [{ x: 2, y: 3 }])], blockSize);
    expect(index.resolveGrid(2, 3)).toBe("xianyang");
  });

  it("resolves every fortified cell to the same city", () => {
    const index = new CityInteractionIndex();
    index.rebuild(
      [city("linzi", [{ x: 4, y: 4 }, { x: 5, y: 4 }, { x: 4, y: 5 }])],
      blockSize
    );
    expect(index.resolveGrid(4, 4)).toBe("linzi");
    expect(index.resolveGrid(5, 4)).toBe("linzi");
    expect(index.resolveGrid(4, 5)).toBe("linzi");
  });

  it("keeps lookup stable after city capture", () => {
    const index = new CityInteractionIndex();
    const captured = city("daliang", [{ x: 8, y: 8 }]);
    index.registerCity(captured, blockSize);
    index.registerCity(captured, blockSize);
    expect(index.resolveGrid(8, 8)).toBe("daliang");
  });

  it("updates lookup after fortified zone rebuild", () => {
    const index = new CityInteractionIndex();
    const rebuilt = city("handan", [{ x: 1, y: 1 }]);
    index.registerCity(rebuilt, blockSize);
    rebuilt.fortifiedCells = [cell(2, 2), cell(2, 3)];
    index.registerCity(rebuilt, blockSize);
    expect(index.resolveGrid(1, 1)).toBeUndefined();
    expect(index.resolveGrid(2, 2)).toBe("handan");
    expect(index.resolveGrid(2, 3)).toBe("handan");
  });

  it("registers naturally founded cities", () => {
    const index = new CityInteractionIndex();
    index.registerCity(city("anyang", [{ x: 12, y: 6 }]), blockSize);
    expect(index.resolveGrid(12, 6)).toBe("anyang");
  });

  it("removes destroyed cities", () => {
    const index = new CityInteractionIndex();
    index.registerCity(city("old-city", [{ x: 3, y: 7 }]), blockSize);
    index.unregisterCity("old-city");
    expect(index.resolveGrid(3, 7)).toBeUndefined();
  });

  it("does not retain old city ids after new world reset", () => {
    const index = new CityInteractionIndex();
    index.registerCity(city("old", [{ x: 1, y: 1 }]), blockSize);
    index.reset();
    index.registerCity(city("new", [{ x: 1, y: 1 }]), blockSize);
    expect(index.resolveGrid(1, 1)).toBe("new");
  });

  it("keeps two non-overlapping city zones distinct", () => {
    const index = new CityInteractionIndex();
    index.rebuild(
      [
        city("a", [{ x: 1, y: 1 }, { x: 2, y: 1 }]),
        city("b", [{ x: 4, y: 1 }, { x: 5, y: 1 }]),
      ],
      blockSize
    );
    expect(index.resolveGrid(2, 1)).toBe("a");
    expect(index.resolveGrid(4, 1)).toBe("b");
  });

  it("uses world coordinates independent of camera zoom or scroll", () => {
    const index = new CityInteractionIndex();
    index.registerCity(city("ji", [{ x: 6, y: 9 }]), blockSize);
    expect(index.resolveWorld(6 * blockSize + 16, 9 * blockSize + 16, blockSize)).toBe("ji");
  });
});
