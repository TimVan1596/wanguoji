import type Core from "../Game/Core";
import type { HydrationReport } from "./WorldSaveHydrator";
import { validateWorldSave } from "./WorldSaveValidator";
import {
  createStoredWorldSaveRecord,
  SaveSlotType,
  StoredWorldSaveRecord,
  validateStoredWorldSaveRecord,
  WorldSaveRepository,
} from "./WorldSaveRepository";
import { WorldSaveV1 } from "./WorldSaveSchema";
import { runtimeProfilingEnabled } from "../Simulation/MonthlyPhaseProfiler";

type SavePhase = "idle" | "safe boundary" | "export/validate" | "serialize" | "write";
let savePhase: SavePhase = "idle";
export function getWorldSavePhaseDiagnostics() { return { enabled: runtimeProfilingEnabled, phase: savePhase, inFlight: worldSaveInFlight }; }
function recordSavePhase(phase: SavePhase) { if (runtimeProfilingEnabled) savePhase = phase; }

export interface ManualSaveResult {
  record: StoredWorldSaveRecord;
  serializedBytes: number;
  writeDurationMs: number;
  waitSafeBoundaryMs: number;
  exportSerializeMs: number;
  indexedDbWriteMs: number;
  totalSaveDurationMs: number;
}

export interface SaveTarget {
  slotId?: string;
  slotType?: SaveSlotType;
  displayName?: string;
}

function nowMs() {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

let worldSaveInFlight = false;
const saveIdleWaiters = new Set<() => void>();

export class WorldSaveBusyError extends Error {
  constructor() {
    super("已有保存任务正在进行");
    this.name = "WorldSaveBusyError";
  }
}

export async function saveCurrentWorldExclusive(
  core: Core,
  repository: WorldSaveRepository,
  options: { scenarioId?: string; scenarioName?: string } & SaveTarget = {}
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
    [...saveIdleWaiters].forEach((resolve) => resolve());
    saveIdleWaiters.clear();
  }
}

export function isWorldSaveInFlight() {
  return worldSaveInFlight;
}

export function waitForWorldSaveIdle(timeoutMs = 10_000) {
  if (!worldSaveInFlight) return Promise.resolve(true);
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (idle: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      saveIdleWaiters.delete(onIdle);
      resolve(idle);
    };
    const onIdle = () => finish(true);
    const timeout = setTimeout(() => finish(!worldSaveInFlight), timeoutMs);
    saveIdleWaiters.add(onIdle);
  });
}

export async function saveCurrentWorld(
  core: Core,
  repository: WorldSaveRepository,
  options: { scenarioId?: string; scenarioName?: string } & SaveTarget = {}
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
    options.scenarioName,
    options
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
  scenarioName?: string,
  target: SaveTarget = {}
): Promise<ManualSaveResult> {
  if (!runtime.started) throw new Error("当前没有可保存的已开始世界");
  if (runtime.catchingUp()) throw new Error("后台追赶期间不能保存世界");
  const wasRunning = runtime.running;
  const selectedSpeed = runtime.speed;
  const totalStartedAt = nowMs();
  let waitSafeBoundaryMs = 0;
  let exportSerializeMs = 0;
  try {
    recordSavePhase("safe boundary");
    const waitStartedAt = nowMs();
    await runtime.pauseAtBoundary();
    waitSafeBoundaryMs = nowMs() - waitStartedAt;
    const exportStartedAt = nowMs();
    recordSavePhase("export/validate");
    const save = await exportSave();
    const validation = validateWorldSave(save);
    if (!validation.valid) throw new Error(`存档校验失败：${validation.errors.join("；")}`);
    const record = createStoredWorldSaveRecord(save, scenarioName, new Date().toISOString(), target);
    recordSavePhase("serialize");
    const serializedBytes = new TextEncoder().encode(JSON.stringify(record)).length;
    exportSerializeMs = nowMs() - exportStartedAt;
    const startedAt = nowMs();
    recordSavePhase("write");
    await repository.put(record.slotId, record);
    const indexedDbWriteMs = nowMs() - startedAt;
    return {
      record,
      serializedBytes,
      writeDurationMs: indexedDbWriteMs,
      waitSafeBoundaryMs,
      exportSerializeMs,
      indexedDbWriteMs,
      totalSaveDurationMs: nowMs() - totalStartedAt,
    };
  } finally {
    recordSavePhase("idle");
    runtime.restore(selectedSpeed, wasRunning);
  }
}

export function inspectStoredWorldSave(value: unknown, expectedSlotId?: string) {
  return validateStoredWorldSaveRecord(value, expectedSlotId);
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
  | { mode: "NEW_WORLD"; scenario: import("../Scenarios").GameScenario; seed: string }
  | { mode: "CONTINUE_SAVE"; record: StoredWorldSaveRecord };

export function createWorldLaunchRunner(
  request: WorldLaunchRequest,
  actions: {
    startWorld: (scenario: import("../Scenarios").GameScenario, seed: string) => void;
    hydrate: (record: StoredWorldSaveRecord) => void;
  }
) {
  let launched = false;
  return () => {
    if (launched) return false;
    launched = true;
    if (request.mode === "NEW_WORLD") actions.startWorld(request.scenario, request.seed);
    else actions.hydrate(request.record);
    return true;
  };
}

export function validateSavePayload(value: unknown): value is WorldSaveV1 {
  return validateWorldSave(value).valid;
}
