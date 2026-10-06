import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Structural lifecycle checks supplement the store tests, not a visual/headless Gate.
describe("runtime history subscription wiring", () => {
  it("uses lightweight subscriptions and returns unsubscribe from effects", () => {
    const scroll = readFileSync(new URL("./index.tsx", import.meta.url), "utf8");
    const faction = readFileSync(new URL("../FactionDetails/index.tsx", import.meta.url), "utf8");
    const banner = readFileSync(new URL("../ChapterBanner/index.tsx", import.meta.url), "utf8");
    for (const source of [scroll, faction, banner]) expect(source).not.toContain("WorldHistory.subscribe(");
    expect(scroll).toContain("useEffect(() => WorldHistory.subscribeRevision(setHistoryRevision), [])");
    expect(scroll).toContain("queryHistoryPage(WorldHistory");
    expect(scroll).toContain("worldRecordsOpen ? deriveWorldRecords");
    expect(banner).toContain("WorldHistory.subscribeAppends");
    expect(banner).not.toContain("seenIds");
    const tabs = readFileSync(new URL("../RightSlider/index.tsx", import.meta.url), "utf8");
    expect(tabs).toContain('rightPanelTab === "history" ? <HistoryScroll>');
  });
});
