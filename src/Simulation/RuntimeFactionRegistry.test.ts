import { describe, expect, it } from "vitest";
import { RuntimeFactionRegistry } from "./RuntimeFactionRegistry";

interface FakeFaction {
  name: string;
}

describe("runtime faction registry", () => {
  it("does not mutate frozen initial faction arrays when adding runtime factions", () => {
    const initialTeams = Object.freeze(
      Array.from({ length: 7 }, (_, index) => ({ name: `faction-${index + 1}` }))
    );
    const registry = new RuntimeFactionRegistry<FakeFaction>();

    registry.reset(initialTeams);
    const created = registry.register({ name: "faction-8" });

    expect(created).toBe(true);
    expect(initialTeams).toHaveLength(7);
    expect(registry.list()).toHaveLength(8);
    expect(registry.get("faction-8")?.name).toBe("faction-8");
  });

  it("rejects duplicated runtime faction ids", () => {
    const registry = new RuntimeFactionRegistry<FakeFaction>();
    registry.reset([{ name: "秦" }]);

    expect(registry.register({ name: "秦" })).toBe(false);
    expect(registry.list()).toHaveLength(1);
  });
});
