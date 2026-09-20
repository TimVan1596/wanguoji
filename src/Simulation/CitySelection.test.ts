import { describe, expect, it, vi } from "vitest";
import { selectCityFromList } from "./CitySelection";

describe("city selection", () => {
  it("selects a city from the list without camera focus", () => {
    const core = {
      selectCity: vi.fn(),
      focusCameraOnCity: vi.fn(),
    };

    selectCityFromList(core, "city-xianyang");

    expect(core.selectCity).toHaveBeenCalledWith("city-xianyang");
    expect(core.focusCameraOnCity).not.toHaveBeenCalled();
  });
});
