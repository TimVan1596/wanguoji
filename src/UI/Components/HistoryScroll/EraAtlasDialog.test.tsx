import type React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EraAtlasDialogContent } from "./EraAtlasDialog";
import type { WorldEra } from "../../../Simulation/WorldEra";
import { encodeOwnerRuns } from "../../../Simulation/EraMapSnapshot";
import { WorldHistoryStore } from "../../../History/WorldHistory";
import { queryHistoryPage } from "../../../History/HistoryPageQuery";
import { eraSelectionUIReducer, initialEraSelectionUIState, getSelectedEra } from "./eraSelection";
vi.mock("react/jsx-dev-runtime", async () => {
  const react = await vi.importActual<typeof import("react")>("react");
  return { jsxDEV: (type: React.ElementType, props: Record<string, unknown>, key?: string) => {
    const { children, ...rest } = props; return react.createElement(type, { ...rest, key }, ...(Array.isArray(children) ? children : [children]));
  }, Fragment: react.Fragment };
});
function era(i: number): WorldEra {
  return { id: `era-${i}`, type: "MULTIPOLAR", name: `第${i}时代`, identityKey: `era-${i}`, startMonth: i * 120, confirmedMonth: i * 120 + 24, endMonth: i * 120 + 119,
    dominantFactionIds: ["a"], triggerReasonCodes: [], explanation: "真实格局", mapSnapshot: {
      version: 1, capturedMonth: i * 120 + 24, widthCells: 20, heightCells: 20,
      factionPalette: [{ factionId: "a", displayName: "历史国号", color: 0x123456 }], ownerRuns: encodeOwnerRuns(Array(400).fill(1)), cities: [] } };
}
const markup = (eras: WorldEra[], id: string) => renderToStaticMarkup(<EraAtlasDialogContent eras={eras} selectedEraId={id} onNavigate={() => {}} />);
describe("bounded atlas dialog and shared indexed history selection (nonvisual)", () => {
  it("renders one canvas for 120 era nodes and shows frozen names, absolute shares and confirmed date", () => {
    const html = markup(Array.from({ length: 120 }, (_, i) => era(i)), "era-0");
    expect(html.match(/<canvas/g)).toHaveLength(1); expect(html).toContain("横向时代时间轴");
    expect(html).toContain("历史国号：占世界地图100.0% · 当时控制400格 · 0城");
    expect(html).toContain("时代确立记录：2年1月"); expect(html).toContain("地图快照：2年1月");
    expect(html).toContain("人口与君主：当前快照未记录"); expect(html).not.toContain("时代开始当月地图");
    expect(html).toMatch(/disabled=""[^>]*>← 上一时代/);
    expect(markup([era(0)], "era-0")).toMatch(/disabled=""[^>]*>下一时代 →/);
  });
  it("a selected missing map shows no neighboring canvas or invented historical data", () => {
    const missing = { ...era(1), mapSnapshot: undefined }, html = markup([era(0), missing, era(2)], missing.id);
    expect(html).toContain("该时代没有保存历史地图"); expect(html).not.toContain("<canvas");
    expect(html).not.toContain("当时控制400格");
  });
  it("atlas navigation keeps faction/type filters and uses the authoritative bounded history query", () => {
    const store = new WorldHistoryStore(), eras = [era(0), era(1)];
    for (let i = 0; i < 20000; i++) store.addEvent({ id: `old-${i}`, type: "city-founded", year: 10000 + i, actorFactionId: "unrelated", title: "普通历史", category: "politics", importance: "normal" });
    store.addEvent({ id: "A", type: "world-era-started", year: 24, actorFactionId: "a", metadata: { eraId: "era-0" }, title: "时代", category: "politics", importance: "major" });
    store.addEvent({ id: "B", type: "world-era-started", year: 144, actorFactionId: "a", metadata: { eraId: "era-1" }, title: "时代", category: "politics", importance: "major" });
    store.addEvent({ id: "other", type: "world-era-started", year: 144, actorFactionId: "b", title: "时代", category: "politics", importance: "major" });
    const full = vi.spyOn(store, "getEvents"), window = vi.spyOn(store, "getEventWindow");
    const open = eraSelectionUIReducer(initialEraSelectionUIState, { type: "OPEN_ERA_MAP", eraId: "era-0" });
    const next = eraSelectionUIReducer(open, { type: "NAVIGATE_MAP", eraId: "era-1" });
    const selected = getSelectedEra(eras, next.selectedEraId)!;
    const result = queryHistoryPage(store, { visibleCount: 200, filter: "featured", eventTypeFilter: "era", factionId: "a", startMonth: selected.startMonth, endMonth: selected.endMonth });
    expect(result.events.map(e => e.id)).toEqual(["B"]); expect(full).not.toHaveBeenCalled();
    expect(window.mock.calls[0][0]).toMatchObject({ limit: 200, startMonth: 120, endMonth: 239, factionId: "a" });
  });
});
