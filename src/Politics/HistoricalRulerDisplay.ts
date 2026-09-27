import type { Ruler } from "./Dynasty";

export function resolveHistoricalRulerDisplay(
  ruler: Pick<Ruler, "houseName" | "givenName" | "endYear" | "posthumousEpithet" | "templeName">,
  factionName: string,
  mode: "compact" | "full" = "compact"
) {
  const personal = `${ruler.houseName.replace(/氏$/, "")}${ruler.givenName}`;
  if (ruler.endYear === undefined) return personal;
  if (mode === "full") {
    return [ruler.templeName && `${factionName}${ruler.templeName}`, ruler.posthumousEpithet && `${ruler.posthumousEpithet}王`, personal].filter(Boolean).join(" · ");
  }
  return ruler.templeName ? `${factionName}${ruler.templeName}${personal}` : ruler.posthumousEpithet ? `${factionName}${ruler.posthumousEpithet}王${personal}` : personal;
}
