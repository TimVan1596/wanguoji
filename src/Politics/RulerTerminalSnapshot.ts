import { RulerReignSnapshot } from "./RulerChronicle";

export function createTerminalRulerSnapshot(month: number): RulerReignSnapshot {
  return { month, population: 0, territoryShare: 0, cityCount: 0, stability: 0 };
}
