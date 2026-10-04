import type { DiplomaticRelation, DiplomacyTriggerContext } from "./Diplomacy";
import { formatWorldDate, formatWorldDuration } from "../Simulation/WorldTime";

export function diplomacyStatusLabel(status: DiplomaticRelation["status"]) {
  return status === "TRUCE" ? "停战" : "互不侵犯";
}

export function diplomacyReasonLabel(reason: DiplomaticRelation["reason"]) {
  return reason === "WAR_EXHAUSTION_TRUCE" ? "战后休兵" : "共同强敌";
}

export function formatDiplomacyRelationLines(
  relation: DiplomaticRelation,
  counterpartName: string,
) {
  const duration = formatWorldDuration(relation.expiresMonth - relation.startedMonth);
  return [
    `${counterpartName} · ${diplomacyStatusLabel(relation.status)} · ${diplomacyReasonLabel(relation.reason)}`,
    `${formatWorldDate(relation.startedMonth)}订立 · 约期${duration} · 至${formatWorldDate(relation.expiresMonth)}`,
  ];
}

export function describeDiplomacySigning(
  relation: DiplomaticRelation,
  triggerContext: DiplomacyTriggerContext,
  context: {
    factionAName: string;
    factionBName: string;
    commonThreatName?: string;
  },
) {
  const duration = formatWorldDuration(relation.expiresMonth - relation.startedMonth);
  if (relation.reason === "WAR_EXHAUSTION_TRUCE") {
    return `近三年两国有${triggerContext.reason === "WAR_EXHAUSTION_TRUCE" ? triggerContext.recentBilateralCaptureCount : 0}次城邑易手，遂议定停战${duration}。`;
  }
  return `${context.commonThreatName ?? "共同强敌"}势明显强于${context.factionAName}、${context.factionBName}，两国因共同压力订立互不侵犯之约，约期${duration}。`;
}

export interface DiplomacyBadgeItem {
  relation: DiplomaticRelation;
  counterpartId: string;
}

export function getFactionDiplomacyBadges(
  relations: DiplomaticRelation[],
  factionId: string,
  limit = 2,
): DiplomacyBadgeItem[] {
  return relations
    .filter((relation) => relation.factionAId === factionId || relation.factionBId === factionId)
    .map((relation) => ({
      relation,
      counterpartId: relation.factionAId === factionId ? relation.factionBId : relation.factionAId,
    }))
    .slice(0, limit);
}
