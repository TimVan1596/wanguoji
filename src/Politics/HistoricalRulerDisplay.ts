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
  if (ruler.endYear === undefined) return personal;
  const epithetSuffix = options.historicalRank === "EMPEROR" ? "帝" : "王";
  if (mode === "full") {
    return [ruler.templeName && `${factionName}${ruler.templeName}`, ruler.posthumousEpithet && `${ruler.posthumousEpithet}${epithetSuffix}`, personal].filter(Boolean).join(" · ");
  }
  return ruler.templeName ? `${factionName}${ruler.templeName}${personal}` : ruler.posthumousEpithet ? `${factionName}${ruler.posthumousEpithet}${epithetSuffix}${personal}` : personal;
}
