import type { SovereigntyRank } from "../Simulation/FactionIdentity";
import worldRandom from "../Simulation/WorldRandom";

export interface RulerBattleDeathContext {
  reignMonths: number;
  monthsSinceLastBattleDeath?: number;
  severeCrisis?: boolean;
  rulerInSiege?: boolean;
  capitalUnderSiege?: boolean;
  sovereigntyRank?: SovereigntyRank;
  randomRoll?: number;
}

export function shouldPreventRulerBattleDeath(context: RulerBattleDeathContext) {
  if (context.severeCrisis) {
    return false;
  }
  const protection = getRulerBattleProtection(context.sovereigntyRank);
  if (context.reignMonths < protection.accessionGraceMonths) {
    return true;
  }
  return (
    context.monthsSinceLastBattleDeath !== undefined &&
    context.monthsSinceLastBattleDeath < protection.chainCooldownMonths
  );
}

export function shouldRulerBattleDeathOccur(context: RulerBattleDeathContext) {
  if (shouldPreventRulerBattleDeath(context)) {
    return false;
  }
  if (!hasBattlefieldFatalityContext(context)) {
    return false;
  }
  if (context.severeCrisis) {
    return true;
  }
  const risk = getRulerBattleDeathRisk(context.sovereigntyRank);
  const roll = context.randomRoll === undefined ? worldRandom.next() : context.randomRoll;
  return roll <= risk;
}

export function getRulerBattleDeathRisk(rank: SovereigntyRank = "LEADER") {
  if (rank === "EMPEROR") {
    return 0.08;
  }
  if (rank === "KING") {
    return 0.25;
  }
  return 0.35;
}

export function getRulerBattleProtection(rank: SovereigntyRank = "LEADER") {
  if (rank === "EMPEROR") {
    return {
      accessionGraceMonths: 72,
      chainCooldownMonths: 84,
    };
  }
  if (rank === "KING") {
    return {
      accessionGraceMonths: 48,
      chainCooldownMonths: 60,
    };
  }
  return {
    accessionGraceMonths: 18,
    chainCooldownMonths: 24,
  };
}

export function hasBattlefieldFatalityContext(context: RulerBattleDeathContext) {
  const rank = context.sovereigntyRank ?? "LEADER";
  if (context.rulerInSiege) {
    return true;
  }
  if (rank === "EMPEROR") {
    return Boolean(context.severeCrisis);
  }
  return Boolean(context.severeCrisis || context.capitalUnderSiege);
}

export interface RulerBattleHazardState {
  lastBattleHazardCheckMonth?: number;
}

export function getRulerBattleHazardIntervalMonths(rank: SovereigntyRank = "LEADER") {
  return rank === "LEADER" ? 12 : 1;
}

/** Called by the real collision path. Only eligible checks consume a draw/window. */
export function checkRulerBattleHazard(
  ruler: RulerBattleHazardState,
  worldMonth: number,
  context: RulerBattleDeathContext,
) {
  // Existing terminal capital-collapse semantics bypass ordinary protection and rolls.
  if (context.severeCrisis) return shouldRulerBattleDeathOccur(context);
  if (shouldPreventRulerBattleDeath(context) || !hasBattlefieldFatalityContext(context)) return false;
  if (ruler.lastBattleHazardCheckMonth !== undefined &&
    worldMonth - ruler.lastBattleHazardCheckMonth < getRulerBattleHazardIntervalMonths(context.sovereigntyRank)) return false;
  ruler.lastBattleHazardCheckMonth = worldMonth;
  return shouldRulerBattleDeathOccur(context);
}
