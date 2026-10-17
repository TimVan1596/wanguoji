import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import HistoricalEventArchive from "./HistoricalEventArchive";

vi.mock("react/jsx-dev-runtime", async () => {
  const react = await vi.importActual<typeof import("react")>("react");
  return { jsxDEV: (type: React.ElementType, props: Record<string, unknown>, key?: string) => react.createElement(type, { ...props, key }), Fragment: react.Fragment };
});

describe("narrow character sidebar archives", () => {
  const entries = Array.from({ length: 200 }, (_, i) => ({ id: `event-${i}`, content: <p>{`记录【${i}】`}</p> }));
  it("keeps a long archive collapsed until selected, with the complete record count", () => {
    const html = renderToStaticMarkup(<HistoricalEventArchive title="完整外交档案" entries={entries} />);
    expect(html).toContain("完整外交档案（200条）"); expect(html).not.toContain("记录【");
  });
  it("renders a bounded page of real records and navigation when opened", () => {
    const html = renderToStaticMarkup(<HistoricalEventArchive title="人物大事记" entries={entries} defaultOpen />);
    expect(html.match(/记录【/g)).toHaveLength(8);
    expect(html).toContain("记录【7】"); expect(html).not.toContain("记录【8】");
    expect(html).toContain("下一页"); expect(html).toContain("1 / 25");
    expect(html).toContain("overflow-wrap:anywhere"); expect(html).toContain("overflow-y:auto");
  });
});
