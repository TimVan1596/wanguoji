import { describe, expect, it } from "vitest";
import SimulationDriver, {
  BASE_PLAY_RATE,
  SIMULATION_FIXED_STEP_MS,
} from "../Simulation/SimulationDriver";
import WorldClock from "../Simulation/WorldClock";
import {
  isSafeSnapshotBoundary,
  SnapshotBoundaryRequest,
} from "./SnapshotBoundary";

const jitteredFrames = [16.4, 17.2, 15.9, 18.1, 16.7, 14.8, 19.3, 16.1];

function advanceFixedSteps(clock: WorldClock, steps: number) {
  clock.setRunning(true);
  for (let i = 0; i < steps; i += 1) clock.update(SIMULATION_FIXED_STEP_MS);
}

function requestState(clock: WorldClock, accumulatorMs: number, paused: boolean) {
  const saved = clock.exportState();
  return {
    worldStarted: true,
    catchingUp: false,
    worldMonth: saved.worldMonth,
    paused,
    clockElapsedMs: saved.elapsedMs,
    simulationAccumulatorMs: accumulatorMs,
  };
}

async function runToNextMonth(speed: number, frameDeltas = jitteredFrames) {
  const clock = new WorldClock();
  advanceFixedSteps(clock, 13);
  const request = new SnapshotBoundaryRequest();
  const { promise, pending } = request.request(requestState(clock, 0, false));
  expect(pending).toBe(true);
  const driver = new SimulationDriver();
  let executedSteps = 0;
  let stoppedAtBoundary = false;

  for (let frame = 0; frame < 300 && !stoppedAtBoundary; frame += 1) {
    const result = driver.updateForeground(frameDeltas[frame % frameDeltas.length], {
      isRunning: () => clock.exportState().running,
      getSpeed: () => speed,
      getBasePlayRate: () => BASE_PLAY_RATE,
      step: (fixedDeltaMs) => {
        executedSteps += 1;
        clock.update(fixedDeltaMs);
        const current = clock.exportState();
        if (request.reachBoundary(current.worldMonth, current.elapsedMs)) {
          clock.setRunning(false);
          return "stop-and-discard";
        }
        return;
      },
    });
    if (result.stopped) {
      stoppedAtBoundary = true;
      request.recordPreExportState(clock.exportState().elapsedMs, driver.getAccumulatorMs());
    }
  }

  await promise;
  return { clock, driver, request, executedSteps, stoppedAtBoundary };
}

describe("snapshot month-boundary requests", () => {
  it.each([1, 2, 4])("reaches the next month with jittered frame deltas at %sx", async (speed) => {
    const result = await runToNextMonth(speed);
    const clock = result.clock.exportState();
    expect(result.stoppedAtBoundary).toBe(true);
    expect(clock.worldMonth).toBe(1);
    expect(clock.elapsedMs).toBeCloseTo(0, 8);
    expect(result.driver.getAccumulatorMs()).toBe(0);
    expect(clock.running).toBe(false);
    expect(result.request.getDiagnostics()).toMatchObject({
      status: "boundary-reached",
      requestMonth: 0,
      boundaryReachedMonth: 1,
      preExportAccumulatorMs: 0,
    });
    expect(isSafeSnapshotBoundary({
      paused: !clock.running,
      clockElapsedMs: clock.elapsedMs,
      simulationAccumulatorMs: result.driver.getAccumulatorMs(),
    })).toBe(true);
  });

  it("stops inside a 4x frame that contains several fixed steps", async () => {
    const result = await runToNextMonth(4, [100]);
    expect(result.executedSteps).toBe(17);
    expect(result.clock.worldMonth).toBe(1);
    expect(result.clock.exportState().elapsedMs).toBeCloseTo(0, 8);
    expect(result.driver.getAccumulatorMs()).toBe(0);
    expect(result.request.getDiagnostics().preExportElapsedMs).toBeCloseTo(0, 8);
  });

  it("resolves immediately at an already paused safe boundary", async () => {
    const clock = new WorldClock();
    clock.setRunning(false);
    const request = new SnapshotBoundaryRequest();
    const result = request.request(requestState(clock, 0, true));
    expect(result.pending).toBe(false);
    await expect(result.promise).resolves.toBeUndefined();
  });

  it("resumes a paused mid-month world and pauses again at the next boundary", async () => {
    const clock = new WorldClock();
    advanceFixedSteps(clock, 13);
    clock.setRunning(false);
    const request = new SnapshotBoundaryRequest();
    const result = request.request(requestState(clock, 0, true));
    expect(result.pending).toBe(true);
    clock.setRunning(true);
    const driver = new SimulationDriver();
    for (let frame = 0; frame < 300 && request.getDiagnostics().status === "waiting"; frame += 1) {
      driver.updateForeground(jitteredFrames[frame % jitteredFrames.length], {
        isRunning: () => clock.exportState().running,
        getSpeed: () => 1,
        getBasePlayRate: () => BASE_PLAY_RATE,
        step: (fixedDeltaMs) => {
          clock.update(fixedDeltaMs);
          const state = clock.exportState();
          if (request.reachBoundary(state.worldMonth, state.elapsedMs)) {
            clock.setRunning(false);
            return "stop-and-discard";
          }
          return;
        },
      });
      if (clock.exportState().worldMonth === 1) driver.reset();
    }
    await expect(result.promise).resolves.toBeUndefined();
    expect(clock.exportState().running).toBe(false);
    expect(clock.worldMonth).toBe(1);
  });

  it("rejects a pending request when reset cancels it", async () => {
    const clock = new WorldClock();
    advanceFixedSteps(clock, 1);
    const request = new SnapshotBoundaryRequest();
    const result = request.request(requestState(clock, 0, false));
    expect(request.cancel(new Error("Safe snapshot request was canceled because the world was reset."))).toBe(true);
    await expect(result.promise).rejects.toThrow("world was reset");
    expect(request.getDiagnostics().status).toBe("cancelled");
  });
});
