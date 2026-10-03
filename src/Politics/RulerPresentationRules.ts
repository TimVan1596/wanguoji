import type { Ruler } from "./Dynasty";

export function isFormalRulerRecord(
  ruler: Ruler
): ruler is Ruler & {
  accessionYear: number;
  chronicle: NonNullable<Ruler["chronicle"]>;
  reignOrdinal: number;
} {
  return ruler.reignOrdinal !== undefined && ruler.accessionYear !== undefined && ruler.chronicle !== undefined;
}

export function getFormalRulers(rulers: Ruler[]) {
  return rulers.filter(isFormalRulerRecord);
}

export function getLivingHeirs(rulers: Ruler[]) {
  return rulers.filter((ruler) => ruler.status === "heir" && ruler.reignOrdinal === undefined);
}

export function formatHeirDeathText(
  heirName: string,
  reason: "natural" | "combat" | "captured",
  parentTitle: string
) {
  const cause = reason === "combat" ? "战死" : reason === "captured" ? "被俘处死" : "去世";
  return `储君${heirName}${cause}，先于${parentTitle}而卒。`;
}
