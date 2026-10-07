import type { DiplomaticRelation, DiplomacyTriggerContext } from "./Diplomacy";
import { formatWorldDate, formatWorldDuration } from "../Simulation/WorldTime";

export function diplomacyStatusLabel(status: DiplomaticRelation["status"]) {
  if (status === "TRUCE") return "停战";
  if (status === "ALLIANCE") return "战略同盟";
  return "互不侵犯";
}

export function diplomacyReasonLabel(reason: DiplomaticRelation["reason"]) {
  if (reason === "WAR_EXHAUSTION_TRUCE") return "战后休兵";
  return reason === "COMMON_THREAT_ALLIANCE" ? "共同威胁" : "共同强敌";
}

export function formatDiplomacyRelationLines(
  relation: DiplomaticRelation,
  counterpartName: string,
) {
  const duration = formatWorldDuration(relation.expiresMonth - relation.startedMonth);
  return [
    `${counterpartName} · ${diplomacyStatusLabel(relation.status)} · ${diplomacyReasonLabel(relation.reason)}`,
    `${formatWorldDate(relation.startedMonth)}订立 · ${relation.renewalCount ? "续约后" : `约期${duration} · `}至${formatWorldDate(relation.expiresMonth)}${relation.renewalCount ? ` · 已续约${relation.renewalCount}次` : ""}`,
    ...(relation.originalStartedMonth !== relation.startedMonth ? [`连续关系始于${formatWorldDate(relation.originalStartedMonth)}`] : []),
    ...(relation.lastRenewedMonth !== undefined ? [`最近续约：${formatWorldDate(relation.lastRenewedMonth)}`] : []),
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
  if (relation.status === "ALLIANCE") {
    const priorDuration = relation.preconditionDurationMonths ?? (triggerContext.reason === "COMMON_THREAT_ALLIANCE" ? triggerContext.priorDurationMonths : undefined);
    return `${context.commonThreatName ?? "共同强敌"}构成共同威胁，两国在互不侵犯${priorDuration === undefined ? "" : formatWorldDuration(priorDuration)}后结成战略同盟，约期${duration}。`;
  }
  return `${context.commonThreatName ?? "共同强敌"}势明显强于${context.factionAName}、${context.factionBName}，两国因共同压力订立互不侵犯之约，约期${duration}。`;
}

export interface DiplomacyBadgeItem {
  relation: DiplomaticRelation;
  counterpartId: string;
}

export interface DiplomacySignerSnapshot {
  factionId: string;
  rulerId: string;
  title: string;
  role: "君主" | "首领";
}

export function createDiplomacyEventMetadata(
  relation: DiplomaticRelation,
  triggerContext?: DiplomacyTriggerContext,
  signers: [DiplomacySignerSnapshot?, DiplomacySignerSnapshot?] = [undefined, undefined],
): Record<string, string | number | undefined> {
  const metadata: Record<string, string | number | undefined> = {
    reason: triggerContext?.reason ?? relation.reason,
    status: relation.status,
    originalStartedMonth: relation.originalStartedMonth,
    startedMonth: relation.startedMonth,
    renewalCount: relation.renewalCount,
    lastRenewedMonth: relation.lastRenewedMonth,
    expiresMonth: relation.expiresMonth,
    previousExpiresMonth: triggerContext?.previousExpiresMonth,
    newExpiresMonth: relation.expiresMonth,
    renewalDuration: triggerContext?.renewalDuration,
    threatCredibility: triggerContext?.credibility,
    directContactA: triggerContext?.directA === undefined ? undefined : Number(triggerContext.directA),
    directContactB: triggerContext?.directB === undefined ? undefined : Number(triggerContext.directB),
    adjacentPair: triggerContext?.adjacentPair === undefined ? undefined : Number(triggerContext.adjacentPair),
    threatCapturedA: triggerContext?.capturedA === undefined ? undefined : Number(triggerContext.capturedA),
    threatCapturedB: triggerContext?.capturedB === undefined ? undefined : Number(triggerContext.capturedB),
    capitalFall: triggerContext?.capitalFall === undefined ? undefined : Number(triggerContext.capitalFall),
  };
  if (triggerContext?.reason === "WAR_EXHAUSTION_TRUCE") {
    metadata.recentBilateralCaptureCount = triggerContext.recentBilateralCaptureCount;
    metadata.stabilityA = triggerContext.stabilityA;
    metadata.stabilityB = triggerContext.stabilityB;
  } else if (triggerContext?.reason === "COMMON_THREAT_NON_AGGRESSION") {
    metadata.commonThreatFactionId = triggerContext.commonThreatFactionId;
    metadata.territoryShareA = triggerContext.territoryShareA;
    metadata.territoryShareB = triggerContext.territoryShareB;
    metadata.threatTerritoryShare = triggerContext.threatTerritoryShare;
    if (triggerContext.priorStatus) metadata.priorStatus = triggerContext.priorStatus;
    if (triggerContext.priorDurationMonths !== undefined) metadata.preconditionDurationMonths = relation.preconditionDurationMonths ?? triggerContext.priorDurationMonths;
  } else if (triggerContext?.reason === "COMMON_THREAT_ALLIANCE") {
    metadata.commonThreatFactionId = triggerContext.commonThreatFactionId;
    metadata.territoryShareA = triggerContext.territoryShareA;
    metadata.territoryShareB = triggerContext.territoryShareB;
    metadata.threatTerritoryShare = triggerContext.threatTerritoryShare;
    metadata.preconditionStatus = triggerContext.priorStatus;
    metadata.preconditionDurationMonths = relation.preconditionDurationMonths ?? triggerContext.priorDurationMonths;
    if (relation.preconditionStartedMonth !== undefined) metadata.preconditionStartedMonth = relation.preconditionStartedMonth;
  }
  const [a, b] = signers;
  if (a) {
    metadata.signatoryAFactionId = a.factionId;
    metadata.signatoryARulerId = a.rulerId;
    metadata.signatoryATitle = a.title;
    metadata.signatoryARole = a.role;
  }
  if (b) {
    metadata.signatoryBFactionId = b.factionId;
    metadata.signatoryBRulerId = b.rulerId;
    metadata.signatoryBTitle = b.title;
    metadata.signatoryBRole = b.role;
  }
  return metadata;
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

export function describeDiplomacyRenewal(relation: DiplomaticRelation, context: DiplomacyTriggerContext, names: { factionAName: string; factionBName: string; commonThreatName?: string }) {
  const duration=formatWorldDuration(context.renewalDuration ?? 0);
  const pair=`${names.factionAName}、${names.factionBName}`;
  if(relation.status === "TRUCE") return `战后休兵需求仍在，${pair}续订停战${duration}。`;
  return `${names.commonThreatName ?? "共同强敌"}的共同压力仍在，${pair}${relation.status === "ALLIANCE" ? "续盟" : "续订互不侵犯之约"}${duration}。`;
}
