import type { SovereigntyRank } from "../Simulation/FactionIdentity";

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
  return (context.randomRoll ?? Math.random()) <= risk;
}

export function getRulerBattleDeathRisk(rank: SovereigntyRank = "LEADER") {
  if (rank === "EMPEROR") {
    return 0.08;
  }
  if (rank === "KING") {
    return 0.25;
  }
  return 1;
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
  if (rank === "LEADER") {
    return true;
  }
  if (context.rulerInSiege) {
    return true;
  }
  if (rank === "EMPEROR") {
    return Boolean(context.severeCrisis);
  }
  return Boolean(context.severeCrisis || context.capitalUnderSiege);
}
