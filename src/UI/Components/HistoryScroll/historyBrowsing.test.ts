import { describe, expect, it } from "vitest";
import { HistoryBrowsingSession } from "./historyBrowsing";
import { WorldHistoryStore, type WorldEvent } from "../../../History/WorldHistory";
const event = (month: number): WorldEvent => ({ id: `e-${month}`, year: month, type: "dynasty-usurped", title: "易代", category: "politics", importance: "major", factionIds: ["A"] });
const options = { filter: "featured" as const, eventTypeFilter: "revolution" as const };
describe("UI-only history follow/unseen lifecycle", () => {
  it("follows near the top and freezes page revision while reading away", () => {
    const store = new WorldHistoryStore(), session = new HistoryBrowsingSession(); let pageRevision = store.getRevision();
    const off = store.subscribeAppends(change => {
      session.append(change.events, options);
      if (session.followingLatest) pageRevision = change.revision;
    });
    session.scroll(20); store.addEvent(event(1)); expect(pageRevision).toBe(store.getRevision()); expect(session.unseenCount).toBe(0);
    session.scroll(400); const frozen = pageRevision;
    store.addEvent(event(2)); store.addEvent(event(3));
    expect(pageRevision).toBe(frozen); expect(session.unseenCount).toBe(2); expect(session.followingLatest).toBe(false);
    session.reset(); pageRevision = store.getRevision(); // return-to-latest action
    expect(pageRevision).toBe(store.getRevision()); expect(session.unseenCount).toBe(0); expect(session.followingLatest).toBe(true);
    off(); expect(store.getRuntimeCardinality().historyListeners).toBe(0);
  });
  it("counts matching appends only and clears unseen when scrolling back or resetting any filter", () => {
    const session = new HistoryBrowsingSession(); session.scroll(100);
    session.append([event(3), { ...event(4), factionIds: ["B"] }, { ...event(5), type: "city-founded" }], { ...options, factionId: "A", endMonth: 4 });
    expect(session.unseenCount).toBe(1);
    session.scroll(0); expect(session.unseenCount).toBe(0);
    for (let filterIndex = 0; filterIndex < 4; filterIndex++) {
      session.scroll(100); session.append([event(5)], options); expect(session.unseenCount).toBe(1);
      session.reset(); expect(session.unseenCount).toBe(0); expect(session.followingLatest).toBe(true);
    }
  });
});
