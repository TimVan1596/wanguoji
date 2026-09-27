import { describe, expect, it, vi } from "vitest";
import { createEmptyWorldSaveV1 } from "../Persistence/WorldSaveSchema";
import { validateWorldSave } from "../Persistence/WorldSaveValidator";
import WorldEventSystem from "./WorldEventSystem";

vi.mock("../Components/Team", () => ({ default: class Team {} }));
vi.mock("../Components/City", () => ({ default: class City {}, getFactionDevelopmentLevel: () => 0, getFactionStability: () => 0 }));
vi.mock("../Game/Game", () => ({ default: { Core: { map: undefined } } }));
vi.mock("../History/WorldHistory", () => ({ default: {} }));
vi.mock("../Live/Danmu", () => ({ default: { Apply: vi.fn() } }));
vi.mock("../Live/LocalDanmaku", () => ({ createLocalDanmu: vi.fn() }));
vi.mock("../store", () => ({ store: { dispatch: vi.fn() } }));
vi.mock("../store/rootSlice", () => ({ setWorldPhase: vi.fn(), setWorldResult: vi.fn() }));
vi.mock("./FactionRegistry", () => ({ default: {} }));
vi.mock("./WorldRemnants", () => ({ default: {} }));
vi.mock("./FactionEffects", () => ({ default: {} }));
vi.mock("./WorldExiles", () => ({ default: {} }));
vi.mock("./ImperialStrain", () => ({ calculateImperialStrain: vi.fn() }));
vi.mock("./WorldPhase", () => ({ getWorldPhase: vi.fn() }));
vi.mock("./CityNameRegistry", () => ({ default: {} }));
vi.mock("./StateNameGenerator", () => ({ createStateName: vi.fn() }));
vi.mock("../Components/Block", () => ({ default: class Block {} }));
vi.mock("../Politics/Dynasty", () => ({ default: {} }));
vi.mock("./FactionIdentity", () => ({
  getStateFormationBlockers: vi.fn(), observeEmperorProclamationEligibility: vi.fn(),
  observeStateFormationEligibility: vi.fn(), shouldApplyProvisionalDissolutionPressure: vi.fn(),
}));
vi.mock("./SovereigntyModifiers", () => ({ getEffectiveStability: vi.fn(), getRestorationWeightMultiplier: vi.fn() }));
vi.mock("./EmpireSplitRules", () => ({ selectSplitCities: vi.fn(), selectSplitCore: vi.fn(), shouldRestoreBeforeNewRebel: vi.fn() }));
vi.mock("./CityZoneSpatial", () => ({ getCandidateFortifiedGridCells: vi.fn(), hasZoneOverlapOrGapViolation: vi.fn() }));
vi.mock("./TerritoryMetrics", () => ({ calculateTerritoryMetrics: vi.fn(), getFactionTerritoryMetric: vi.fn() }));

describe("WorldEventSystem persistence contract", () => {
  it("exports the real JSON-safe shape and round-trips non-empty authoritative state", () => {
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
  });
});
