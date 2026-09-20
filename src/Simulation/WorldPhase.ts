export type WorldPhase =
  | "FRAGMENTED"
  | "CONTESTED"
  | "DUAL"
  | "UNIFIED"
  | "IMPERIAL_FRACTURE";

export function getWorldPhase(activeFactionCount: number, fractureUntilMonth = -1, worldMonth = 0): WorldPhase {
  if (worldMonth <= fractureUntilMonth) {
    return "IMPERIAL_FRACTURE";
  }
  if (activeFactionCount <= 1) {
    return "UNIFIED";
  }
  if (activeFactionCount === 2) {
    return "DUAL";
  }
  if (activeFactionCount <= 4) {
    return "CONTESTED";
  }
  return "FRAGMENTED";
}

export function formatWorldPhase(phase: WorldPhase) {
  if (phase === "FRAGMENTED") {
    return "群雄割据";
  }
  if (phase === "CONTESTED") {
    return "多国争霸";
  }
  if (phase === "DUAL") {
    return "双雄对峙";
  }
  if (phase === "UNIFIED") {
    return "天下一统";
  }
  return "帝国分裂";
}
