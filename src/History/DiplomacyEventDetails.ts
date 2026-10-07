import type { WorldEvent } from "./WorldHistory";
import type { HistoryFactionLike } from "./HistoryRenderRules";
import { getHistoricalFactionIdentity } from "./HistoricalFactionIdentity";
import { diplomacyStatusLabel } from "../Politics/DiplomacyPresentation";
import { formatWorldDate, formatWorldDuration } from "../Simulation/WorldTime";

/** Read recorded metadata only; missing flags are unknown, never inferred. */
export function getDiplomacyEventDetails(event: WorldEvent, factions: Map<string, HistoryFactionLike>): string[] {
  if (!["truce-signed", "non-aggression-signed", "alliance-signed", "relation-renewed"].includes(event.type) || !event.metadata) return [];
  const m = event.metadata, month = event.monthIndex ?? event.year, lines: string[] = [];
  const name = (id: unknown, fallback: string) => typeof id === "string"
    ? factions.has(id) ? getHistoricalFactionIdentity(factions.get(id)!, month).name : id : fallback;
  const a = name(event.factionIds?.[0], "A方"), b = name(event.factionIds?.[1], "B方");
  const threat = name(m.commonThreatFactionId, "共同强敌");
  const renewed = event.type === "relation-renewed", moment = renewed ? "续约时" : "签约时";
  const signers = [[m.signatoryARole, m.signatoryATitle], [m.signatoryBRole, m.signatoryBTitle]]
    .filter((v): v is [string,string] => typeof v[0] === "string" && typeof v[1] === "string");
  if (signers.length) lines.push(`${moment}${[...new Set(signers.map(v=>v[0]))].join("/")}：${signers.map(v=>v[1]).join("、")}`);
  if (typeof m.threatCredibility === "string") lines.push(`威胁可信度：${m.threatCredibility}`);
  const flag = (value: unknown) => value === 1 ? true : value === 0 ? false : undefined;
  if (m.reason === "COMMON_THREAT_NON_AGGRESSION" || m.reason === "COMMON_THREAT_ALLIANCE") {
    lines.push(`共同强敌：${threat}`);
    const exposure = (label: string, value: unknown) => { const direct = flag(value); if(direct !== undefined) lines.push(`共同强敌接触 · ${label}：${direct ? "直接战略接触" : "无直接接触"}`); };
    exposure(`A方（${a}）`,m.directContactA); exposure(`B方（${b}）`,m.directContactB);
    if(flag(m.adjacentPair)) lines.push(`共同压力证据：${a}与${b}彼此接壤`);
    // These booleans record actual city capture, not just an attempted siege.
    if(flag(m.threatCapturedA)) lines.push(`共同压力证据：${threat}近期攻陷${a}城邑`);
    if(flag(m.threatCapturedB)) lines.push(`共同压力证据：${threat}近期攻陷${b}城邑`);
    if(flag(m.capitalFall)) lines.push(`共同压力证据：${threat}近期攻陷双方之一的首都`);
    for (const [key,label] of [["territoryShareA",`${a}${moment}领土占比`],["territoryShareB",`${b}${moment}领土占比`],["threatTerritoryShare","共同强敌领土占比"]] as const)
      if(typeof m[key] === "number") lines.push(`${label}：${(m[key] as number).toFixed(1)}%`);
    if(typeof m.preconditionStatus === "string") lines.push(`前置关系：${m.preconditionStatus}`);
    if(typeof m.preconditionDurationMonths === "number") lines.push(`前置关系持续月数：${m.preconditionDurationMonths}`);
  } else if (m.reason === "WAR_EXHAUSTION_TRUCE") {
    if(typeof m.recentBilateralCaptureCount === "number") lines.push(`近三年双边城邑易手：${m.recentBilateralCaptureCount}`);
    if(typeof m.stabilityA === "number") lines.push(`${a}${moment}稳定度：${m.stabilityA}`);
    if(typeof m.stabilityB === "number") lines.push(`${b}${moment}稳定度：${m.stabilityB}`);
  }
  const status = m.status === "ALLIANCE" || m.status === "TRUCE" || m.status === "NON_AGGRESSION" ? m.status : undefined;
  const label = status ? diplomacyStatusLabel(status) : "关系";
  if (renewed) {
    if (status) lines.push(`关系类型：${label}`);
    if(typeof m.originalStartedMonth === "number") {
      lines.push(`连续关系始于：${formatWorldDate(m.originalStartedMonth)}`);
      if(m.originalStartedMonth <= month) lines.push(`连续外交关系已维持：${formatWorldDuration(month - m.originalStartedMonth)}`);
    }
    if(typeof m.startedMonth === "number") lines.push(`当前${label}始于：${formatWorldDate(m.startedMonth)}`);
    if(typeof m.previousExpiresMonth === "number") lines.push(`原到期日：${formatWorldDate(m.previousExpiresMonth)}`);
    if(typeof m.renewalDuration === "number") lines.push(`本次再延：${formatWorldDuration(m.renewalDuration)}（${m.renewalDuration}个月）`);
    if(typeof m.newExpiresMonth === "number") lines.push(`新到期日：${formatWorldDate(m.newExpiresMonth)}`);
    if(typeof m.renewalCount === "number") lines.push(`连续关系已续约${m.renewalCount}次`);
    if(typeof m.lastRenewedMonth === "number") lines.push(`最近续约：${formatWorldDate(m.lastRenewedMonth)}`);
  } else {
    const prior = m.preconditionStatus ?? m.priorStatus;
    if (prior === "NON_AGGRESSION" || prior === "TRUCE") {
      lines.push(`关系升级：${diplomacyStatusLabel(prior)} → ${label}`);
      if(typeof m.preconditionStartedMonth === "number") lines.push(`原关系开始：${formatWorldDate(m.preconditionStartedMonth)}`);
    }
    if(typeof m.startedMonth === "number") lines.push(`当前${label}开始：${formatWorldDate(m.startedMonth)}`);
    if(typeof m.expiresMonth === "number") lines.push(`当前${label}到期：${formatWorldDate(m.expiresMonth)}`);
    if(typeof m.originalStartedMonth === "number") lines.push(`连续外交关系始于：${formatWorldDate(m.originalStartedMonth)}`);
  }
  return lines;
}
