import { describe, expect, it } from "vitest";
import ManualArcadePhysicsStepper from "./PhysicsStepLifecycle";
import { SIMULATION_FIXED_STEP_MS } from "./SimulationDriver";

function world() {
  const calls: string[] = [];
  return {
    calls,
    world: {
      isPaused: false,
      timeScale: 1,
      update: (time: number, delta: number) => calls.push(`update:${time}:${delta}`),
      postUpdate: () => calls.push("postUpdate"),
    },
  };
}

function runBatching(batches: number[]) {
  const stepper = new ManualArcadePhysicsStepper();
  const test = world();
  batches.forEach((stepsInFrame) => {
    for (let step = 0; step < stepsInFrame; step += 1) {
      stepper.step(test.world, SIMULATION_FIXED_STEP_MS);
    }
  });
  return { calls: test.calls, diagnostics: stepper.getDiagnostics(), time: stepper.getSimulationTimeMs() };
}

describe("ManualArcadePhysicsStepper", () => {
  it("uses the same update/body-sync lifecycle and synthetic time for every fixed step", () => {
    const stepper = new ManualArcadePhysicsStepper();
    const test = world();
    stepper.step(test.world, SIMULATION_FIXED_STEP_MS);
    stepper.step(test.world, SIMULATION_FIXED_STEP_MS);
    stepper.step(test.world, SIMULATION_FIXED_STEP_MS);

    expect(test.calls).toEqual([
      `update:${SIMULATION_FIXED_STEP_MS}:${SIMULATION_FIXED_STEP_MS}`,
      "postUpdate",
      `update:${SIMULATION_FIXED_STEP_MS * 2}:${SIMULATION_FIXED_STEP_MS}`,
      "postUpdate",
      `update:${SIMULATION_FIXED_STEP_MS * 3}:${SIMULATION_FIXED_STEP_MS}`,
      "postUpdate",
    ]);
    expect(stepper.getDiagnostics()).toEqual({
      physicsWorldUpdates: 3,
      physicsWorldPostUpdates: 3,
    });
  });

  it.each([
    [Array(30).fill(1)],
    [Array(15).fill(2)],
    [Array(10).fill(3)],
  ])("is independent of render batching (%j)", (batches) => {
    expect(runBatching(batches)).toEqual(runBatching(Array(30).fill(1)));
  });

  it("can rebase synthetic time to a hydrated world clock", () => {
    const stepper = new ManualArcadePhysicsStepper();
    const test = world();
    stepper.resetAt(1234);
    stepper.step(test.world, SIMULATION_FIXED_STEP_MS);
    expect(test.calls[0]).toBe(`update:${1234 + SIMULATION_FIXED_STEP_MS}:${SIMULATION_FIXED_STEP_MS}`);
  });

  it("does not advance a paused world", () => {
    const stepper = new ManualArcadePhysicsStepper();
    const test = world();
    test.world.isPaused = true;
    expect(stepper.step(test.world, SIMULATION_FIXED_STEP_MS)).toBe(false);
    expect(test.calls).toEqual([]);
    expect(stepper.getSimulationTimeMs()).toBe(0);
  });
});
