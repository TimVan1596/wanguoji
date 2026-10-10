import type { WorldEvent } from "./WorldHistory";

export const MAJOR_EVENT_FILTERS = [
  { value: "all", label: "全部大事" }, { value: "founding", label: "建国" },
  { value: "emperor", label: "称帝" }, { value: "revolution", label: "易代" },
  { value: "restoration", label: "复国" }, { value: "extinction", label: "亡国" },
  { value: "submission", label: "纳降" }, { value: "merge", label: "合邦" }, { value: "era", label: "时代" },
] as const;
export type MajorEventFilter = typeof MAJOR_EVENT_FILTERS[number]["value"];
const TYPES: Record<Exclude<MajorEventFilter, "all">, readonly WorldEvent["type"][]> = {
  founding: ["state-founded"], emperor: ["emperor-proclaimed"], revolution: ["dynasty-usurped"],
  restoration: ["faction-restored", "dynasty-restored"], extinction: ["faction-exiled", "faction-extinct"],
  submission: ["faction-submitted"], merge: ["faction-merged"], era: ["world-era-started", "world-unification", "world-hegemony", "world-fractured"],
};
/** Presentation over existing narrative anchors, not a second significance rule. */
export function matchesMajorEventFilter(event: WorldEvent, filter: MajorEventFilter = "all") {
  return filter === "all" || TYPES[filter].includes(event.type);
}
export const DIPLOMACY_EVENT_TYPES: readonly WorldEvent["type"][] = [
  "truce-signed", "non-aggression-signed", "alliance-signed", "treaty-expired", "alliance-expired", "relation-renewed",
];

/** Era browsing has one dedicated atlas entry; legacy query filters remain supported. */
export const VISIBLE_MAJOR_EVENT_FILTERS = MAJOR_EVENT_FILTERS.filter(item => item.value !== "era");
export function normalizeVisibleMajorEventFilter(filter: MajorEventFilter): MajorEventFilter {
  return filter === "era" ? "all" : filter;
}
