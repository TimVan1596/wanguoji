import {
  SuccessionEffectLevel,
  SuccessionEffectRule,
} from "../Politics/SuccessionRules";

export type FactionEffectType =
  | "SUCCESSION_SHOCK"
  | "SUCCESSION_INSTABILITY"
  | "SUCCESSION_CRISIS";

export interface ActiveFactionEffect {
  id: string;
  factionId: string;
  type: FactionEffectType;
  level: SuccessionEffectLevel;
  startYear: number;
  endYear: number;
  loyaltyRecoveryMultiplier: number;
  rebellionRiskMultiplier: number;
}

class FactionEffectStore {
  private effects: ActiveFactionEffect[] = [];
  private strategicModifiers = new Map<
    string,
    { siegeMultiplier: number; captureLoyaltyBonus: number }
  >();
  private sequence = 0;

  reset() {
    this.effects = [];
    this.strategicModifiers.clear();
    this.sequence = 0;
  }

  update(year: number) {
    this.effects = this.effects.filter((effect) => year < effect.endYear);
  }

  addSuccessionEffect(factionId: string, year: number, rule: SuccessionEffectRule) {
    this.sequence += 1;
    const type: FactionEffectType =
      rule.level === "succession-crisis"
        ? "SUCCESSION_CRISIS"
        : rule.level === "succession-instability"
        ? "SUCCESSION_INSTABILITY"
        : "SUCCESSION_SHOCK";
    const effect: ActiveFactionEffect = {
      id: `${type}-${factionId}-${year}-${this.sequence}`,
      factionId,
      type,
      level: rule.level,
      startYear: year,
      endYear: year + rule.durationYears,
      loyaltyRecoveryMultiplier: rule.loyaltyRecoveryMultiplier,
      rebellionRiskMultiplier: rule.rebellionRiskMultiplier,
    };
    this.effects.push(effect);
    return effect;
  }

  getEffects(factionId?: string) {
    return this.effects.filter((effect) => !factionId || effect.factionId === factionId);
  }

  getLoyaltyRecoveryMultiplier(factionId: string) {
    return this.effects
      .filter((effect) => effect.factionId === factionId)
      .reduce((multiplier, effect) => multiplier * effect.loyaltyRecoveryMultiplier, 1);
  }

  getRebellionRiskMultiplier(factionId: string) {
    return this.effects
      .filter((effect) => effect.factionId === factionId)
      .reduce((multiplier, effect) => multiplier * effect.rebellionRiskMultiplier, 1);
  }

  setStrategicModifier(
    factionId: string,
    modifier: { siegeMultiplier: number; captureLoyaltyBonus: number }
  ) {
    if (modifier.siegeMultiplier <= 1 && modifier.captureLoyaltyBonus <= 0) {
      this.strategicModifiers.delete(factionId);
      return;
    }
    this.strategicModifiers.set(factionId, modifier);
  }

  clearStrategicModifiers() {
    this.strategicModifiers.clear();
  }

  getSiegeMultiplier(factionId: string) {
    return this.strategicModifiers.get(factionId)?.siegeMultiplier ?? 1;
  }

  getCaptureLoyaltyBonus(factionId: string) {
    return this.strategicModifiers.get(factionId)?.captureLoyaltyBonus ?? 0;
  }
}

const FactionEffects = new FactionEffectStore();

export default FactionEffects;
