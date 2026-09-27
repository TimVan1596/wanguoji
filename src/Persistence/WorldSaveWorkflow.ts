import type Core from "../Game/Core";
import { exportWorldSave } from "./WorldSaveExporter";
import { hydrateWorldSave, HydrationReport } from "./WorldSaveHydrator";
import { validateWorldSave } from "./WorldSaveValidator";
import {
  createStoredWorldSaveRecord,
  StoredWorldSaveRecord,
  validateStoredWorldSaveRecord,
  WorldSaveRepository,
} from "./WorldSaveRepository";
import { WorldSaveV1 } from "./WorldSaveSchema";
import { store } from "../store";

export interface ManualSaveResult {
  record: StoredWorldSaveRecord;
  serializedBytes: number;
  writeDurationMs: number;
}

export async function saveCurrentWorld(
  core: Core,
  repository: WorldSaveRepository,
  options: { scenarioId?: string; scenarioName?: string } = {}
): Promise<ManualSaveResult> {
  if (!store.getState().root.worldStarted || !core.simulator?.exportState().started) {
    throw new Error("当前没有可保存的已开始世界");
  }
  if (core.backgroundProgression.isCatchingUp()) {
    throw new Error("后台追赶期间不能保存世界");
  }
  const wasRunning = core.simulator.isRunning();
  const selectedSpeed = core.simulator.getSpeed();
  try {
    await core.pauseAtNextSafeSnapshotBoundary();
    const save = exportWorldSave(core, { scenarioId: options.scenarioId });
    const validation = validateWorldSave(save);
    if (!validation.valid) throw new Error(`存档校验失败：${validation.errors.join("；")}`);
    const record = createStoredWorldSaveRecord(save, options.scenarioName);
    const serializedBytes = new TextEncoder().encode(JSON.stringify(record)).length;
    const startedAt = performance.now();
    await repository.putCurrent(record);
    return {
      record,
      serializedBytes,
      writeDurationMs: performance.now() - startedAt,
    };
  } finally {
    core.setSimulationSpeed(selectedSpeed);
    core.setWorldRunning(wasRunning);
  }
}

export function inspectStoredWorldSave(value: unknown) {
  return validateStoredWorldSaveRecord(value);
}

export function continueStoredWorldSave(core: Core, value: unknown): HydrationReport {
  const checked = validateStoredWorldSaveRecord(value);
  if (!checked.valid || !checked.record) {
    throw new Error(checked.errors.join("；") || "存档无效");
  }
  return hydrateWorldSave(core, checked.record.save);
}

export type WorldLaunchRequest =
  | { mode: "NEW_WORLD"; scenario: import("../Scenarios").GameScenario }
  | { mode: "CONTINUE_SAVE"; record: StoredWorldSaveRecord };

export function createWorldLaunchRunner(
  request: WorldLaunchRequest,
  actions: {
    startWorld: (scenario: import("../Scenarios").GameScenario) => void;
    hydrate: (record: StoredWorldSaveRecord) => void;
  }
) {
  let launched = false;
  return () => {
    if (launched) return false;
    launched = true;
    if (request.mode === "NEW_WORLD") actions.startWorld(request.scenario);
    else actions.hydrate(request.record);
    return true;
  };
}

export function validateSavePayload(value: unknown): value is WorldSaveV1 {
  return validateWorldSave(value).valid;
}
