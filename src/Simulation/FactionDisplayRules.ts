import { getRegimeStyleNameAtMonth } from "./RegimeStyle";

export interface FactionDisplayTeamLike {
  displayName?: string;
  nameHistory?: { name: string; startMonth: number; endMonth?: number }[];
  identityStage?: string;
  sovereigntyRank?: string;
  factionType?: string;
}

export function getFactionListDisplayName(
  team: FactionDisplayTeamLike,
  month: number
) {
  if (team.identityStage === "STATE") {
    if (!team.nameHistory) {
      return `${team.displayName ?? "未知势力"}${
        team.sovereigntyRank === "EMPEROR" ? "朝" : "国"
      }`;
    }
    return getRegimeStyleNameAtMonth(team as never, month);
  }
  return team.displayName ?? "未知势力";
}

export function getFactionRegimeBadge(team: FactionDisplayTeamLike) {
  if (team.identityStage === "STATE") {
    return team.sovereigntyRank === "EMPEROR" ? "帝国" : "王国";
  }
  if (team.factionType === "FRONTIER") {
    return "边境军";
  }
  return "临时政权";
}

export function getFactionRegimeWeight(team: FactionDisplayTeamLike) {
  if (team.identityStage !== "STATE") {
    return 0;
  }
  return team.sovereigntyRank === "EMPEROR" ? 2 : 1;
}

export function buildFactionRankingIdentity(
  team: FactionDisplayTeamLike,
  month: number,
  rulerTitle?: string
) {
  return {
    displayName: getFactionListDisplayName(team, month),
    badge: compactRegimeBadge(getFactionRegimeBadge(team)),
    rulerTitle: rulerTitle ?? "",
    prestigeWeight: getFactionRegimeWeight(team),
  };
}

function compactRegimeBadge(label: string) {
  return label === "临时政权" ? "临时" : label;
}
