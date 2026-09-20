export function shouldApplySiegeDamage(
  year: number,
  lastSiegeDamageYear: number,
  intervalYears: number
) {
  return lastSiegeDamageYear < 0 || year - lastSiegeDamageYear >= intervalYears;
}

export function areFortifiedCellsOwnedBy(
  cells: { ownerFactionId?: string }[],
  ownerFactionId: string
) {
  return cells.every((cell) => cell.ownerFactionId === ownerFactionId);
}
