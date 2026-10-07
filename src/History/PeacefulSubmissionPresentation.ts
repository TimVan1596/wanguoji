import type { WorldEvent } from "./WorldHistory";
import type { HistoryFactionLike } from "./HistoryRenderRules";
import { getHistoricalFactionIdentity } from "./HistoricalFactionIdentity";
import { diplomacyStatusLabel } from "../Politics/DiplomacyPresentation";
import { formatWorldDate, formatWorldDuration } from "../Simulation/WorldTime";

export function getSubmissionEventPresentation(event:WorldEvent,factions:Map<string,HistoryFactionLike>) {
  if(event.type !== "faction-submitted")return undefined;
  const m=event.metadata??{},month=event.monthIndex??event.year;
  const name=(value:unknown)=>typeof value === "string"?factions.has(value)?getHistoricalFactionIdentity(factions.get(value)!,month).name:value:"—";
  const submitted=name(m.submittedFactionId??event.actorFactionId),receiving=name(m.receivingFactionId??event.targetFactionId);
  const lines=[`归附时间：${formatWorldDate(month)}`,`${submitted}结束独立建制，城市、疆域和人口行政归入${receiving}。`];
  if(m.relationStatus === "ALLIANCE"||m.relationStatus === "NON_AGGRESSION")lines.push(`此前关系：${diplomacyStatusLabel(m.relationStatus)}`);
  if(typeof m.continuousRelationMonths === "number")lines.push(`连续外交关系：${formatWorldDuration(m.continuousRelationMonths)}`);
  if(typeof m.renewalCount === "number")lines.push(`连续关系已续约${m.renewalCount}次`);
  if(typeof m.bilateralWarFreeMonths === "number")lines.push(`已核验双边无城邑攻陷：至少${formatWorldDuration(m.bilateralWarFreeMonths)}`);
  for(const [key,label] of [["submittedTerritoryShare",`${submitted}当时领土占比`],["receivingTerritoryShare",`${receiving}当时领土占比`]] as const)if(typeof m[key] === "number")lines.push(`${label}：${(m[key] as number).toFixed(1)}%`);
  for(const [key,label] of [["submittedCityCount",`${submitted}当时城市数`],["receivingCityCount",`${receiving}当时城市数`],["submittedStability",`${submitted}当时稳定度`]] as const)if(typeof m[key] === "number")lines.push(`${label}：${m[key]}`);
  if(typeof m.submittedRulerName === "string")lines.push(`末代君主：${m.submittedRulerName} · 纳土退位${typeof m.submittedRulerId === "string"?`（${m.submittedRulerId}）`:""}`);
  if(typeof m.receivingRulerName === "string")lines.push(`接受国君主：${m.receivingRulerName}${typeof m.receivingRulerId === "string"?`（${m.receivingRulerId}）`:""}`);
  if(typeof m.commonThreatFactionId === "string"&&(m.threatCredibility === "CREDIBLE"||m.threatCredibility === "SEVERE"))lines.push(`共同强敌：${name(m.commonThreatFactionId)} · ${m.threatCredibility}`);
  return {title:`${submitted}纳土归附${receiving}`,receivingChronicle:`${submitted}纳土来归`,lines};
}
