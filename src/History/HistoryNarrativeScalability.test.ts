import { expect, it, vi } from "vitest";
import { groupHistoryNarratives } from "./HistoryNarrativeGrouper";
import type { WorldEvent } from "./WorldHistory";

it("narrative grouping has only a constant number of full-history scans", () => {
  const events: WorldEvent[] = Array.from({ length: 5000 }, (_, month) => ({ id: `${month}`, year: month,
    type: month % 20 === 0 ? "faction-extinct" : "city-founded", category: "politics", title: "历史", targetFactionId: "A", importance: "normal" }));
  const methods = Array.prototype as unknown as { filter: (predicate: (value: WorldEvent) => boolean) => WorldEvent[] };
  const filter = vi.spyOn(methods, "filter");
  groupHistoryNarratives(events);
  const fullScans = filter.mock.instances.filter(array => (array as WorldEvent[]).length === 5000).length;
  filter.mockRestore();
  console.info({ events: events.length, fullScans });
  expect(fullScans).toBe(4);
});
