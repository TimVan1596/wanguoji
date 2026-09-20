import { beforeEach, describe, expect, it, vi } from "vitest";

function team(name: string, blocks: number, status = "ACTIVE") {
  return {
    name,
    status,
    isDie: status === "EXTINCT",
    users: { size: 0 },
    blocks: { children: { size: blocks } },
    cities: [],
  } as any;
}

describe("FactionSnapshots", () => {
  let FactionSnapshots: typeof import("./FactionSnapshots").default;

  beforeEach(() => {
    vi.stubGlobal("navigator", { userAgent: "node" });
    vi.stubGlobal("window", { navigator: { userAgent: "node" } });
    vi.stubGlobal("document", { documentElement: {} });
    vi.resetModules();
  });

  beforeEach(async () => {
    FactionSnapshots = (await import("./FactionSnapshots")).default;
    FactionSnapshots.reset();
  });

  it("stores absolute and controlled territory shares separately", () => {
    FactionSnapshots.observe(
      0,
      [team("qin", 20), team("chu", 10), team("han", 70, "EXTINCT")],
      1000
    );
    const [snapshot] = FactionSnapshots.get("qin");
    expect(snapshot.absoluteTerritoryShare).toBeCloseTo(0.02);
    expect(snapshot.territoryShare).toBe(snapshot.absoluteTerritoryShare);
    expect(snapshot.controlledTerritoryShare).toBeCloseTo(20 / 30);
  });
});
