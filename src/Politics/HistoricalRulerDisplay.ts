import type { Ruler } from "./Dynasty";
import type { SovereigntyRank } from "../Simulation/FactionIdentity";

export interface HistoricalRulerDisplayOptions {
  historicalRank?: SovereigntyRank;
}

export function resolveHistoricalRulerDisplay(
  ruler: Pick<Ruler, "houseName" | "givenName" | "endYear" | "posthumousEpithet" | "templeName">,
  factionName: string,
  mode: "compact" | "full" = "compact",
  options: HistoricalRulerDisplayOptions = {}
) {
  const personal = `${ruler.houseName.replace(/氏$/, "")}${ruler.givenName}`;
  const rankTitle = getLivingRankTitle(options.historicalRank);
  const currentIdentity = rankTitle ? `${factionName}${rankTitle}${personal}` : personal;
  if (ruler.endYear === undefined) return currentIdentity;
  const epithetSuffix = options.historicalRank === "EMPEROR" ? "帝" : "王";
  if (mode === "full") {
    if (!ruler.templeName && !ruler.posthumousEpithet) return currentIdentity;
    return [ruler.templeName && `${factionName}${ruler.templeName}`, ruler.posthumousEpithet && `${ruler.posthumousEpithet}${epithetSuffix}`, personal].filter(Boolean).join(" · ");
  }
  return ruler.templeName ? `${factionName}${ruler.templeName}${personal}` : ruler.posthumousEpithet ? `${factionName}${ruler.posthumousEpithet}${epithetSuffix}${personal}` : currentIdentity;
}

function getLivingRankTitle(rank?: SovereigntyRank) {
  if (rank === "LEADER") return "首领";
  if (rank === "KING") return "王";
  if (rank === "EMPEROR") return "帝";
  return undefined;
}
