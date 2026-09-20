import {
  getFactionDisplayNameAtMonth,
  getSovereigntyRankAtMonth,
  type FactionIdentityState,
} from "./FactionIdentity";

export function getRegimeStyleNameAtMonth(
  faction: Pick<
    FactionIdentityState,
    | "displayName"
    | "name"
    | "nameHistory"
    | "identityStage"
    | "stateFoundedMonth"
    | "sovereigntyRank"
    | "sovereigntyHistory"
  >,
  monthIndex: number
) {
  const name = getFactionDisplayNameAtMonth(faction, monthIndex);
  const rank = getSovereigntyRankAtMonth(faction, monthIndex);
  if (rank === "EMPEROR") {
    return `${name}朝`;
  }
  if (rank === "KING") {
    return `${name}国`;
  }
  return name;
}
