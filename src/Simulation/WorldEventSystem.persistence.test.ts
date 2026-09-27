import { describe, expect, it, vi } from "vitest";

describe("WorldEventSystem persistence contract", () => {
  it("exports the real JSON-safe shape and round-trips non-empty authoritative state", async () => {
    vi.stubGlobal("navigator", { userAgent: "", appVersion: "", maxTouchPoints: 0 });
    vi.stubGlobal("window", { URL: globalThis.URL });
    vi.stubGlobal("Image", class { src = ""; onload?: () => void });
    vi.stubGlobal("document", {
      documentElement: {},
      createElement: () => ({
        getContext: () => ({
          globalCompositeOperation: "source-over",
          fillStyle: "",
          drawImage: () => undefined,
          fillRect: () => undefined,
          getImageData: () => ({ data: [0, 0, 0, 0] }),
          putImageData: () => undefined,
        }),
        canPlayType: () => "",
      }),
    });
    const { default: WorldEventSystem } = await import("./WorldEventSystem");
    const first = new WorldEventSystem();
    const initial = first.exportState();
    expect(Array.isArray(initial.activeEffects)).toBe(true);
    expect(Array.isArray(initial.cityFoundedMonths)).toBe(false);
    expect(Array.isArray(initial.cityRebellionMonths)).toBe(false);
    expect(Array.isArray(initial.cycleState)).toBe(false);

    const populated = {
      ...initial,
      activeEffects: [{
        id: "harvest-qin-12", factionId: "Qin", type: "harvest" as const,
        startMonth: 12, endMonth: 24, modifiers: { populationGrowthMultiplier: 1.6 },
      }],
      cityFoundedMonths: { Qin: 12 },
      cityRebellionMonths: { "city-xianyang": 24 },
      cycleState: {
        fragmentationStartMonth: 0,
        hegemonicCandidateFactionId: "Qin",
        hegemonicCandidateSinceMonth: 36,
        hegemonicMomentum: 18,
        consolidationLeaderFactionId: "Qin",
        consolidationLeaderMomentum: 7,
      },
    };
    first.importState(populated, 48);
    const jsonState = JSON.parse(JSON.stringify(first.exportState()));
    const second = new WorldEventSystem();
    second.importState(jsonState, 48);
    expect(second.exportState()).toEqual(jsonState);
    vi.unstubAllGlobals();
  });
});
