export type DiagnosticRecord = Record<string, unknown>;

export interface DiagnosticPreviewBudget {
  maxDepth: number;
  maxNodes: number;
  maxArrayItems: number;
  maxObjectKeys: number;
  maxOutputChars: number;
}

export const DIAGNOSTIC_PREVIEW_BUDGET: Readonly<DiagnosticPreviewBudget> = {
  maxDepth: 128, maxNodes: 4096, maxArrayItems: 100, maxObjectKeys: 100, maxOutputChars: 65_536,
};
const TRUNCATED = "[Truncated]";

/** Do not stringify thrown objects: their message/toString can themselves throw. */
export function diagnosticErrorMessage(error: unknown): string {
  try {
    const message = typeof error === "string" ? error
      : error && typeof error === "object" ? (error as { message?: unknown }).message : undefined;
    return typeof message === "string" ? message.slice(0, 200) : "unknown error";
  } catch { return "unknown error"; }
}

/** A bounded preview, not JSON persistence. No recursion, toJSON, or random draws. */
export function stableStringify(value: unknown, options: Partial<DiagnosticPreviewBudget> = {}): string {
  let output = "";
  try {
    // Public overrides are also bounded; invalid budgets fall back to the defaults.
    const budget = { ...DIAGNOSTIC_PREVIEW_BUDGET };
    for (const key of Object.keys(budget) as Array<keyof DiagnosticPreviewBudget>) {
      const requested = options[key];
      if (typeof requested === "number" && Number.isFinite(requested)) {
        budget[key] = Math.max(key === "maxOutputChars" ? TRUNCATED.length : 0,
          Math.min(Math.floor(requested), key === "maxOutputChars" ? 1_048_576 : 100_000));
      }
    }
    const seen = new WeakSet<object>();
    type Frame = { container: Record<string, unknown>; keys?: string[]; index: number; count: number; omitted: boolean; depth: number };
    const stack: Frame[] = [];
    let nodes = 0;
    let stopped = false;
    const append = (text: string) => {
      if (stopped) return;
      if (output.length + text.length <= budget.maxOutputChars - TRUNCATED.length) output += text;
      else {
        output += text.slice(0, Math.max(0, budget.maxOutputChars - TRUNCATED.length - output.length)) + TRUNCATED;
        stopped = true;
      }
    };
    const quote = (text: string) => {
      // Slice before JSON escaping so a giant primitive/key cannot create a giant temporary string.
      const limit = Math.max(0, budget.maxOutputChars - output.length);
      return JSON.stringify(text.slice(0, limit)) + (text.length > limit ? TRUNCATED : "");
    };
    const unserializable = (error: unknown) => append(quote(`[Unserializable: ${diagnosticErrorMessage(error)}]`));
    const visit = (current: unknown, depth: number) => {
      if (++nodes > budget.maxNodes || depth > budget.maxDepth) { append(quote(TRUNCATED)); return; }
      try {
        if (current === undefined) { append("—"); return; }
        if (typeof current === "string") { append(quote(current)); return; }
        if (current === null || typeof current === "boolean" || typeof current === "number") {
          append(JSON.stringify(current)); return;
        }
        if (typeof current !== "object") { append(quote(typeof current === "bigint" ? "[BigInt]" : `[${typeof current}]`)); return; }
        if (seen.has(current)) { append(quote("[Circular]")); return; }
        seen.add(current);
        if (Array.isArray(current)) {
          const length: unknown = current.length;
          if (typeof length !== "number" || !Number.isSafeInteger(length) || length < 0) {
            throw new Error("invalid array length");
          }
          append("[");
          stack.push({ container: current as unknown as Record<string, unknown>, index: 0,
            count: Math.min(length, budget.maxArrayItems), omitted: length > budget.maxArrayItems, depth });
        } else {
          // Collect only a bounded prefix; never materialize all keys/values into work items.
          const keys: string[] = [];
          let omitted = false;
          for (const key in current) {
            if (!Object.prototype.hasOwnProperty.call(current, key)) continue;
            if (keys.length >= budget.maxObjectKeys) { omitted = true; break; }
            keys.push(key);
          }
          keys.sort();
          append("{");
          stack.push({ container: current as Record<string, unknown>, keys, index: 0, count: keys.length, omitted, depth });
        }
      } catch (error) { unserializable(error); }
    };
    visit(value, 0);
    while (stack.length && !stopped) {
      const frame = stack[stack.length - 1];
      if (frame.index >= frame.count || nodes >= budget.maxNodes) {
        if (frame.omitted || frame.index < frame.count) {
          if (frame.index) append(", ");
          append(quote(TRUNCATED));
        }
        append(frame.keys ? "}" : "]");
        stack.pop();
        continue;
      }
      if (frame.index) append(", ");
      const key = frame.keys ? frame.keys[frame.index] : String(frame.index);
      frame.index += 1;
      if (frame.keys) append(`${quote(key)}: `);
      if (stopped) break;
      try { visit(frame.container[key], frame.depth + 1); }
      catch (error) { unserializable(error); }
    }
    return output;
  } catch (error) {
    // Last resort also handles hostile options/proxies. Never coerce the thrown value.
    return `[Unserializable: ${diagnosticErrorMessage(error)}]`;
  }
}

function displayValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "object") return stableStringify(value);
  if (typeof value === "string") return value.length > 4096 ? value.slice(0, 4085) + TRUNCATED : value;
  return stableStringify(value);
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
  ["background catchUpDebt (fixed steps)", "runtime.catchUpDebt"],
  ["Foreground accumulator/debt recovery (session only)", "runtime.foregroundDebt"],
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
  ["Long-Run Runtime Lifetime", "runtimeLifetime"],
  ["simulation fixed/month step subsystem timings", "simulationStepPerformance"],
  ["strategic union candidate blockers", "strategicUnionCandidates"],
  ["Dynastic Revolution cumulative Gate diagnostics (session only)", "provisionalRulers.revolution.cumulativeGate"],
  ["Dynastic Revolution diagnostics", "provisionalRulers.revolution"],
  ["rulers by historical accession rank", "provisionalRulers.byAccessionRank"],
  ["provisional rulers (session completions)", "provisionalRulers.session"],
  ["provisional rulers (recent 100 years)", "provisionalRulers.recent"],
  ["frame statistics window", "performance.statisticsWindow"],
  ["long-frame counter window", "performance.longFrameCounterWindow"],
  ["frame delta source", "performance.frameDeltaSource"],
  ["render frame count (session cumulative)", "performance.renderFrameCount"],
  ["FPS (rolling 300 frames)", "performance.fps"],
  ["average frame ms (rolling 300 frames)", "performance.averageFrameMs"],
  ["p95 frame ms (rolling 300 frames)", "performance.p95FrameMs"],
  ["max frame ms (rolling 300 frames)", "performance.maxFrameMs"],
  ["long frames >25/33/50/100ms (session cumulative)", "performance.longFrames"],
  ["average/max simulation steps per frame", "performance.stepsPerFrame"],
  ["average/p95 fixed-step CPU ms", "performance.fixedStepCpuMs"],
  ["average/p95 presentation CPU ms", "performance.presentationCpuMs"],
  ["Desktop power / lock / thermal / speed limit", "runtime.desktopPower"],
  ["Desktop wake / Phaser TimeStep / RAF", "runtime.desktopWake"],
  ["Frame attribution (debug only; nested timings overlap)", "performance.frameAttribution"],
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
  ["save export/serialize/write phase (debug only)", "persistence.phase"],
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
  return CORE_FIELDS.map(([label, path]) => {
    try { return `${label}: ${displayValue(readPath(data, path))}`; }
    catch (error) { return `${label}: [diagnostic serialization failed: ${diagnosticErrorMessage(error)}]`; }
  }).join("\n");
}

export function formatFullDiagnostics(sections: Array<[string, unknown]>): string {
  let output = "";
  const maxChars = 262_144;
  try {
    const count = Math.min(sections.length, 64);
    for (let index = 0; index < count; index += 1) {
      let section: string;
      try {
        const [title, value] = sections[index];
        section = `${typeof title === "string" ? title.slice(0, 200) : "Section"}\n${stableStringify(value)}`;
      } catch (error) { section = `[Unserializable: ${diagnosticErrorMessage(error)}]`; }
      const separator = index ? "\n\n" : "";
      if (output.length + separator.length + section.length > maxChars - TRUNCATED.length) {
        return (output + separator + section).slice(0, maxChars - TRUNCATED.length) + TRUNCATED;
      }
      output += separator + section;
    }
    if (sections.length > count) output += `\n${TRUNCATED}`;
    return output;
  } catch (error) { return output + `[Unserializable: ${diagnosticErrorMessage(error)}]`; }
}
