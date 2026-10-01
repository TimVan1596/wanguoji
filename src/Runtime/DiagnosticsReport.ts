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
  ["suspend policy", "runtime.suspendPolicy"],
  ["logical users", "units.logicalUsers"],
  ["root players", "units.rootPlayers"],
  ["player children", "units.playerChildren"],
  ["active Phaser players", "units.activePhaserPlayers"],
  ["avatar renderer", "units.avatarRenderer"],
  ["missing texture keys", "units.missingTextureKeys"],
  ["save status", "persistence.saveStatus"],
  ["savedAt", "persistence.savedAt"],
  ["save month", "persistence.saveMonth"],
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
