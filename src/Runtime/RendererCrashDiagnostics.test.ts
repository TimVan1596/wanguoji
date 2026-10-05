import { describe, expect, it } from "vitest";
import { formatRendererCrashReport } from "./RendererCrashDiagnostics";

describe("renderer fatal diagnostics formatter", () => {
  it("includes readable runtime context and the complete source-mapped stack", () => {
    const report = formatRendererCrashReport({
      source: "window.error", appVersion: "v-test", worldMonth: 24,
      errorName: "RangeError", message: "Maximum call stack size exceeded", stack: "RangeError: overflow\n at app.ts:12",
      rightPanelTab: "faction", factionTab: "house", selectedFactionName: "wei", worldRunning: true,
      simulationSpeed: 4, lastSimulationSubsystem: "DynastyRegistry.update", runtimeUnits: { reachablePlayerCount: 9 },
      worldScale: { worldHistoryEventCount: 80 },
    });
    expect(report).toContain("worldMonth=24");
    expect(report).toContain("RangeError: Maximum call stack size exceeded");
    expect(report).toContain("running=true speed=4x lastSubsystem=DynastyRegistry.update");
    expect(report).toContain("at app.ts:12");
  });
});
