/** Deterministic pressure. Repeated collision callbacks never enter this formula. */
export function siegePressure(attackers: number, defenders: number, maxDefense: number) {
  if (attackers < 2) return 0;
  const resistance = defenders + Math.max(1, maxDefense / 4);
  return Math.min(2, Math.max(0, (attackers - resistance) / Math.max(2, resistance)));
}
