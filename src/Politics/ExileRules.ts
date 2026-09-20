import { FactionStatus } from "../Simulation/FactionLifecycle";

export function canCreateFallbackSuccessor(status: FactionStatus) {
  return status === "ACTIVE";
}

export function shouldCreateActiveHeir(status: FactionStatus) {
  return status === "ACTIVE";
}

export function canInheritInExile(hasExistingHeir: boolean) {
  return hasExistingHeir;
}

export function canRestoreExiledFaction(
  remnantPopulation: number,
  hasClaimant: boolean,
  legitimacy = 100
) {
  return remnantPopulation > 0 && hasClaimant && legitimacy > 0;
}

export function decayExileLegitimacy(
  currentLegitimacy: number,
  remnantPopulation: number,
  baseDecay: number
) {
  const cushion = Math.min(3, Math.floor(remnantPopulation / 4));
  return Math.max(0, currentLegitimacy - Math.max(1, baseDecay - cushion));
}

export function decayRemnantPopulation(remnantPopulation: number) {
  if (remnantPopulation <= 0) {
    return 0;
  }
  return Math.max(0, remnantPopulation - Math.max(1, Math.floor(remnantPopulation * 0.2)));
}

export function shouldExileBecomeExtinct(
  remnantPopulation: number,
  legitimacy: number,
  hasClaimant: boolean
) {
  return remnantPopulation <= 0 && legitimacy <= 0 && !hasClaimant;
}
