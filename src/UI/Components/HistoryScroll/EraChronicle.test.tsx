import type React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import EraChronicle, { EraChronicleEventCard } from "./EraChronicle";
import { WorldHistoryStore } from "../../../History/WorldHistory";
import type { WorldEra } from "../../../Simulation/WorldEra";
import type Team from "../../../Components/Team";
vi.mock("react/jsx-dev-runtime", async () => {
  const react = await vi.importActual<typeof import("react")>("react");
  return { jsxDEV: (type: React.ElementType, props: Record<string, unknown>, key?: string) => {
    const { children, ...rest } = props; return react.createElement(type, { ...rest, key }, ...(Array.isArray(children) ? children : [children]));
  }, Fragment: react.Fragment };
});
describe("era chronicle presentation, not browser visual acceptance", () => {
  it("renders a single ten-event page and separates the era range from map time", () => {
    const store = new WorldHistoryStore(); for (let i = 0; i < 30; i++) store.addEvent({ id: `e-${i}`, type: 'state-founded', year: i, actorFactionId: 'a', category: 'politics', importance: 'major', title: '建国' });
    const era = { id: 'era-a', startMonth: 0, confirmedMonth: 12 } as WorldEra;
    const html = renderToStaticMarkup(<EraChronicle era={era} worldMonth={29} store={store} />);
    expect(html.match(/data-history-id/g)).toHaveLength(10);
    expect(html).toContain('查看更多 · 更早大事'); expect(html).toContain('大事属于整个时代；地图仅记录快照月份');
    expect(html).not.toContain('data-history-id="e-19"');
    const empty = renderToStaticMarkup(<EraChronicle era={{ ...era, startMonth: 40 }} worldMonth={29} store={store} />);
    expect(empty).toContain('本时代暂无符合筛选条件的大事');
  });
  it("each expanded card uses its own event ID, month, historical faction and city evidence", () => {
    const factions = new Map<string, Team>([['a', { name: 'a', displayName: '今天', color: 0,
      nameHistory: [{ name: '韩', startMonth: 0, endMonth: 59 }, { name: '齐', startMonth: 60 }] } as Team], ['b', { name: 'b', displayName: '秦', color: 0 } as Team]]);
    const first = { id: 'newzheng', type: 'capital-fallen' as const, year: 59, actorFactionId: 'b', targetFactionId: 'a', cityName: '新郑', category: 'war' as const, importance: 'major' as const, title: '失都', description: '新郑失陷' };
    const second = { ...first, id: 'linzi', year: 64, cityName: '临淄', description: '临淄失陷' };
    const before = JSON.stringify([first, second]);
    const htmlA = renderToStaticMarkup(<EraChronicleEventCard event={first} factions={factions} expandedId="newzheng" onToggle={() => {}} />);
    const htmlB = renderToStaticMarkup(<EraChronicleEventCard event={second} factions={factions} expandedId="linzi" onToggle={() => {}} />);
    expect(htmlA).toContain('data-history-id="newzheng"'); expect(htmlA).toContain('新郑'); expect(htmlA).toContain('韩'); expect(htmlA).not.toContain('临淄');
    expect(htmlB).toContain('data-history-id="linzi"'); expect(htmlB).toContain('临淄'); expect(htmlB).toContain('齐'); expect(htmlB).not.toContain('新郑');
    expect(htmlA + htmlB).not.toContain('今天'); expect(JSON.stringify([first, second])).toBe(before);
  });
});
