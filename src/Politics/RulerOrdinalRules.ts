export interface RulerOrdinalLike {
  reignOrdinal?: number;
}

export function getNextRulerReignOrdinal(rulers: RulerOrdinalLike[]) {
  return Math.max(0, ...rulers.map((ruler) => ruler.reignOrdinal ?? 0)) + 1;
}
