import type Core from "../Game/Core";
import type { HydrationReport } from "./WorldSaveHydrator";
import { validateWorldSave } from "./WorldSaveValidator";
import {
  createStoredWorldSaveRecord,
  StoredWorldSaveRecord,
  validateStoredWorldSaveRecord,
  WorldSaveRepository,
} from "./WorldSaveRepository";
import { WorldSaveV1 } from "./WorldSaveSchema";

export interface ManualSaveResult {
  record: StoredWorldSaveRecord;
  serializedBytes: number;
  writeDurationMs: number;
}

let worldSaveInFlight = false;

export class WorldSaveBusyError extends Error {
  constructor() {
    super("已有保存任务正在进行");
    this.name = "WorldSaveBusyError";
  }
}

export async function saveCurrentWorldExclusive(
  core: Core,
  repository: WorldSaveRepository,
  options: { scenarioId?: string; scenarioName?: string } = {}
) {
  return runExclusiveWorldSave(() => saveCurrentWorld(core, repository, options));
}

export async function runExclusiveWorldSave<T>(operation: () => Promise<T>) {
  if (worldSaveInFlight) throw new WorldSaveBusyError();
  worldSaveInFlight = true;
  try {
    return await operation();
  } finally {
    worldSaveInFlight = false;
  }
}

export function isWorldSaveInFlight() {
  return worldSaveInFlight;
}

export async function saveCurrentWorld(
  core: Core,
  repository: WorldSaveRepository,
  options: { scenarioId?: string; scenarioName?: string } = {}
): Promise<ManualSaveResult> {
  const simulator = core.simulator;
  if (!simulator) throw new Error("当前没有可保存的已开始世界");
  return runManualSaveWorkflow(
    {
      started: simulator.exportState().started,
      running: simulator.isRunning(),
      speed: simulator.getSpeed(),
      catchingUp: () => core.backgroundProgression.isCatchingUp(),
      pauseAtBoundary: () => core.pauseAtNextSafeSnapshotBoundary(),
      restore: (speed, running) => {
        core.setSimulationSpeed(speed);
        core.setWorldRunning(running);
      },
    },
    repository,
    async () => {
      const { exportWorldSave } = await import("./WorldSaveExporter");
      return exportWorldSave(core, { scenarioId: options.scenarioId });
    },
    options.scenarioName
  );
}

export async function runManualSaveWorkflow(
  runtime: {
    started: boolean;
    running: boolean;
    speed: number;
    catchingUp: () => boolean;
    pauseAtBoundary: () => Promise<unknown>;
    restore: (speed: number, running: boolean) => void;
  },
  repository: WorldSaveRepository,
    exportSave: () => WorldSaveV1 | Promise<WorldSaveV1>,
  scenarioName?: string
): Promise<ManualSaveResult> {
  if (!runtime.started) throw new Error("当前没有可保存的已开始世界");
  if (runtime.catchingUp()) throw new Error("后台追赶期间不能保存世界");
  const wasRunning = runtime.running;
  const selectedSpeed = runtime.speed;
  try {
    await runtime.pauseAtBoundary();
    const save = await exportSave();
    const validation = validateWorldSave(save);
    if (!validation.valid) throw new Error(`存档校验失败：${validation.errors.join("；")}`);
    const record = createStoredWorldSaveRecord(save, scenarioName);
    const serializedBytes = new TextEncoder().encode(JSON.stringify(record)).length;
    const startedAt = performance.now();
    await repository.putCurrent(record);
    return {
      record,
      serializedBytes,
      writeDurationMs: performance.now() - startedAt,
    };
  } finally {
    runtime.restore(selectedSpeed, wasRunning);
  }
}

export function inspectStoredWorldSave(value: unknown) {
  return validateStoredWorldSaveRecord(value);
}

export async function continueStoredWorldSave(core: Core, value: unknown): Promise<HydrationReport> {
  const checked = validateStoredWorldSaveRecord(value);
  if (!checked.valid || !checked.record) {
    throw new Error(checked.errors.join("；") || "存档无效");
  }
  const { hydrateWorldSave } = await import("./WorldSaveHydrator");
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
