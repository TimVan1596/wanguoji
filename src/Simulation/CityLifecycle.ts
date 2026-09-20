import {
  CITY_CAPTURE_DEVASTATION,
  CITY_DEVASTATION_RECOVERY,
  CITY_DESTRUCTION_THRESHOLD,
  CITY_REPEAT_CAPTURE_DEVASTATION,
  CITY_REPEAT_CAPTURE_WINDOW_MONTHS,
  MIN_ACTIVE_CITIES,
} from "../config/simulation";

export function getCaptureDevastationIncrease(monthsSinceLastCapture?: number) {
  if (
    monthsSinceLastCapture !== undefined &&
    monthsSinceLastCapture <= CITY_REPEAT_CAPTURE_WINDOW_MONTHS
  ) {
    return CITY_CAPTURE_DEVASTATION + CITY_REPEAT_CAPTURE_DEVASTATION;
  }
  return CITY_CAPTURE_DEVASTATION;
}

export function recoverDevastation(devastation: number) {
  return Math.max(0, devastation - CITY_DEVASTATION_RECOVERY);
}

export function canDestroyCity(activeCityCount: number, devastation: number) {
  return (
    activeCityCount > MIN_ACTIVE_CITIES &&
    devastation >= CITY_DESTRUCTION_THRESHOLD
  );
}

export function canPermanentlyDestroyCity(
  activeCityCount: number,
  devastation: number,
  isIndestructible: boolean
) {
  return !isIndestructible && canDestroyCity(activeCityCount, devastation);
}

export function isCityTooNearExisting(
  candidate: { x: number; y: number },
  existing: { x: number; y: number }[],
  minDistance: number
) {
  return existing.some(
    (city) => Math.abs(city.x - candidate.x) + Math.abs(city.y - candidate.y) < minDistance
  );
}
