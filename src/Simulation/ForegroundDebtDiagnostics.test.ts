import { describe, expect, it, vi } from "vitest";
import SimulationDriver, { SIMULATION_FIXED_STEP_MS } from "./SimulationDriver";
import { ForegroundDebtDiagnostics } from "./ForegroundDebtDiagnostics";
import worldRandom from "./WorldRandom";
import { formatCoreDiagnostics } from "../Runtime/DiagnosticsReport";

const ctx = { isRunning: () => true, getSpeed: () => 4, step: () => {} };
describe("foreground session diagnostics", () => {
  it("observes caps/debt without RNG, bounds incidents to 20 and resets on session reset", () => {
    const driver = new SimulationDriver(); const diagnostics = new ForegroundDebtDiagnostics(true);
    const random = worldRandom.exportState();
    const context = vi.fn(() => ({ worldMonth: 114, focused: false, visibility: "visible",
      minimized: false, minimizedObservedAt: 123, savePhase: "write", rightPanelTab: "god" }));
    const record = (raw: number, input: number) => diagnostics.record(raw, input, driver.updateForeground(input, ctx), context);
    record(16.7, 1000 / 60); expect(context).not.toHaveBeenCalled();
    for (let i = 0; i < 35; i++) record(1000 + i, 500);
    const snapshot = diagnostics.snapshot(driver.getAccumulatorMs())!;
    expect(snapshot).toMatchObject({ foregroundStepCapHit: true, totalStepCapFrames: 35, consecutiveStepCapFrames: 35,
      lastRawFrameDeltaMs: 1034, lastDriverFrameDeltaMs: 500, lastScaledDeltaMs: 4000, lastForegroundSteps: 16,
      lastDebtIncidentWorldMonth: 114 });
    expect(snapshot.foregroundAccumulatorSteps).toBeLessThan(1);
    expect(snapshot.peakForegroundAccumulatorMs).toBeGreaterThanOrEqual(4000);
    expect(snapshot.droppedForegroundDebtMs).toBeCloseTo(snapshot.largestSingleDroppedDebtMs * 35, 5);
    expect(snapshot.incidents).toHaveLength(20);
    expect(snapshot.incidents[0].rawFrameDeltaMs).toBe(1015);
    expect(snapshot.incidents.at(-1)).toMatchObject({ focused: false, visibility: "visible", minimized: false, savePhase: "write", rightPanelTab: "god" });
    snapshot.incidents[0].worldMonth = -1;
    expect(diagnostics.snapshot(0)!.incidents[0].worldMonth).toBe(114);
    record(16.7, 1000 / 60);
    expect(diagnostics.snapshot(0)).toMatchObject({ foregroundStepCapHit: false, consecutiveStepCapFrames: 0, totalStepCapFrames: 35 });
    expect(formatCoreDiagnostics({ runtime: { foregroundDebt: snapshot, catchUpDebt: 0 } })).toContain("background catchUpDebt (fixed steps): 0");
    expect(worldRandom.exportState()).toEqual(random);
    expect(driver.exportState()).toEqual({ accumulatorMs: driver.getAccumulatorMs() });
    diagnostics.reset();
    expect(diagnostics.snapshot(0)).toMatchObject({ incidents: [], totalStepCapFrames: 0, droppedForegroundDebtMs: 0 });
  });
  it("disabled observers never read incident context; paused and exact-budget frames distinguish cap and dropping", () => {
    const diagnostics = new ForegroundDebtDiagnostics(false); const driver = new SimulationDriver();
    diagnostics.record(5000, 5000, driver.updateForeground(5000, ctx), () => { throw Error("debug disabled"); });
    expect(diagnostics.snapshot(0)).toBeUndefined();
    driver.reset();
    const exact = driver.updateForeground(16 * SIMULATION_FIXED_STEP_MS / 8, ctx);
    expect(exact).toMatchObject({ steps: 16, stepCapHit: true, droppedDebtMs: 0 });
    const paused = driver.updateForeground(5000, { ...ctx, isRunning: () => false });
    expect(paused).toMatchObject({ steps: 0, stepCapHit: false, scaledDeltaMs: 0, droppedDebtMs: 0 });
  });
});
