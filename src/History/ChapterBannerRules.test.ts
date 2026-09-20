import { describe, expect, it } from "vitest";
import {
  createChapterBannerForEvent,
  enqueueChapterBanner,
} from "./ChapterBannerRules";
import type { WorldEvent } from "./WorldHistory";

function event(overrides: Partial<WorldEvent>): WorldEvent {
  return {
    id: overrides.id ?? "event-1",
    year: overrides.year ?? 0,
    category: overrides.category ?? "politics",
    type: overrides.type ?? "ruler-succession",
    title: overrides.title ?? "普通继承",
    importance: overrides.importance ?? "major",
    metadata: overrides.metadata,
  };
}

describe("chapter banner rules", () => {
  it("creates banners only for allowed landmark events", () => {
    expect(
      createChapterBannerForEvent(
        event({
          type: "emperor-proclaimed",
          title: "阳国威震天下，阳王赵子宣称帝。",
          metadata: { displayName: "阳", rulerName: "赵子宣" },
        })
      )?.text
    ).toBe("阳王赵子宣称帝，阳朝建立");
    expect(
      createChapterBannerForEvent(
        event({
          type: "world-era-started",
          metadata: { eraName: "阳朝", eraType: "DYNASTIC" },
        })
      )?.text
    ).toBe("阳朝时代确立");
    expect(createChapterBannerForEvent(event({ type: "ruler-succession" }))).toBeUndefined();
  });

  it("dedupes and bounds the banner queue", () => {
    const items = Array.from({ length: 7 }, (_, index) => ({
      id: `banner-${index}`,
      text: `事件${index}`,
      priority: index,
    }));
    const queued = items.reduce(
      (queue, item) => enqueueChapterBanner(undefined, queue, item, 5),
      [] as typeof items
    );
    expect(queued).toHaveLength(5);
    expect(queued[0].id).toBe("banner-6");
    expect(enqueueChapterBanner(undefined, queued, queued[0], 5)).toBe(queued);
  });
});
