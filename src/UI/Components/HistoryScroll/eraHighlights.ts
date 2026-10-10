import type { WorldEvent, WorldHistoryStore } from "../../../History/WorldHistory";
import type { WorldEra } from "../../../Simulation/WorldEra";
import { groupHistoryNarratives } from "../../../History/HistoryNarrativeGrouper";
import { getEraChronicleEnd } from "./eraChronicleQuery";

export const ERA_HIGHLIGHT_LIMIT = 10;
type EraRange = Pick<WorldEra, "id" | "startMonth" | "endMonth">;
const monthOf = (event: WorldEvent) => event.monthIndex ?? event.year;
/** Local editorial weights only. Neither global significance nor canonical importance changes. */
function weight(event: WorldEvent): { score: number; category: string } | undefined {
  switch (event.type) {
    case "world-unification": case "world-hegemony": case "world-fractured": case "world-era-started": case "empire-split":
      return { score: 100, category: "world" };
    case "emperor-proclaimed": return { score: 100, category: "emperor" };
    case "dynasty-usurped": return { score: 100, category: "revolution" };
    case "state-founded": return { score: 80, category: "founding" };
    case "faction-extinct": case "faction-exiled": return { score: 85, category: "collapse" };
    case "faction-restored": case "dynasty-restored": return { score: 85, category: "restoration" };
    case "faction-merged": case "faction-submitted": return { score: 85, category: "terminal" };
    case "capital-fallen": case "capital-relocated": return { score: 65, category: "capital" };
    case "city-captured":
      // Ordinary conquests are excluded regardless of title or importance.
      if (event.metadata?.wasCapital === 1)
        return { score: 65, category: "capital" };
      return undefined;
    case "territory-milestone":
      return event.importance === "major" ? { score: 60, category: "territory" } : undefined;
    default: return undefined;
  }
}
interface Candidate { event: WorldEvent; score: number; category: string; phase: number }
function compare(a: Candidate, b: Candidate) {
  return b.score - a.score || monthOf(b.event) - monthOf(a.event) || (a.event.id < b.event.id ? -1 : a.event.id > b.event.id ? 1 : 0);
}
/** Retain at most ten candidates per category/stage, even for very long eras. */
function retain(buckets: Map<string, Candidate[]>, events: readonly WorldEvent[], era: EraRange, end: number) {
  for (const event of events) {
    const month = monthOf(event), facts = weight(event);
    if (!facts || month < era.startMonth || month > end) continue;
    const phase = Math.min(2, Math.floor(3 * (month - era.startMonth) / Math.max(1, end - era.startMonth + 1)));
    const key = `${facts.category}:${phase}`, list = buckets.get(key) ?? [];
    if (list.some(candidate => candidate.event.id === event.id)) continue;
    list.push({ event, ...facts, phase }); list.sort(compare);
    if (list.length > ERA_HIGHLIGHT_LIMIT) list.length = ERA_HIGHLIGHT_LIMIT;
    buckets.set(key, list);
  }
}
function choose(buckets: Map<string, Candidate[]>) {
  const remaining = [...buckets.values()].flat(), selected: Candidate[] = [];
  const categories = new Set<string>(), phases = new Set<number>();
  while (remaining.length && selected.length < ERA_HIGHLIGHT_LIMIT) {
    // Modest diversity bonuses break repetitive runs without displacing landmarks by routine wars.
    const rank = (c: Candidate) => c.score + (categories.has(c.category) ? 0 : 18) + (phases.has(c.phase) ? 0 : 12);
    remaining.sort((a, b) => rank(b) - rank(a) || compare(a, b));
    const chosen = remaining.shift()!; selected.push(chosen);
    categories.add(chosen.category); phases.add(chosen.phase);
  }
  return selected.map(c => c.event).sort((a, b) => monthOf(b) - monthOf(a) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
/** Input is the existing narrative grouping, not another event database. */
export function selectEraHighlights(era: EraRange, groupedEvents: readonly WorldEvent[], worldMonth: number): WorldEvent[] {
  const buckets = new Map<string, Candidate[]>();
  retain(buckets, groupedEvents, era, getEraChronicleEnd(era, worldMonth));
  return choose(buckets);
}
const cache = new WeakMap<WorldHistoryStore, { revision: number; entries: Map<string, WorldEvent[]> }>();
/** Traverse the entire indexed era range in complete-month/group windows. Never query the whole archive. */
export function queryEraHighlights(store: WorldHistoryStore, era: EraRange, worldMonth: number): WorldEvent[] {
  const revision = store.getRevision(), end = getEraChronicleEnd(era, worldMonth);
  let state = cache.get(store);
  if (!state || state.revision !== revision) { state = { revision, entries: new Map() }; cache.set(store, state); }
  const key = JSON.stringify([era.id, era.startMonth, end]);
  const cached = state.entries.get(key);
  if (cached) return cached;
  const buckets = new Map<string, Candidate[]>();
  let before = end;
  while (before >= era.startMonth) {
    const window = store.getEventWindow({ startMonth: era.startMonth, endMonth: before, limit: 200 });
    retain(buckets, groupHistoryNarratives(window.events), era, end);
    if (!window.hasOlder || !window.events.length) break;
    before = monthOf(window.events[window.events.length - 1]) - 1;
  }
  const result = choose(buckets);
  // At most eight bounded selections; hydration/reset revision invalidates them all.
  if (state.entries.size >= 8) state.entries.delete(state.entries.keys().next().value!);
  state.entries.set(key, result);
  return result;
}
export function isAfterEraSnapshot(event: WorldEvent, capturedMonth?: number) {
  return capturedMonth !== undefined && monthOf(event) > capturedMonth;
}
