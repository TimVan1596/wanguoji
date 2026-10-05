export interface FactionColorHistoryEntry { color: number; startMonth: number; endMonth?: number; reason: string }

export function getFactionColorAtMonth(faction: { color: number; colorHistory?: FactionColorHistoryEntry[] }, month: number) {
  const entries = faction.colorHistory ?? [];
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (entry.startMonth <= month && (entry.endMonth === undefined || entry.endMonth >= month)) return entry.color;
  }
  return entries[0]?.color ?? faction.color;
}

export function changeFactionColor(faction: { color: number; colorHistory: FactionColorHistoryEntry[] }, color: number, month: number) {
  const previous = faction.colorHistory.at(-1);
  if (previous) previous.endMonth = Math.max(previous.startMonth, month - 1);
  faction.colorHistory.push({ color, startMonth: month, reason: "USURPATION" });
  faction.color = color;
}
