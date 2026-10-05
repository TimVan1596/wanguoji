import type { WorldEvent } from "./WorldHistory";
import { formatWorldDuration } from "../Simulation/WorldTime";
import type { HistoryFactionLike } from "./HistoryRenderRules";
import { getHistoricalFactionIdentity } from "./HistoricalFactionIdentity";

export function formatRulerDiplomacyEvent(
  event: WorldEvent,
  factionById: Map<string, HistoryFactionLike>,
) {
  if (event.type !== "truce-signed" && event.type !== "non-aggression-signed" && event.type !== "alliance-signed") return undefined;
  const metadata = event.metadata ?? {};
  const month = event.monthIndex ?? event.year;
  const name = (id: string) => {
    const faction = factionById.get(id);
    return faction ? getHistoricalFactionIdentity(faction, month).name : id;
  };
  const names = (event.factionIds ?? []).slice(0, 2).map(name);
  if (names.length !== 2) return event.title;
  const duration = typeof metadata.expiresMonth === "number"
    ? formatWorldDuration(metadata.expiresMonth - (event.monthIndex ?? event.year))
    : undefined;
  if (event.type === "truce-signed") {
    const captures = typeof metadata.recentBilateralCaptureCount === "number" ? metadata.recentBilateralCaptureCount : undefined;
    const evidence = captures === undefined ? "议定停战" : `近期${captures}次城邑易手后议定停战`;
    return `${names.join("、")}${evidence}${duration ? `，约期${duration}` : ""}。`;
  }
  const threatId = metadata.commonThreatFactionId;
  const threatName = typeof threatId === "string" ? name(threatId) : "共同强敌";
  if (event.type === "alliance-signed") {
    const priorDuration = typeof metadata.preconditionDurationMonths === "number"
      ? formatWorldDuration(metadata.preconditionDurationMonths)
      : undefined;
    return `${threatName}势日强，${names.join("、")}${priorDuration ? `在互不侵犯${priorDuration}后` : "因共同压力"}结成战略同盟${duration ? `，约期${duration}` : ""}。`;
  }
  return `${threatName}势日强，${names.join("、")}因共同压力订立互不侵犯之约${duration ? `，约期${duration}` : ""}。`;
}
