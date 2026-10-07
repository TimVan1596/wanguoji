import { describe, expect, it } from "vitest";
import { areHistoryEventListInputsEqual } from "./historyEventListMemo";

describe("memoized history event list boundary", () => {
  it("keeps the event-card subtree stable when only the live world month changes", () => {
    const events = [{ id: "event" }];
    const teamByName = new Map();
    const rulerById = new Map();
    const factionColorById = new Map();
    const cityNames: string[] = [];
    const callback = () => undefined;
    const props = {
      events, hasMore: false, expandedId: undefined,
      teamByName, rulerById, factionColorById, cityNames,
      onToggleExpanded: callback, onLoadMore: callback, sxHeight: "100%",
    };
    expect(areHistoryEventListInputsEqual(props, { ...props })).toBe(true);
    expect(areHistoryEventListInputsEqual(props, { ...props, events: [...events] })).toBe(false);
    expect(areHistoryEventListInputsEqual(props, { ...props, unseenCount: 2 })).toBe(false);
    expect(areHistoryEventListInputsEqual(props, { ...props, onBackToLatest: () => {} })).toBe(false);
  });
});
