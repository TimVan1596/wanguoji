import { describe, expect, it } from "vitest";
import { formatEraTimelineRange, formatStableEraOption } from "./index";

describe("history era picker", () => {
  it("uses a stable current-era label that does not include live duration", () => {
    const label = formatStableEraOption({
      name: "燕秦争霸",
      startMonth: 16,
      endMonth: undefined,
    });
    expect(label).toBe("燕秦争霸 · 1年5月～今");
    expect(label).not.toContain("已持续");
  });

  it("uses fixed dates for closed eras", () => {
    expect(
      formatStableEraOption({
        name: "群雄争衡",
        startMonth: 0,
        endMonth: 28,
      })
    ).toBe("群雄争衡 · 0年1月～2年5月");
  });

  it("formats compact timeline date ranges", () => {
    expect(formatEraTimelineRange({ startMonth: 0, endMonth: 28 })).toBe(
      "0年1月–2年5月"
    );
    expect(formatEraTimelineRange({ startMonth: 29 })).toBe("2年6月–今");
  });
});
