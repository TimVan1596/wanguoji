import { describe, expect, it } from "vitest";
import {
  canDestroyCity,
  canPermanentlyDestroyCity,
  getNewCityInitialDefense,
  getCaptureDevastationIncrease,
  isCityTooNearExisting,
  recoverDevastation,
} from "./CityLifecycle";
import { MIN_ACTIVE_CITIES } from "../config/simulation";

describe("city lifecycle rules", () => {
  it("keeps newly founded cities at the e1 60% initial-defense level", () => {
    expect(getNewCityInitialDefense(6)).toBe(3);
    expect(getNewCityInitialDefense(10)).toBe(6);
    expect(getNewCityInitialDefense(1)).toBe(1);
  });

  it("increases devastation on capture", () => {
    expect(getCaptureDevastationIncrease()).toBeGreaterThan(0);
  });

  it("adds more devastation for repeated captures", () => {
    expect(getCaptureDevastationIncrease(12)).toBeGreaterThan(
      getCaptureDevastationIncrease()
    );
  });

  it("lets peaceful cities recover slowly", () => {
    expect(recoverDevastation(34)).toBe(33);
  });

  it("allows destruction at the threshold", () => {
    expect(canDestroyCity(MIN_ACTIVE_CITIES + 1, 100)).toBe(true);
  });

  it("prevents excessive destruction when too few cities remain", () => {
    expect(canDestroyCity(MIN_ACTIVE_CITIES, 100)).toBe(false);
  });

  it("protects historical cities from permanent destruction", () => {
    expect(canPermanentlyDestroyCity(MIN_ACTIVE_CITIES + 1, 100, true)).toBe(false);
  });

  it("allows normal generated cities to be permanently destroyed", () => {
    expect(canPermanentlyDestroyCity(MIN_ACTIVE_CITIES + 1, 100, false)).toBe(true);
  });

  it("prevents new cities from spawning too near existing cities", () => {
    expect(isCityTooNearExisting({ x: 4, y: 4 }, [{ x: 6, y: 5 }], 8)).toBe(true);
    expect(isCityTooNearExisting({ x: 4, y: 4 }, [{ x: 20, y: 20 }], 8)).toBe(false);
  });
});
