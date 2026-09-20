import {
  getFactionDisplayNameAtMonth,
  getSovereigntyRankAtMonth,
  SovereigntyRank,
} from "../Simulation/FactionIdentity";

export type RulerPoliticalTitle = "首领" | "王" | "帝";

export interface FactionTitleState {
  name: string;
  displayName?: string;
  identityStage?: string;
  stateFoundedMonth?: number;
  sovereigntyRank?: SovereigntyRank;
  sovereigntyHistory?: Array<{
    rank: SovereigntyRank;
    startMonth: number;
    endMonth?: number;
  }>;
  nameHistory?: Array<{
    name: string;
    startMonth: number;
    endMonth?: number;
    reason?: string;
  }>;
}

export function getRulerTitleAtMonth(
  faction: FactionTitleState,
  monthIndex: number
): RulerPoliticalTitle {
  const rank = getSovereigntyRankAtMonth(
    {
      identityStage: faction.identityStage === "STATE" ? "STATE" : "PROVISIONAL",
      stateFoundedMonth: faction.stateFoundedMonth,
      sovereigntyRank:
        faction.sovereigntyRank ??
        (faction.identityStage === "STATE" ? "KING" : "LEADER"),
      sovereigntyHistory: faction.sovereigntyHistory ?? [
        {
          rank: faction.identityStage === "STATE" ? "KING" : "LEADER",
          startMonth: faction.identityStage === "STATE" ? faction.stateFoundedMonth ?? 0 : 0,
        },
      ],
    },
    monthIndex
  );
  if (rank === "EMPEROR") {
    return "帝";
  }
  if (rank === "KING") {
    return "王";
  }
  return "首领";
}

export function formatRulerTitleAtMonth(
  faction: FactionTitleState,
  rulerName: string,
  monthIndex: number
) {
  const factionName = getFactionDisplayNameAtMonth(
    {
      name: faction.name,
      displayName: faction.displayName ?? faction.name,
      nameHistory: (
        faction.nameHistory ?? [
          {
            name: faction.displayName ?? faction.name,
            startMonth: 0,
            reason: "fallback",
          },
        ]
      ).map((entry) => ({
        ...entry,
        reason: entry.reason ?? "historical",
      })),
    },
    monthIndex
  );
  return `${factionName}${getRulerTitleAtMonth(faction, monthIndex)}${rulerName}`;
}

export function getSuccessionVerbForTitle(title: RulerPoliticalTitle) {
  if (title === "帝") {
    return "即位";
  }
  return title === "王" ? "继位" : "继任";
}

export function getNaturalDeathVerbForTitle(title: RulerPoliticalTitle) {
  if (title === "帝") {
    return "崩";
  }
  return title === "王" ? "薨" : "去世";
}
