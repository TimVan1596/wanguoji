import { describe, expect, it } from "vitest";
import {
  calculateSuccessionEffect,
  pickRulerGivenName,
} from "./SuccessionRules";

describe("succession rules", () => {
  it("uses one ruler-succession style rule for normal succession", () => {
    const effect = calculateSuccessionEffect(31 * 12, 31 * 12, []);
    expect(effect.level).toBe("succession-shock");
    expect(effect.durationYears).toBeGreaterThanOrEqual(8 * 12);
  });

  it("does not pick the direct predecessor name", () => {
    const picked = pickRulerGivenName(["安", "昭", "烈"], ["昭"], () => 0);
    expect(picked).not.toBe("昭");
  });

  it("avoids the last eight formally used ruler names when possible", () => {
    const picked = pickRulerGivenName(
      ["安", "昭", "武", "文", "景", "烈", "成", "康", "惠"],
      ["安", "昭", "武", "文", "景", "烈", "成", "康"],
      () => 0
    );
    expect(picked).toBe("惠");
  });

  it("prefers given names never used in the dynasty before falling back to recent dedupe", () => {
    const picked = pickRulerGivenName(
      ["安", "昭", "武", "文", "景", "烈", "成", "康", "惠"],
      ["安", "昭", "武", "文", "景", "烈", "成", "康"],
      () => 0
    );
    expect(picked).toBe("惠");

    const fallback = pickRulerGivenName(
      ["安", "昭", "武"],
      ["安", "昭", "武", "安", "昭", "武", "安", "昭", "武"],
      () => 0
    );
    expect(["安", "昭", "武"]).toContain(fallback);
  });

  it("can deterministically pick double-character given names", () => {
    const picked = pickRulerGivenName(
      {
        singleNames: ["安"],
        doubleNamePrefixes: ["子"],
        doubleNameSuffixes: ["衡"],
        doubleNameChancePercent: 25,
      },
      [],
      () => 0
    );
    expect(picked).toBe("子衡");
  });

  it("avoids recently used double-character given names too", () => {
    const picked = pickRulerGivenName(
      {
        singleNames: ["安"],
        doubleNamePrefixes: ["子", "伯"],
        doubleNameSuffixes: ["衡"],
        doubleNameChancePercent: 25,
      },
      ["子衡"],
      () => 0
    );
    expect(picked).toBe("伯衡");
  });

  it("upgrades repeated succession within ten years", () => {
    expect(calculateSuccessionEffect(100 * 12, 5 * 12, [94 * 12]).level).toBe(
      "succession-instability"
    );
    expect(
      calculateSuccessionEffect(100 * 12, 5 * 12, [92 * 12, 96 * 12]).level
    ).toBe(
      "succession-crisis"
    );
  });
});
