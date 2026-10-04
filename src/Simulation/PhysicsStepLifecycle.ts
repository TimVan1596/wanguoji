export interface ManualArcadePhysicsWorld {
  isPaused: boolean;
  timeScale: number;
  update: (time: number, delta: number) => void;
  postUpdate: () => void;
}

export interface ManualPhysicsStepDiagnostics {
  physicsWorldUpdates: number;
  physicsWorldPostUpdates: number;
}

export default class ManualArcadePhysicsStepper {
  private diagnostics: ManualPhysicsStepDiagnostics = {
    physicsWorldUpdates: 0,
    physicsWorldPostUpdates: 0,
  };
  private simulationTimeMs = 0;

  step(world: ManualArcadePhysicsWorld | undefined, fixedDeltaMs: number) {
    if (!world || world.isPaused) {
      return false;
    }
    world.timeScale = 1;
    this.simulationTimeMs += fixedDeltaMs;
    world.update(this.simulationTimeMs, fixedDeltaMs);
    this.diagnostics.physicsWorldUpdates += 1;
    // Phaser normally synchronizes bodies to Game Objects once at the end of a
    // render frame. Manual fixed stepping must do so per simulation step;
    // otherwise the next update's Body.preUpdate can read a stale Game Object
    // transform, making results depend on render-frame batching.
    world.postUpdate();
    this.diagnostics.physicsWorldPostUpdates += 1;
    return true;
  }

  getSimulationTimeMs() {
    return this.simulationTimeMs;
  }

  getDiagnostics() {
    return { ...this.diagnostics };
  }

  reset() {
    this.resetAt(0);
  }

  resetAt(simulationTimeMs: number) {
    this.simulationTimeMs = Math.max(0, Number.isFinite(simulationTimeMs) ? simulationTimeMs : 0);
    this.diagnostics = {
      physicsWorldUpdates: 0,
      physicsWorldPostUpdates: 0,
    };
  }
}
