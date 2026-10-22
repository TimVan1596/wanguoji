import type React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { GenealogyPersonCard } from "./GenealogyPersonCard";
import type { GenealogyNodePresentation } from "./GenealogyNodePresentation";
import type { Ruler } from "../../../Politics/Dynasty";
// Match the existing SSR tests: this repository's development JSX runtime lacks jsxDEV.
vi.mock("react/jsx-dev-runtime", async () => {
  const r = await vi.importActual<typeof import("react")>("react");
  return { jsxDEV: (type: React.ElementType, props: Record<string, unknown>, key?: string) => {
    const { children, ...rest } = props; return r.createElement(type, { ...rest, key }, ...(Array.isArray(children) ? children : [children]));
  }, Fragment: r.Fragment };
});
const ruler: Ruler = { id: "r", houseName: "宋氏", givenName: "景", bornYear: 0, status: "politically-ended", reignOrdinal: 18 };
describe("genealogy card and integration structure", () => {
  it("shows at most two roles while retaining remaining identities in the native description", () => {
    const p: GenealogyNodePresentation = { theme: "foundation", roles: ["正式开国", "称帝", "末代承统"], labels: ["正式开国", "称帝"],
      details: ["正式开国", "称帝", "末代承统", "生死未载"], hasPosthumousTitle: false, evidence: [] };
    const html = renderToStaticMarkup(<GenealogyPersonCard ruler={ruler} displayName="宋景" presentation={p} />);
    expect(html).toContain('data-genealogy-theme="foundation"'); expect(html).toContain('title="正式开国 · 称帝 · 末代承统 · 生死未载"');
    expect(html).toContain("正式开国 · 称帝"); expect(html).toContain("第18代"); expect(html).toContain("生死未载");
    expect(html).not.toMatch(/战死|享年|亡国/);
  });
  it("keeps ordinary kin quiet and wraps long historical names", () => {
    const html = renderToStaticMarkup(<GenealogyPersonCard ruler={{ ...ruler, status: "kin", reignOrdinal: undefined }} displayName="欧阳承明" />);
    expect(html).toContain('data-genealogy-theme="neutral"'); expect(html).toContain("宗室成员");
    expect(html).toContain("max-width:230px"); expect(html).toContain("overflow-wrap:anywhere");
  });
  it("queries on demand, caches facts, bounds React rendering and retains real parent lines and controls",()=>{
    const dialog=readFileSync(new URL("./GenealogyBrowser.tsx",import.meta.url),"utf8");
    const window=readFileSync(new URL("./genealogyWindow.ts",import.meta.url),"utf8");
    expect(dialog).toContain('events=open?History.getEvents():[]');expect(dialog).toContain('if(!open||!dynasty)return undefined');
    expect(dialog).toContain('[open,stamp,worldMonth,team.name]');expect(dialog).toContain('genealogyWindow(data.index,focus,expanded,branchOffsets)');
    expect(window).toContain('GENEALOGY_WINDOW_LIMIT=150');expect(dialog).not.toContain('<GenealogyTreeNode');
    expect(dialog).toContain('data-parent-id={e.parentId}');expect(dialog).toContain('layout.positions.get(r.id)');expect(dialog).toContain('visibleGenealogyRows(rows,layout,view,focus)');expect(dialog).toContain('data-y1={e.y1}');expect(dialog).not.toContain('查看此支');expect(dialog).not.toContain('浏览全部人物');expect(dialog).not.toContain('查找人物');expect(dialog).not.toContain('TextField');expect(dialog).not.toContain('setQuery');expect(dialog).toContain('<svg');expect(dialog).not.toContain('ml:Math.min(depth');
    expect(dialog).toContain('适应窗口');expect(dialog).toContain('定位当今君主');expect(dialog).toContain("'ESCAPE'");
    expect(dialog).not.toContain('endReason === "彻底灭亡"');
  });
});
