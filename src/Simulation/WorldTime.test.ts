import { describe, expect, it } from "vitest";
import {
  formatWorldDate,
  formatWorldDuration,
  getWorldMonth,
  getWorldYear,
  monthsToYears,
  yearsToMonths,
} from "./WorldTime";

describe("world time", () => {
  it("formats month zero as era 0 year month 1", () => {
    expect(formatWorldDate(0)).toBe("0年1月");
  });

  it("formats month 11 as era 0 year month 12", () => {
    expect(formatWorldDate(11)).toBe("0年12月");
  });

  it("formats month 12 as era 1 year month 1", () => {
    expect(formatWorldDate(12)).toBe("1年1月");
  });

  it("formats month 39 as era 3 year month 4", () => {
    expect(formatWorldDate(39)).toBe("3年4月");
    expect(getWorldYear(39)).toBe(3);
    expect(getWorldMonth(39)).toBe(4);
  });

  it("converts years and months consistently", () => {
    expect(yearsToMonths(8)).toBe(96);
    expect(monthsToYears(30)).toBe(2.5);
  });

  it("formats durations with months for short reigns", () => {
    expect(formatWorldDuration(3)).toBe("3个月");
    expect(formatWorldDuration(40)).toBe("3年4个月");
    expect(formatWorldDuration(84)).toBe("7年");
  });
});
