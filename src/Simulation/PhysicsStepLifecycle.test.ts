import { describe, expect, it } from "vitest";
import ManualArcadePhysicsStepper from "./PhysicsStepLifecycle";

function world() {
  const calls: string[] = [];
  return {
    calls,
    world: {
      isPaused: false,
      timeScale: 1,
      update: (_time: number, delta: number) => calls.push(`update:${delta}`),
      step: (delta: number) => calls.push(`step:${delta}`),
    },
  };
}

describe("ManualArcadePhysicsStepper", () => {
  it("uses World.update for the first fixed step and World.step for additional steps in the same render frame", () => {
    const stepper = new ManualArcadePhysicsStepper();
    const test = world();
    stepper.beginFrame();
    stepper.step(test.world, 1000, 1000 / 30);
    stepper.step(test.world, 1000, 1000 / 30);
    stepper.step(test.world, 1000, 1000 / 30);
    expect(test.calls).toEqual([
      `update:${1000 / 30}`,
      `step:${1 / 30}`,
      `step:${1 / 30}`,
    ]);
    expect(stepper.getDiagnostics()).toEqual({
      physicsWorldUpdates: 1,
      physicsWorldSteps: 2,
    });
  });

  it("starts a new lifecycle on the next render frame", () => {
    const stepper = new ManualArcadePhysicsStepper();
    const test = world();
    stepper.beginFrame();
    stepper.step(test.world, 1000, 1000 / 30);
    stepper.beginFrame();
    stepper.step(test.world, 1033, 1000 / 30);
    expect(test.calls).toEqual([`update:${1000 / 30}`, `update:${1000 / 30}`]);
  });

  it("does not advance a paused world", () => {
    const stepper = new ManualArcadePhysicsStepper();
    const test = world();
    test.world.isPaused = true;
    stepper.beginFrame();
    expect(stepper.step(test.world, 1000, 1000 / 30)).toBe(false);
    expect(test.calls).toEqual([]);
  });
});
