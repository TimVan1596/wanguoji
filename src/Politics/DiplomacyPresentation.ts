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
  const label = diplomacyStatusLabel(relation.status);
  return [
    `${counterpartName} · ${label} · ${diplomacyReasonLabel(relation.reason)}`,
    `当前${label}始于：${formatWorldDate(relation.startedMonth)}`,
    ...(relation.originalStartedMonth !== relation.startedMonth ? [`连续关系始于：${formatWorldDate(relation.originalStartedMonth)}`] : []),
    `有效至：${formatWorldDate(relation.expiresMonth)}`,
    ...(relation.renewalCount ? [`连续关系已续约${relation.renewalCount}次`] : []),
    ...(relation.lastRenewedMonth !== undefined ? [`最近续约：${formatWorldDate(relation.lastRenewedMonth)}`] : []),
  ];
}

/** Presentation of recorded months only; never computes or changes an expiry. */
export function formatDiplomacyRecordedNarrative(
  type: string, month: number, m: Record<string, string | number | undefined>,
  names: { factionAName: string; factionBName: string; commonThreatName?: string },
) {
  const pair = `${names.factionAName}、${names.factionBName}`;
  const threat = names.commonThreatName ?? "共同强敌";
  const start = typeof m.startedMonth === "number" ? m.startedMonth : month;
  const expiry = type === "relation-renewed" ? m.newExpiresMonth ?? m.expiresMonth : m.expiresMonth;
  const end = typeof expiry === "number" ? formatWorldDate(expiry) : undefined;
  const term = typeof expiry === "number" ? formatWorldDuration(expiry - start) : undefined;
  if (type === "relation-renewed") {
    const action = m.status === "ALLIANCE" ? "续盟" : m.status === "TRUCE" ? "续订停战" : "续订互不侵犯之约";
    const extension = typeof m.renewalDuration === "number" ? `，原约期再延${formatWorldDuration(m.renewalDuration)}` : "";
    return `${pair}${action}${extension}${end ? `，新的到期日为${end}` : ""}。`;
  }
  const period = `${term ? `，约期${term}` : ""}${end ? `，至${end}` : ""}。`;
  if (type === "truce-signed") {
    const captures = typeof m.recentBilateralCaptureCount === "number" ? `近期${m.recentBilateralCaptureCount}次城邑易手后` : "";
    return `${pair}${captures}议定停战${period}`;
  }
  if (type === "alliance-signed") {
    if (m.preconditionStatus === "NON_AGGRESSION") {
      const age = typeof m.preconditionDurationMonths === "number" ? formatWorldDuration(m.preconditionDurationMonths) : "";
      return `${threat}构成共同威胁，${pair}在互不侵犯${age}后将关系升级为战略同盟。新盟约自${formatWorldDate(start)}起${period}`;
    }
    return `${threat}构成共同威胁，${pair}结成战略同盟${period}`;
  }
  const upgrade = m.priorStatus === "TRUCE" ? "将停战关系升级为互不侵犯之约" : "订立互不侵犯之约";
  return `${threat}势明显强于${pair}，${pair}${upgrade}${period}`;
}

export function describeDiplomacySigning(
  relation: DiplomaticRelation, triggerContext: DiplomacyTriggerContext,
  names: { factionAName: string; factionBName: string; commonThreatName?: string },
) {
  const type = relation.status === "TRUCE" ? "truce-signed" : relation.status === "ALLIANCE" ? "alliance-signed" : "non-aggression-signed";
  return formatDiplomacyRecordedNarrative(type, relation.startedMonth, createDiplomacyEventMetadata(relation, triggerContext), names);
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
  return formatDiplomacyRecordedNarrative("relation-renewed", relation.lastRenewedMonth ?? relation.startedMonth, createDiplomacyEventMetadata(relation, context), names);
}
