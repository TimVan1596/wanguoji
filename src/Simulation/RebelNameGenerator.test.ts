import { describe, expect, it } from "vitest";
import { createRebelFactionName, createRebelHouseName } from "./RebelNameGenerator";

function makeCity(name: string, x = 100, y = 100) {
  return {
    name,
    block: {
      x,
      y,
      scene: {
        renderer: {
          width: 1000,
          height: 1000,
        },
      },
    },
  };
}

describe("rebel name generator", () => {
  it("creates many unique visible rebel names without numeric suffixes", () => {
    const used = new Set<string>();
    for (let i = 0; i < 80; i++) {
      const name = createRebelFactionName(makeCity("大梁"), "REBEL", used);
      expect(name).not.toMatch(/\d/);
      expect(name).not.toMatch(/义军\d+$/);
      expect(used.has(name)).toBe(false);
      used.add(name);
    }
  });

  it("creates non-numeric frontier variants when base names collide", () => {
    const used = new Set(["北境军"]);
    const name = createRebelFactionName(makeCity("蓟", 500, 100), "FRONTIER", used);
    expect(name).not.toMatch(/\d/);
    expect(name).not.toBe("北境军");
  });

  it("creates expanded single and compound runtime dynasty surnames deterministically", () => {
    expect(createRebelHouseName(makeCity("蓟"), "SPLIT", () => 0, () => 100)).toBe("刘氏");
    expect(createRebelHouseName(makeCity("蓟"), "SPLIT", () => 2, () => 1)).toBe("欧阳氏");
  });

  it("does not mechanically inherit founder house for new runtime dynasties", () => {
    const city = {
      ...makeCity("新郑"),
      founderTeam: {
        houseName: "韩氏",
      },
    };
    expect(createRebelHouseName(city, "REBEL", () => 0, () => 100, ["韩氏"])).toBe("刘氏");
  });
});
