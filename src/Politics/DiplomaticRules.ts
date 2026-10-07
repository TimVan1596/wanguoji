/** Pure factual diplomacy policy. No RNG and no hidden opinion/war state. */
export type ThreatCredibility = "NONE" | "WEAK" | "CREDIBLE" | "SEVERE";
export interface CommonThreatFacts {
  territoryShareA: number; territoryShareB: number; threatTerritoryShare: number;
  directA: boolean; directB: boolean; adjacentPair: boolean; priorRelationMonths: number;
  capturedA: boolean; capturedB: boolean; capitalFall: boolean;
}
export function evaluateCommonThreatCredibility(f: CommonThreatFacts): ThreatCredibility {
  const advantage = f.threatTerritoryShare / Math.max(f.territoryShareA, f.territoryShareB, 1);
  if (advantage < 2.5) return "NONE";
  if (!f.directA && !f.directB) return "WEAK";
  if (f.directA && f.directB) return "SEVERE";
  // A common pressure corridor must be real, not just two distant weak states.
  if (f.adjacentPair || f.priorRelationMonths >= 24) return "CREDIBLE";
  return "WEAK";
}
export interface DiplomaticDurationFacts {
  credibility?: ThreatCredibility; recentBilateralCaptureCount?: number;
  stabilityA?: number; stabilityB?: number; capitalFall?: boolean;
  directA?: boolean; directB?: boolean; priorDurationMonths?: number;
  threatTerritoryShare?: number; territoryShareA?: number; territoryShareB?: number;
}
export function getDiplomaticDuration(status: "TRUCE" | "NON_AGGRESSION" | "ALLIANCE", f: DiplomaticDurationFacts): number {
  if (status === "TRUCE") {
    const pressure = Math.min(2, Math.max(0, (f.recentBilateralCaptureCount ?? 0) - 1));
    const weary = Math.min(f.stabilityA ?? 100, f.stabilityB ?? 100) <= 40 ? 1 : 0;
    return 12 * Math.min(5, 2 + pressure + weary + (f.capitalFall ? 1 : 0));
  }
  const exposure = f.directA && f.directB ? 1 : 0;
  const advantage = (f.threatTerritoryShare ?? 0) / Math.max(f.territoryShareA ?? 0, f.territoryShareB ?? 0, 1);
  const continuity = (f.priorDurationMonths ?? 0) >= 72 ? 1 : 0;
  if (status === "NON_AGGRESSION") return 12 * Math.min(12, 6 + (f.credibility === "SEVERE" ? 2 : 0) + exposure + (advantage >= 5 ? 2 : 0) + continuity);
  return 12 * Math.min(15, 8 + (f.credibility === "SEVERE" ? 3 : 0) + exposure + (advantage >= 5 ? 2 : 0) + continuity);
}
export function getDiplomaticCooldown(status: "TRUCE" | "NON_AGGRESSION" | "ALLIANCE", duration: number): number {
  const [min, max] = status === "TRUCE" ? [12, 24] : status === "NON_AGGRESSION" ? [24, 48] : [24, 60];
  return Math.min(max, Math.max(min, Math.ceil(duration / 36) * 12));
}
export function canUpgradeToAlliance(credibility: ThreatCredibility, napMonths: number) {
  return napMonths >= 24 && (credibility === "SEVERE" || (credibility === "CREDIBLE" && napMonths >= 72));
}
