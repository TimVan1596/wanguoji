import { describe, expect, it } from "vitest";
import { formatRendererCrashReport } from "./RendererCrashReport";

describe("renderer fatal diagnostics formatter", () => {
  it("includes readable runtime context and the complete source-mapped stack", () => {
    const report = formatRendererCrashReport({
      source: "window.error", appVersion: "v-test", worldMonth: 24,
      errorName: "RangeError", message: "Maximum call stack size exceeded", stack: "RangeError: overflow\n at app.ts:12",
      rightPanelTab: "faction", factionTab: "house", selectedFactionName: "wei", worldRunning: true,
      simulationSpeed: 4, lastSimulationSubsystem: "DynastyRegistry.update", runtimeUnits: { reachablePlayerCount: 9 },
      worldScale: { worldHistoryEventCount: 80 },
      genealogy: { currentDynastyRulerCount: 12, includedNodeCount: 10, maxParentDepth: 8 },
    });
    expect(report).toContain("worldMonth=24");
    expect(report).toContain("RangeError: Maximum call stack size exceeded");
    expect(report).toContain("lastCompletedSimulationSubsystem=DynastyRegistry.update");
    expect(report).toContain("not a React crash-source attribution");
    expect(report).toContain('genealogy={"currentDynastyRulerCount":12,"includedNodeCount":10,"maxParentDepth":8}');
    expect(report).toContain("at app.ts:12");
  });
});
