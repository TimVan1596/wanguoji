import type { WorldEvent } from "../History/WorldHistory";
import type { FactionSnapshot } from "./FactionSnapshots";

export const TERRITORY_TICKS = [0, 25, 50, 75, 100];

export function getEventMarkerLaneY(index: number) {
  return index % 2 === 0 ? 13 : 20;
}

export function createTimeTicks(snapshots: FactionSnapshot[], maxTicks = 5) {
  if (snapshots.length === 0) {
    return [];
  }
  const first = snapshots[0].year;
  const last = snapshots[snapshots.length - 1].year;
  if (first === last) {
    return [first];
  }
  const steps = Math.max(1, Math.min(maxTicks - 1, snapshots.length - 1));
  return Array.from({ length: steps + 1 }, (_, index) =>
    Math.round(first + ((last - first) * index) / steps)
  );
}

export function createPopulationTicks(values: number[], maxTicks = 5) {
  if (values.length === 0) {
    return [0];
  }
  const max = Math.max(0, ...values);
  if (max <= 0) {
    return [0];
  }
  const step = niceStep(max / Math.max(1, maxTicks - 1));
  const upper = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let value = 0; value <= upper; value += step) {
    ticks.push(value);
  }
  return ticks.slice(0, maxTicks + 1);
}

export function normalizeMarkerEvents(
  events: WorldEvent[],
  snapshots: FactionSnapshot[]
) {
  if (snapshots.length === 0) {
    return [];
  }
  const first = snapshots[0].year;
  const last = snapshots[snapshots.length - 1].year;
  return events.filter((event) => {
    const month = event.monthIndex ?? event.year;
    return month >= first && month <= last;
  });
}

function niceStep(raw: number) {
  const exponent = Math.floor(Math.log10(Math.max(raw, 1)));
  const base = 10 ** exponent;
  const normalized = raw / base;
  if (normalized <= 1) {
    return base;
  }
  if (normalized <= 2) {
    return 2 * base;
  }
  if (normalized <= 5) {
    return 5 * base;
  }
  return 10 * base;
}
