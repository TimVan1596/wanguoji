export type DiagnosticRecord = Record<string, unknown>;

function displayValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "object") return stableStringify(value);
  return String(value);
}

function stableStringify(value: unknown): string {
  type Work = { kind: "value"; value: unknown } | { kind: "text"; text: string } | { kind: "leave"; value: object };
  const output: string[] = [];
  const active = new WeakSet<object>();
  const stack: Work[] = [{ kind: "value", value }];
  while (stack.length) {
    const work = stack.pop()!;
    if (work.kind === "text") { output.push(work.text); continue; }
    if (work.kind === "leave") { active.delete(work.value); continue; }
    const current = work.value;
    if (current === undefined) { output.push("—"); continue; }
    if (current === null || typeof current !== "object") { output.push(JSON.stringify(current) ?? "—"); continue; }
    if (active.has(current)) { output.push('"[Circular]"'); continue; }
    active.add(current);
    stack.push({ kind: "leave", value: current });
    if (Array.isArray(current)) {
      output.push("[");
      stack.push({ kind: "text", text: "]" });
      for (let index = current.length - 1; index >= 0; index -= 1) {
        stack.push({ kind: "value", value: current[index] });
        if (index > 0) stack.push({ kind: "text", text: ", " });
      }
      continue;
    }
    const entries = Object.keys(current).sort().map((key) => [key, (current as Record<string, unknown>)[key]] as const);
    output.push("{");
    stack.push({ kind: "text", text: "}" });
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const [key, entryValue] = entries[index];
      stack.push({ kind: "value", value: entryValue });
      stack.push({ kind: "text", text: `${JSON.stringify(key)}: ` });
      if (index > 0) stack.push({ kind: "text", text: ", " });
    }
  }
  return output.join("");
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
  ["map pointer last target", "runtime.mapPointer.lastTarget"],
  ["map pointer accepted", "runtime.mapPointer.accepted"],
  ["map pointer reason", "runtime.mapPointer.reason"],
  ["map pointer selected faction before", "runtime.mapPointer.selectedFactionNameBefore"],
  ["map pointer selected faction after", "runtime.mapPointer.selectedFactionNameAfter"],
  ["map pointer right panel tab before", "runtime.mapPointer.rightPanelTabBefore"],
  ["map pointer panel after", "runtime.mapPointer.rightPanelTabAfter"],
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
  ["simulation fixed/month step subsystem timings", "simulationStepPerformance"],
  ["strategic union candidate blockers", "strategicUnionCandidates"],
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
  ["total factions", "worldScale.totalFactionCount"],
  ["active factions", "worldScale.activeFactionCount"],
  ["exiled factions", "worldScale.exiledFactionCount"],
  ["extinct factions", "worldScale.extinctFactionCount"],
  ["merged factions", "worldScale.mergedFactionCount"],
  ["active cities", "worldScale.activeCityCount"],
  ["runtime unit count", "worldScale.runtimeUnitCount"],
  ["archived cities", "worldScale.archivedCityCount"],
  ["faction snapshots", "worldScale.factionSnapshotCount"],
  ["total ruler count", "worldScale.totalRulerCount"],
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
