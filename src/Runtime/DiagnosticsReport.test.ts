import { describe, expect, it } from "vitest";
import { formatCoreDiagnostics, formatFullDiagnostics } from "./DiagnosticsReport";

describe("diagnostic reports", () => {
  it("formats core fields and renders missing values as dashes", () => {
    const report = formatCoreDiagnostics({
      appVersion: "v0.99924",
      runtime: { mode: "DESKTOP_CONTINUOUS", activeCatchUpSource: "NONE", worldMonth: 120 },
      units: { logicalUsers: 7, missingTextureKeys: [], noFaceSource: "SVG" },
      performance: { fps: 60, renderFrameCount: 987, averageFrameMs: 16.7, p95FrameMs: 20, maxFrameMs: 40 },
      worldScale: { worldHistoryEventCount: 123, eraCount: 5, activeFactionCount: 4, activeCityCount: 9, activePlayerCount: 7 },
      persistence: { totalSaveDurationMs: 200, indexedDbWriteMs: 80 },
    });
    expect(report).toContain("APP_VERSION: v0.99924");
    expect(report).toContain("runtime mode: DESKTOP_CONTINUOUS");
    expect(report).toContain("activeCatchUpSource: NONE");
    expect(report).toContain("worldMonth: 120");
    expect(report).toContain("FPS: 60");
    expect(report).toContain("render frame count: 987");
    expect(report).toContain("p95 frame ms: 20");
    expect(report).toContain("world history events: 123");
    expect(report).toContain("save total duration ms: 200");
    expect(report).toContain("Electron version: —");
    expect(report).toContain("collider teardown post-drain: —");
    for (const field of [
      "package version:", "timestamp:", "platform:", "Electron version:", "running:",
      "speed:", "worldInstanceId:", "fixedSteps:", "physicsSteps:", "background mode:",
      "catchUpDebt:", "lastCatchUpSource:", "focused:", "visibility:", "window minimized:",
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
});
