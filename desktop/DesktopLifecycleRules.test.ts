import { describe, expect, it } from "vitest";
import {
  decideSingleInstance,
  DesktopAutosaveGate,
  DesktopCloseHandshake,
} from "./DesktopLifecycleRules";

describe("Electron desktop lifecycle rules", () => {
  it("quits a second instance when the lock is unavailable", () => {
    expect(decideSingleInstance(false)).toBe("QUIT");
    expect(decideSingleInstance(true)).toBe("CONTINUE");
  });

  it("does not permit overlapping autosave requests", () => {
    const gate = new DesktopAutosaveGate();
    expect(gate.begin("a")).toBe(true);
    expect(gate.begin("b")).toBe(false);
    expect(gate.complete("b")).toBe(false);
    expect(gate.complete("a")).toBe(true);
    expect(gate.begin("b")).toBe(true);
  });

  it("allows no-world close and requires a successful save for a started world", () => {
    const close = new DesktopCloseHandshake();
    expect(close.begin(false)).toBe("ALLOW");
    expect(close.begin(true)).toBe("WAIT");
    expect(close.resolve("SAVED")).toBe("ALLOW");
    expect(close.begin(true)).toBe("WAIT");
    expect(close.resolve("FAILED")).toBe("CANCEL");
  });

  it("cancels close on timeout", () => {
    const close = new DesktopCloseHandshake();
    close.begin(true);
    expect(close.timeout()).toBe("CANCEL");
    expect(close.pending).toBe(false);
  });
});
