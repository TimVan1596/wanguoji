import { describe, expect, it } from "vitest";
import { getWorldPhase } from "./WorldPhase";

describe("world phase", () => {
  it("maps a single active faction to unified", () => {
    expect(getWorldPhase(1)).toBe("UNIFIED");
  });

  it("leaves unified when new factions appear", () => {
    expect(getWorldPhase(2)).toBe("DUAL");
  });

  it("can hold an imperial fracture phase temporarily", () => {
    expect(getWorldPhase(3, 100, 80)).toBe("IMPERIAL_FRACTURE");
    expect(getWorldPhase(3, 100, 120)).toBe("CONTESTED");
  });
});
