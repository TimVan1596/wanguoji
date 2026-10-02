export interface SaveManagerRuntimeCore {
  simulator?: {
    isRunning(): boolean;
    getSpeed(): number;
  };
  setWorldRunning(running: boolean): void;
  setSimulationSpeed(speed: number): void;
}

export interface SaveManagerRuntimeSession {
  wasRunning: boolean;
  speed: number;
  closeReason: "MANAGED" | "LOAD";
}

export function pauseForSaveManager(core?: SaveManagerRuntimeCore): SaveManagerRuntimeSession | undefined {
  if (!core?.simulator) return undefined;
  const session: SaveManagerRuntimeSession = {
    wasRunning: core.simulator.isRunning(),
    speed: core.simulator.getSpeed(),
    closeReason: "MANAGED",
  };
  core.setWorldRunning(false);
  return session;
}

export function closeSaveManagerSession(core: SaveManagerRuntimeCore | undefined, session?: SaveManagerRuntimeSession) {
  if (!core || !session || session.closeReason === "LOAD") return false;
  core.setSimulationSpeed(session.speed);
  core.setWorldRunning(session.wasRunning);
  return true;
}

export function restoreAfterFailedSaveLoad(core: SaveManagerRuntimeCore | undefined, session?: SaveManagerRuntimeSession) {
  if (!core || !session) return false;
  core.setSimulationSpeed(session.speed);
  core.setWorldRunning(session.wasRunning);
  return true;
}
