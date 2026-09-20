import { describe, expect, it } from "vitest";
import {
  CITY_CAPITAL_LABEL_FONT_SIZE,
  CITY_LABEL_FONT_SIZE,
} from "./simulation";

describe("simulation display config", () => {
  it("keeps city labels in the same readable base range", () => {
    expect(CITY_LABEL_FONT_SIZE).toBeGreaterThanOrEqual(12);
    expect(CITY_CAPITAL_LABEL_FONT_SIZE - CITY_LABEL_FONT_SIZE).toBeLessThanOrEqual(1);
  });
});
