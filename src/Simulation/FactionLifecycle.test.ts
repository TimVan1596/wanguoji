import { describe, expect, it } from "vitest";
import {
  FactionLifecycleState,
  getCumulativeActiveYears,
  initializeFactionLifecycle,
  markLifecycleActive,
  markLifecycleExiled,
  markLifecycleExtinct,
  resolveFactionStatus,
  shouldDynastyContinue,
} from "./FactionLifecycle";

function createState(): FactionLifecycleState {
  return {
    status: "ACTIVE",
    firstFoundedYear: 0,
    currentActiveSinceYear: 0,
    restorationYears: [],
    cumulativeActiveYears: 0,
  };
}

describe("faction lifecycle", () => {
  it("resolves ACTIVE when a faction owns cities", () => {
    expect(resolveFactionStatus(1, 0)).toBe("ACTIVE");
  });

  it("resolves EXILED only when cityless factions have remnants", () => {
    expect(resolveFactionStatus(0, 5)).toBe("EXILED");
  });

  it("resolves EXTINCT when a cityless faction has no remnants", () => {
    expect(resolveFactionStatus(0, 0)).toBe("EXTINCT");
  });

  it("tracks cumulative active years across exile and restoration", () => {
    const state = createState();
    markLifecycleExiled(state, 48);
    expect(getCumulativeActiveYears(state, 120)).toBe(48);

    markLifecycleActive(state, 168);
    expect(state.restorationYears).toEqual([168]);
    expect(getCumulativeActiveYears(state, 202)).toBe(82);
  });

  it("initializes runtime factions at their real founding month", () => {
    const state = createState();
    initializeFactionLifecycle(state, 1000);

    expect(state.firstFoundedYear).toBe(1000);
    expect(state.currentActiveSinceYear).toBe(1000);
    expect(getCumulativeActiveYears(state, 1022)).toBe(22);
  });

  it("keeps original founding month when an old faction is restored", () => {
    const state = createState();
    markLifecycleExiled(state, 100);
    markLifecycleActive(state, 250);

    expect(state.firstFoundedYear).toBe(0);
    expect(state.currentActiveSinceYear).toBe(250);
    expect(state.restorationYears).toEqual([250]);
  });

  it("records extinction year and freezes active-year counting", () => {
    const state = createState();
    markLifecycleExtinct(state, 133);
    expect(state.status).toBe("EXTINCT");
    expect(state.extinctionYear).toBe(133);
    expect(getCumulativeActiveYears(state, 202)).toBe(133);
  });

  it("stops dynasty continuation only after EXTINCT", () => {
    expect(shouldDynastyContinue("ACTIVE")).toBe(true);
    expect(shouldDynastyContinue("EXILED")).toBe(true);
    expect(shouldDynastyContinue("EXTINCT")).toBe(false);
  });
});
