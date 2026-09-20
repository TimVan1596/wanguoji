import type { SovereigntyRank } from "./FactionIdentity";

export const EMPEROR_EFFECTIVE_STABILITY_BONUS = 8;
export const EMPEROR_EXILE_LEGITIMACY_DECAY_MULTIPLIER = 0.55;
export const EMPEROR_RESTORATION_WEIGHT_MULTIPLIER = 1.75;
export const EMPEROR_SUCCESSION_SHOCK_MULTIPLIER = 0.65;

export function getEffectiveStability(baseStability: number, rank?: SovereigntyRank) {
  if (rank === "EMPEROR") {
    return Math.min(100, baseStability + EMPEROR_EFFECTIVE_STABILITY_BONUS);
  }
  return baseStability;
}

export function getExileLegitimacyDecayMultiplier(rank?: SovereigntyRank) {
  return rank === "EMPEROR" ? EMPEROR_EXILE_LEGITIMACY_DECAY_MULTIPLIER : 1;
}

export function getRestorationWeightMultiplier(rank?: SovereigntyRank) {
  return rank === "EMPEROR" ? EMPEROR_RESTORATION_WEIGHT_MULTIPLIER : 1;
}

export function getSuccessionShockMultiplier(rank?: SovereigntyRank) {
  return rank === "EMPEROR" ? EMPEROR_SUCCESSION_SHOCK_MULTIPLIER : 1;
}
