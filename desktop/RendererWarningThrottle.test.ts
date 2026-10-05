import { describe, expect, it } from "vitest";
import { RendererWarningThrottle } from "./RendererWarningThrottle";

describe("RendererWarningThrottle", () => {
  it("logs the first warning, suppresses repeats, then summarizes them", () => {
    const throttle = new RendererWarningThrottle();
    expect(throttle.accept("warning A", 100)).toEqual({ kind: "LOG" });
    expect(throttle.accept("warning A", 101)).toEqual({ kind: "SUPPRESS" });
    expect(throttle.accept("warning A", 30_100)).toEqual({ kind: "SUMMARY", suppressedCount: 2 });
  });

  it("keeps distinct warning identities independent", () => {
    const throttle = new RendererWarningThrottle();
    expect(throttle.accept("source A", 0).kind).toBe("LOG");
    expect(throttle.accept("source B", 1).kind).toBe("LOG");
  });
});
