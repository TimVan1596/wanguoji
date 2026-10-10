import { describe, expect, it } from "vitest";
import { fitAtlasViewport, revealAtlasAxisItem } from "./atlasViewport";
import { getAtlasOpeningEra, eraSelectionUIReducer, initialEraSelectionUIState } from "./eraSelection";
import { readFileSync } from "node:fs";

describe("contained atlas viewport (geometry, not visual approval)", () => {
  it.each([[1638, 895], [1366, 768], [1280, 720]])("fully contains square and rectangular worlds at %sx%s", (w, h) => {
    const availableWidth = w * .96 - 220 - 36, availableHeight = h * .92 - 130;
    for (const [width, height] of [[50, 50], [80, 40], [40, 80]]) {
      const fit = fitAtlasViewport(width, height, availableWidth, availableHeight);
      expect(fit.width).toBeLessThanOrEqual(availableWidth + .001);
      expect(fit.height).toBeLessThanOrEqual(availableHeight + .001);
      expect(fit.width / fit.height).toBeCloseTo(width / height);
      expect(fit.scrollable).toBe(false);
      expect(fit.width === availableWidth || fit.height === availableHeight).toBe(true);
    }
  });
  it("zooms the fitted map proportionally, enables inner scrolling, and survives an unmeasured viewport", () => {
    expect(fitAtlasViewport(50, 50, 900, 500)).toEqual({ width: 500, height: 500, scrollable: false });
    expect(fitAtlasViewport(50, 50, 900, 500, 1.5)).toEqual({ width: 750, height: 750, scrollable: true });
    expect(fitAtlasViewport(50, 25, 900, 500, 2)).toEqual({ width: 1800, height: 900, scrollable: true });
    expect(fitAtlasViewport(50, 50, 0, 0)).toEqual({ width: 0, height: 0, scrollable: false });
  });
  it("reveals nodes by changing only the axis scrollLeft, never ancestor scroll or vertical position", () => {
    const axis = { scrollLeft: 100, clientWidth: 400, scrollTop: 17 };
    revealAtlasAxisItem(axis, { offsetLeft: 800, offsetWidth: 140 }); expect(axis.scrollLeft).toBe(540);
    revealAtlasAxisItem(axis, { offsetLeft: 600, offsetWidth: 140 }); expect(axis.scrollLeft).toBe(540);
    revealAtlasAxisItem(axis, { offsetLeft: 0, offsetWidth: 140 }); expect(axis.scrollLeft).toBe(0);
    expect(axis.scrollTop).toBe(17);
  });
  it("all-era browsing opens the actual latest era, without borrowing a missing snapshot", () => {
    const eras = [{ id: "latest", startMonth: 200, confirmedMonth: 210 }, { id: "old", startMonth: 0, confirmedMonth: 12, mapSnapshot: {} }] as any;
    const latest = getAtlasOpeningEra(eras, "all")!;
    expect(latest.id).toBe("latest"); expect(latest.mapSnapshot).toBeUndefined();
    expect(getAtlasOpeningEra(eras, "old")?.id).toBe("old"); expect(getAtlasOpeningEra([], "all")).toBeUndefined();
    expect(eraSelectionUIReducer(initialEraSelectionUIState, { type: "OPEN_ERA_MAP", eraId: latest.id })).toMatchObject({ selectedEraId: "latest", eraMapOpen: true });
  });
  it("removes the duplicated vertical entry while retaining the shared picker, event entry and bounded page query", () => {
    const scroll = readFileSync(new URL('./index.tsx', import.meta.url), 'utf8');
    expect(scroll).not.toContain('时代脉络'); expect(scroll).not.toContain('TOGGLE_TIMELINE');
    expect(scroll).toContain('<EraPicker'); expect(scroll).toContain('>时代图鉴</Button>');
    expect(scroll).toContain('查看对应时代地图'); expect(scroll).toContain('getAtlasEraForEvent');
    expect(scroll).toContain('queryHistoryPage');
    const dialog = readFileSync(new URL('./EraAtlasDialog.tsx', import.meta.url), 'utf8');
    expect(dialog).not.toContain('scrollIntoView'); expect(dialog).toContain('revealAtlasAxisItem');
  });
});
