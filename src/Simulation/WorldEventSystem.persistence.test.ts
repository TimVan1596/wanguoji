import { describe, expect, it, vi } from "vitest";
import { createEmptyWorldSaveV1 } from "../Persistence/WorldSaveSchema";
import { validateWorldSave } from "../Persistence/WorldSaveValidator";

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

    const save = createEmptyWorldSaveV1();
    save.factions = [{
      factionId: "Qin", displayName: "秦", color: 1, factionType: "KINGDOM", status: "ACTIVE",
      firstFoundedMonth: 0, currentActiveSinceMonth: 0, restorationMonths: [], cumulativeActiveMonths: 0,
      identityStage: "STATE", sovereigntyRank: "KING", sovereigntyHistory: [], nameHistory: [],
      origin: {}, homeGridX: 0, homeGridY: 0,
    }];
    save.cities = [{
      cityId: "city-xianyang", name: "咸阳", founderFactionId: "Qin", ownerFactionId: "Qin",
      centerGridX: 0, centerGridY: 0, foundedMonth: 0, isCapital: true,
      defense: 1, maxDefense: 1, loyalty: 80, devastation: 0, captureCount: 0,
    }];
    save.worldEventSystem = jsonState;
    expect(validateWorldSave(save)).toEqual({ valid: true, errors: [] });
    vi.unstubAllGlobals();
  });
});
