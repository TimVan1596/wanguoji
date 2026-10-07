import { describe, expect, it, vi } from "vitest";
import worldRandom from "../Simulation/WorldRandom";
import { DIAGNOSTIC_PREVIEW_BUDGET, stableStringify, formatCoreDiagnostics, formatFullDiagnostics } from "./DiagnosticsReport";

describe("diagnostic reports", () => {
  it("includes complete session Gate counters and all ten eligible samples in the core clipboard report", () => {
    const cumulativeGate = { successionBoundaryCheckCount: 120, hardEligibleBeforeRollCount: 10, rollAttemptCount: 10, chanceBuckets: { base: { "4%": 10 }, final: { "6%": 10 } },
      rollFailedCount: 10, usurpationCount: 0, blockerCounts: { NO_SUCCESSION_CRISIS: 80, ROLL_FAILED: 10 },
      recentEligibleBoundaries: Array.from({ length: 10 }, (_, index) => ({ factionId: `faction-${index}`,
        month: 1000 + index, stability: 20, crisisLevel: "succession-crisis", computedChance: 0.06, rollResult: 0.9, evidence: ["MINOR_SUCCESSOR"], successionReason: "natural", successorAgeMonths: 120 })) };
    const report = formatCoreDiagnostics({ provisionalRulers: { revolution: { cumulativeGate } } });
    expect(report).toContain("Dynastic Revolution cumulative Gate diagnostics (session only)");
    for (const [key, value] of [["successionBoundaryCheckCount", 120], ["hardEligibleBeforeRollCount", 10], ["rollAttemptCount", 10], ["rollFailedCount", 10], ["usurpationCount", 0]]) expect(report).toContain(`"${key}": ${value}`);
    expect(report).toContain('"computedChance": 0.06');
    expect(report).toContain('"rollResult": 0.9');
    expect(report).toContain('"chanceBuckets"');
    for (let index = 0; index < 10; index++) expect(report).toContain(`"factionId": "faction-${index}"`);
  });
  it("formats core fields and renders missing values as dashes", () => {
    const report = formatCoreDiagnostics({
      appVersion: "v0.99926a3",
      runtime: {
        mode: "DESKTOP_CONTINUOUS",
        activeCatchUpSource: "NONE",
        worldMonth: 120,
        genealogyViewer: { open: true, lastCloseSource: "BACKDROP", lastMuiReason: "backdropClick" },
        mapPointer: {
          lastTarget: "BUTTON",
          accepted: false,
          reason: "NON_CANVAS_TARGET",
          selectedFactionNameBefore: "wei",
          selectedFactionNameAfter: "wei",
          rightPanelTabBefore: "faction",
          rightPanelTabAfter: "faction",
        },
      },
      units: { logicalUsers: 7, missingTextureKeys: [], noFaceSource: "SVG" },
      performance: { fps: 60, renderFrameCount: 987, averageFrameMs: 16.7, p95FrameMs: 20, maxFrameMs: 40 },
      simulationStepPerformance: { "total fixed/month step": { averageMs: 1.2, p95Ms: 2.4, maxMs: 3, sampleCount: 300 } },
      strategicUnionCandidates: [{ factionAId: "a", factionBId: "b", blockers: ["NOT_ADJACENT"] }],
      worldScale: { worldHistoryEventCount: 123, eraCount: 5, totalFactionCount: 9, activeFactionCount: 4, exiledFactionCount: 1, extinctFactionCount: 3, mergedFactionCount: 1, activeCityCount: 9, runtimeUnitCount: 7, archivedCityCount: 5, factionSnapshotCount: 18, totalRulerCount: 42, rulerChronicleCount: 40 },
      persistence: { totalSaveDurationMs: 200, indexedDbWriteMs: 80 },
    });
    expect(report).toContain("APP_VERSION: v0.99926a3");
    expect(report).toContain("runtime mode: DESKTOP_CONTINUOUS");
    expect(report).toContain("activeCatchUpSource: NONE");
    expect(report).toContain("worldMonth: 120");
    expect(report).toContain('genealogy viewer: {"lastCloseSource": "BACKDROP", "lastMuiReason": "backdropClick", "open": true}');
    expect(report).toContain("map pointer last target: BUTTON");
    expect(report).toContain("map pointer reason: NON_CANVAS_TARGET");
    expect(report).toContain("map pointer selected faction after: wei");
    expect(report).toContain("FPS (rolling 300 frames): 60");
    expect(report).toContain("render frame count (session cumulative): 987");
    expect(report).toContain("p95 frame ms (rolling 300 frames): 20");
    expect(report).toContain("world history events: 123");
    expect(report).toContain('simulation fixed/month step subsystem timings: {"total fixed/month step": {"averageMs": 1.2');
    expect(report).toContain("merged factions: 1");
    expect(report).toContain("strategic union candidate blockers:");
    expect(report).toContain("save total duration ms: 200");
    expect(report).toContain("Electron version: —");
    expect(report).toContain("collider teardown post-drain: —");
    for (const field of [
      "package version:", "timestamp:", "platform:", "Electron version:", "running:",
      "speed:", "worldInstanceId:", "fixedSteps:", "physicsSteps:", "background mode:",
      "background catchUpDebt (fixed steps):", "lastCatchUpSource:", "focused:", "visibility:", "window minimized:",
      "genealogy viewer:",
      "minimize count:", "suspend count:", "last suspend duration:", "resume catch-up:",
      "logical users:", "root players:", "player children:", "active Phaser players:",
      "avatar renderer:", "missing texture keys:", "noFace source:", "renderer type:", "save status:", "savedAt:", "save month:",
      "hydration stage:", "canonical matched:",
    ]) expect(report).toContain(field);
  });

  it("formats undefined input without throwing", () => {
    expect(formatCoreDiagnostics(undefined)).toContain("save status: —");
  });

  it("serializes full diagnostics deterministically", () => {
    const a = formatFullDiagnostics([["Runtime", { z: 1, a: { y: 2, b: 3 } }], ["Era", undefined]]);
    const b = formatFullDiagnostics([["Runtime", { a: { b: 3, y: 2 }, z: 1 }], ["Era", undefined]]);
    expect(a).toBe(b);
    expect(a).toContain('"a": {"b": 3, "y": 2}');
    expect(a).toContain("Era\n—");
  });

  it("formats deeply nested and cyclic diagnostic values without recursion", () => {
    const root: { next?: unknown } = {};
    let cursor = root;
    for (let index = 0; index < 20_000; index += 1) {
      const next: { next?: unknown } = {};
      cursor.next = next;
      cursor = next;
    }
    cursor.next = root;
    const report = formatFullDiagnostics([["Deep", root]]);
    // The default preview stops at the depth budget before reaching the cycle.
    expect(report).toContain("[Truncated]");
    expect(report.length).toBeLessThanOrEqual(DIAGNOSTIC_PREVIEW_BUDGET.maxOutputChars + 5);
    expect(report.startsWith("Deep\n{" )).toBe(true);
    // Explicit bounded high-depth coverage retains the original cycle regression.
    expect(stableStringify(root, { maxDepth: 25_000, maxNodes: 25_000, maxOutputChars: 1_000_000 }))
      .toContain('"[Circular]"');
  });

  it("deduplicates circular graphs and shared DAG nodes globally", () => {
    const shared = { value: 7 };
    const graph: Record<string, unknown> = { a: shared, b: shared };
    graph.self = graph;
    expect(stableStringify(graph)).toBe('{"a": {"value": 7}, "b": "[Circular]", "self": "[Circular]"}');
    let reads = 0;
    let dag: object = shared;
    for (let index = 0; index < 40; index += 1) {
      const child = dag;
      dag = { get a() { reads += 1; return child; }, get b() { reads += 1; return child; } };
    }
    const report = stableStringify(dag);
    expect(report).toContain("[Circular]");
    expect(reads).toBe(80); // Would be exponential with path-local cycle detection.
    expect(report).not.toContain("[Truncated]");
  });

  it("bounds wide arrays without accessing omitted entries", () => {
    let reads = 0;
    const wide = new Proxy(new Array(1_000_000), {
      get(target, key, receiver) {
        if (key !== "length") reads += 1;
        return Reflect.get(target, key, receiver);
      },
    });
    expect(stableStringify(wide)).toContain("[Truncated]");
    expect(reads).toBe(DIAGNOSTIC_PREVIEW_BUDGET.maxArrayItems);
  });

  it("bounds wide objects without evaluating omitted properties", () => {
    let reads = 0;
    const wide: Record<string, unknown> = {};
    for (let index = 0; index < 10_000; index += 1) {
      Object.defineProperty(wide, `key${index}`, { enumerable: true, get() { reads += 1; return index; } });
    }
    expect(stableStringify(wide)).toContain("[Truncated]");
    expect(reads).toBe(DIAGNOSTIC_PREVIEW_BUDGET.maxObjectKeys);
  });

  it("isolates throwing getters and proxy enumeration/access errors", () => {
    const bad = { get bad() { throw new Error("getter failed"); }, good: 42 };
    expect(stableStringify(bad)).toContain("[Unserializable: getter failed]");
    expect(stableStringify(bad)).toContain('"good": 42');
    expect(stableStringify(new Proxy({}, { ownKeys() { throw new Error("keys failed"); } })))
      .toContain("[Unserializable: keys failed]");
    expect(stableStringify(new Proxy({ a: 1 }, { get() { throw new Error("access failed"); } })))
      .toContain("[Unserializable: access failed]");
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    expect(stableStringify(revoked.proxy)).toContain("[Unserializable:");
    expect(stableStringify({ get bad() { throw new Proxy({}, { get() { throw 0; } }); } }))
      .toContain("[Unserializable: unknown error]");
  });

  it("enforces depth, node, item, key and output budgets", () => {
    expect(stableStringify({ a: { b: 1 } }, { maxDepth: 1 })).toContain("[Truncated]");
    expect(stableStringify([1, 2, 3], { maxNodes: 2 })).toBe('[1, "[Truncated]"]');
    expect(stableStringify([1, 2], { maxArrayItems: 1 })).toBe('[1, "[Truncated]"]');
    expect(stableStringify({ a: 1, b: 2 }, { maxObjectKeys: 1 })).toContain("[Truncated]");
    for (const value of ["x".repeat(100_000), { ["k".repeat(10_000)]: 1 }, [1, 2, 3]]) {
      const report = stableStringify(value, { maxOutputChars: 32 });
      expect(report.length).toBeLessThanOrEqual(32);
    }
    expect(stableStringify("x".repeat(1000), { maxOutputChars: 32 })).toContain("[Truncated]");
    expect(stableStringify(1n)).toBe('"[BigInt]"');
    const toJSON = vi.fn(() => { throw new Error("should not run"); });
    stableStringify({ toJSON });
    expect(toJSON).not.toHaveBeenCalled();
  });

  it("continues after one CORE_FIELD path getter fails", () => {
    const report = formatCoreDiagnostics({
      get appVersion() { throw new Error("version failed"); },
      packageVersion: "0.99.98", runtime: { worldMonth: 24192 },
    });
    expect(report).toContain("APP_VERSION: [diagnostic serialization failed: version failed]");
    expect(report).toContain("package version: 0.99.98");
    expect(report).toContain("worldMonth: 24192");
    expect(report).toContain("collider teardown post-drain: —");
  });

  it("does not consume the world RNG", () => {
    const before = worldRandom.exportState();
    const next = vi.spyOn(worldRandom, "next");
    try {
      stableStringify({ shared: worldRandom.exportState() });
      formatCoreDiagnostics({ runtime: { worldMonth: 24192 } });
      formatFullDiagnostics([["RNG", before]]);
      expect(worldRandom.exportState()).toEqual(before);
      expect(next).not.toHaveBeenCalled();
    } finally { next.mockRestore(); }
  });

  it("bounds full reports across sections", () => {
    const sections: Array<[string, unknown]> = Array.from({ length: 100 }, () => ["Large", "x".repeat(100_000)]);
    const report = formatFullDiagnostics(sections);
    expect(report).toContain("[Truncated]");
    expect(report.length).toBeLessThanOrEqual(262_144);
  });
});
