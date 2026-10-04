export type DiagnosticRecord = Record<string, unknown>;

function displayValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "object") return stableStringify(value);
  return String(value);
}

function stableStringify(value: unknown): string {
  if (value === undefined) return "—";
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "—";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(", ")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}: ${stableStringify(record[key])}`).join(", ")}}`;
}

function readPath(root: DiagnosticRecord, path: string) {
  return path.split(".").reduce<unknown>((current, key) => {
    if (current === null || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[key];
  }, root);
}

const CORE_FIELDS: Array<[string, string]> = [
  ["APP_VERSION", "appVersion"],
  ["package version", "packageVersion"],
  ["timestamp", "timestamp"],
  ["runtime mode", "runtime.mode"],
  ["platform", "runtime.platform"],
  ["Electron version", "runtime.electronVersion"],
  ["worldMonth", "runtime.worldMonth"],
  ["running", "runtime.running"],
  ["speed", "runtime.speed"],
  ["worldInstanceId", "runtime.worldInstanceId"],
  ["fixedSteps", "runtime.fixedSteps"],
  ["physicsSteps", "runtime.physicsSteps"],
  ["background mode", "runtime.backgroundMode"],
  ["catchUpDebt", "runtime.catchUpDebt"],
  ["activeCatchUpSource", "runtime.activeCatchUpSource"],
  ["lastCatchUpSource", "runtime.lastCatchUpSource"],
  ["focused", "runtime.focused"],
  ["visibility", "runtime.visibility"],
  ["window minimized", "runtime.windowMinimized"],
  ["minimize count", "runtime.minimizeCount"],
  ["suspend count", "runtime.suspendCount"],
  ["last suspend duration", "runtime.lastSuspendDuration"],
  ["resume catch-up", "runtime.resumeCatchUp"],
  ["genealogy viewer", "runtime.genealogyViewer"],
  ["suspend policy", "runtime.suspendPolicy"],
  ["logical users", "units.logicalUsers"],
  ["root players", "units.rootPlayers"],
  ["player children", "units.playerChildren"],
  ["active Phaser players", "units.activePhaserPlayers"],
  ["recent significant population transitions", "populationTransitions"],
  ["avatar renderer", "units.avatarRenderer"],
  ["missing texture keys", "units.missingTextureKeys"],
  ["noFace source", "units.noFaceSource"],
  ["noFace texture exists", "units.noFaceTextureExists"],
  ["star texture exists", "units.starTextureExists"],
  ["renderer type", "units.rendererType"],
  ["render frame count", "performance.renderFrameCount"],
  ["FPS", "performance.fps"],
  ["average frame ms", "performance.averageFrameMs"],
  ["p95 frame ms", "performance.p95FrameMs"],
  ["max frame ms", "performance.maxFrameMs"],
  ["long frames >25/33/50/100ms", "performance.longFrames"],
  ["average/max simulation steps per frame", "performance.stepsPerFrame"],
  ["average/p95 fixed-step CPU ms", "performance.fixedStepCpuMs"],
  ["average/p95 presentation CPU ms", "performance.presentationCpuMs"],
  ["world history events", "worldScale.worldHistoryEventCount"],
  ["era count", "worldScale.eraCount"],
  ["active factions", "worldScale.activeFactionCount"],
  ["active cities", "worldScale.activeCityCount"],
  ["active players", "worldScale.activePlayerCount"],
  ["ruler count", "worldScale.rulerCount"],
  ["ruler chronicles", "worldScale.rulerChronicleCount"],
  ["save status", "persistence.saveStatus"],
  ["savedAt", "persistence.savedAt"],
  ["save month", "persistence.saveMonth"],
  ["save serialized bytes", "persistence.serializedBytes"],
  ["save write duration ms", "persistence.writeDurationMs"],
  ["save total duration ms", "persistence.totalSaveDurationMs"],
  ["save safe-boundary wait ms", "persistence.waitSafeBoundaryMs"],
  ["save export/serialize ms", "persistence.exportSerializeMs"],
  ["IndexedDB write ms", "persistence.indexedDbWriteMs"],
  ["hydration stage", "hydration.stage"],
  ["canonical matched", "hydration.canonicalMatched"],
  ["collider teardown post-drain", "collider.postDrain"],
];

export function formatCoreDiagnostics(input: DiagnosticRecord | undefined): string {
  const data = input ?? {};
  return CORE_FIELDS.map(([label, path]) => `${label}: ${displayValue(readPath(data, path))}`).join("\n");
}

export function formatFullDiagnostics(sections: Array<[string, unknown]>): string {
  return sections.map(([title, value]) => `${title}\n${stableStringify(value)}`).join("\n\n");
}
