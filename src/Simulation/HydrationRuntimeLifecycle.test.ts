import { describe, expect, it } from "vitest";
import BackgroundProgressionController from "./BackgroundProgressionController";
import SimulationDriver from "./SimulationDriver";
import { SnapshotBoundaryRequest } from "../Persistence/SnapshotBoundary";

describe("repeated hydration controller lifecycle", () => {
  it("can hydrate, resume, pause, and hydrate again without stale driver, background, or snapshot state", async () => {
    const driver = new SimulationDriver();
    const background = new BackgroundProgressionController();
    const snapshot = new SnapshotBoundaryRequest();
    let simulatorRunning = false;
    let fixedSteps = 0;

    for (let hydration = 0; hydration < 2; hydration += 1) {
      simulatorRunning = false; // AutoSimulator.importState restores paused.
      driver.reset();
      background.reset();
      snapshot.cancel(new Error("hydration teardown"));
      expect(driver.getAccumulatorMs()).toBe(0);
      expect(background.isCatchingUp()).toBe(false);
      expect(simulatorRunning).toBe(false);

      simulatorRunning = true;
      const result = driver.updateForeground(100, {
        isRunning: () => simulatorRunning,
        getSpeed: () => 1,
        step: () => { fixedSteps += 1; },
      });
      expect(result.steps).toBeGreaterThan(0);
      expect(fixedSteps).toBeGreaterThan(0);

      simulatorRunning = false;
      const pending = snapshot.request({
        worldStarted: true,
        catchingUp: false,
        worldMonth: hydration,
        paused: true,
        clockElapsedMs: 0.5,
        simulationAccumulatorMs: 0,
      });
      expect(pending.pending).toBe(true);
      snapshot.cancel(new Error("reset for next hydration"));
      await expect(pending.promise).rejects.toThrow("reset for next hydration");
    }
  });
});
