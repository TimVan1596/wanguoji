export interface ManualArcadePhysicsWorld {
  isPaused: boolean;
  timeScale: number;
  update: (time: number, delta: number) => void;
  step: (delta: number) => void;
}

export interface ManualPhysicsStepDiagnostics {
  physicsWorldUpdates: number;
  physicsWorldSteps: number;
}

export default class ManualArcadePhysicsStepper {
  private frameSteps = 0;
  private diagnostics: ManualPhysicsStepDiagnostics = {
    physicsWorldUpdates: 0,
    physicsWorldSteps: 0,
  };

  beginFrame() {
    this.frameSteps = 0;
  }

  step(world: ManualArcadePhysicsWorld | undefined, time: number, fixedDeltaMs: number) {
    if (!world || world.isPaused) {
      return false;
    }
    world.timeScale = 1;
    if (this.frameSteps === 0) {
      world.update(time, fixedDeltaMs);
      this.diagnostics.physicsWorldUpdates += 1;
    } else {
      world.step(fixedDeltaMs / 1000);
      this.diagnostics.physicsWorldSteps += 1;
    }
    this.frameSteps += 1;
    return true;
  }

  getDiagnostics() {
    return { ...this.diagnostics };
  }

  reset() {
    this.frameSteps = 0;
    this.diagnostics = {
      physicsWorldUpdates: 0,
      physicsWorldSteps: 0,
    };
  }
}
