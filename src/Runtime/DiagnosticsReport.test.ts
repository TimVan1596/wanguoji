import { describe, expect, it } from "vitest";
import { formatCoreDiagnostics, formatFullDiagnostics } from "./DiagnosticsReport";

describe("diagnostic reports", () => {
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
    expect(report).toContain("FPS: 60");
    expect(report).toContain("render frame count: 987");
    expect(report).toContain("p95 frame ms: 20");
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
      "catchUpDebt:", "lastCatchUpSource:", "focused:", "visibility:", "window minimized:",
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
    expect(report).toContain('"[Circular]"');
    expect(report.startsWith("Deep\n{" )).toBe(true);
  });
});
