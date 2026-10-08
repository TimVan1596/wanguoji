import type { WorldEvent } from "./WorldHistory";
import type { HistoryFactionLike } from "./HistoryRenderRules";
import { getHistoricalFactionIdentity } from "./HistoricalFactionIdentity";
import { formatWorldDate } from "../Simulation/WorldTime";

// Old V12 titles are intentionally ignored: direction comes from canonical IDs.
export function getMergedEventPresentation(event: WorldEvent, factions: Map<string, HistoryFactionLike>) {
  if (event.type !== "faction-merged") return undefined;
  const m = event.metadata ?? {}, month = event.monthIndex ?? event.year;
  const sourceId = typeof m.absorbedFactionId === "string" ? m.absorbedFactionId : undefined;
  const targetId = typeof m.absorbingFactionId === "string" ? m.absorbingFactionId
    : typeof m.terminationTargetFactionId === "string" ? m.terminationTargetFactionId : undefined;
  const name = (id?: string) => id ? factions.has(id) ? getHistoricalFactionIdentity(factions.get(id)!, month).name : id : "未记录势力";
  const sourceName = name(sourceId), targetName = name(targetId);
  return { sourceId, targetId, sourceName, targetName,
    title: `${sourceName}并入${targetName}（同源合邦）`,
    description: `${sourceName}结束独立建制，其城市、疆域和人口行政并入${targetName}。`,
    lines: [`同源合邦时间：${formatWorldDate(month)}`, `被吸收方：${sourceName}`, `吸收方：${targetName}`] };
}
