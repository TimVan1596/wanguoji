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
  it("renders every record in document flow without clipping, nested scrolling or navigation", () => {
    const html = renderToStaticMarkup(<HistoricalEventArchive title="人物大事记" entries={entries} defaultOpen />);
    expect(html.match(/记录【/g)).toHaveLength(200);
    expect(html).toContain("记录【7】"); expect(html).toContain("记录【8】"); expect(html).toContain("记录【199】");
    expect(html).not.toMatch(/上一页|下一页|加载更多|查看下一批/);
    expect(html).toContain("overflow-wrap:anywhere");
    expect(html).not.toMatch(/max-height|overflow-y|overflow:auto|overflow:hidden|height:300/);
  });
});

it("retains all 5000 records and the last important event without a second click",()=>{
  const html=renderToStaticMarkup(<HistoricalEventArchive title="长局纪年" defaultOpen entries={Array.from({length:5000},(_,i)=>({id:`e${i}`,content:<p>长局【{i}】</p>}))}/>);
  expect(html.match(/长局【/g)).toHaveLength(5000);expect(html).toContain("长局【4999】");expect(html).not.toMatch(/上一页|下一页|加载更多|查看下一批|max-height|overflow-y|overflow:auto|overflow:hidden/);
});
it('does not construct callback-provided records until the document is actually opened',()=>{let calls=0;const rows=()=>{calls++;return [{id:'one',content:<p>真实完整资料</p>}];};const closed=renderToStaticMarkup(<HistoricalEventArchive title='原始资料' totalCount={1} entries={rows}/>);expect(calls).toBe(0);expect(closed).toContain('原始资料（1条）');expect(closed).not.toContain('真实完整资料');expect(renderToStaticMarkup(<HistoricalEventArchive title='原始资料' totalCount={1} entries={rows} defaultOpen/>)).toContain('真实完整资料');expect(calls).toBe(1);});
