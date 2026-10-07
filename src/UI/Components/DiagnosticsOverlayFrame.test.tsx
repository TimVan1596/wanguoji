import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import DiagnosticsOverlayFrame from "./DiagnosticsOverlayFrame";
import { createEmptyWorldSaveV10 } from "../../Persistence/WorldSaveSchema";
import worldRandom from "../../Simulation/WorldRandom";
import { DiplomacyRegistry, DiplomacySystem } from "../../Politics/Diplomacy";
vi.mock("react/jsx-dev-runtime", async () => {
  const react = await vi.importActual<typeof import("react")>("react");
  return { jsxDEV: (type: React.ElementType, props: Record<string, unknown>, key?: string) => {
    const {children,...rest}=props;
    return react.createElement(type,{...rest,key},...(Array.isArray(children)?children:[children]));
  }, Fragment: react.Fragment };
});
function fixture() {
  const children = vi.fn(() => <details><summary>diagnostics</summary><pre>latest samples</pre></details>);
  const frame = new DiagnosticsOverlayFrame({running:true,version:"v0.99928a",children});
  // Exercise actual class handlers/state/render; this is not browser visual acceptance.
  frame.setState = ((update: any) => { frame.state = {...frame.state,...(typeof update === "function" ? update(frame.state,frame.props) : update)}; }) as typeof frame.setState;
  return { frame, children, html: () => renderToStaticMarkup(frame.render()) };
}
describe("session-only diagnostic overlay",()=>{
  it("defaults to compact, shows live status/version and creates no expanded text or lazy reports",()=>{
    const f=fixture(),html=f.html();expect(f.frame.state.compact).toBe(true);expect(html).toContain("RUNNING");expect(html).toContain("v0.99928a");expect(html).toContain("展开");
    expect(html).not.toContain("<pre");expect(html).not.toContain("<details");expect(f.children).not.toHaveBeenCalled();
    Object.assign(f.frame,{props:{...f.frame.props,running:false}});expect(f.html()).toContain("PAUSED");
  });
  it("expands, collapses all by remounting only native-details UI, and minimizes again",()=>{
    const f=fixture();f.frame.expand();expect(f.html()).toContain("最小化");expect(f.html()).toContain("全部收起");expect(f.html()).toContain("<details>");expect(f.html()).not.toMatch(/<details[^>]*open/);
    const before=f.frame.render().props.children[1].key;f.frame.collapseAll();const after=f.frame.render().props.children[1].key;
    expect(after).not.toBe(before);expect(f.frame.state.compact).toBe(false);
    f.frame.minimize();const calls=f.children.mock.calls.length;expect(f.html()).not.toContain("<pre");expect(f.children).toHaveBeenCalledTimes(calls);
    f.frame.expand();expect(f.html()).toContain("<details>");expect(f.html()).not.toMatch(/<details[^>]*open/);
  });
  it("view transitions do not alter V10 or RNG and leave diagnostic collection independent",()=>{
    const run=(interact:boolean)=>{
      worldRandom.initialize("compact-observability");const random=worldRandom.exportState(),save=createEmptyWorldSaveV10();
      const f=fixture(),registry=new DiplomacyRegistry(true),system=new DiplomacySystem(registry,()=>[],()=>undefined);
      registry.setRelation({factionAId:"a",factionBId:"b",status:"TRUCE",startedMonth:0,expiresMonth:24,reason:"WAR_EXHAUSTION_TRUCE"});
      if(interact){f.frame.expand();f.html();f.frame.collapseAll();f.frame.minimize();}
      system.update(24,[],1,[]);f.html();expect(f.frame.state.compact).toBe(true);
      expect(registry.getDiagnostics(24).diplomacyII?.sessionCumulative.expired).toBe(1);
      expect(worldRandom.exportState()).toEqual(random);expect(JSON.parse(JSON.stringify(save))).toEqual(save);
      expect(save.saveSchemaVersion).toBe(10);expect(save).not.toHaveProperty("compact");expect(save).not.toHaveProperty("collapseRevision");
      return {canonical:registry.exportState(),rng:worldRandom.exportState()};
    };
    expect(run(true)).toEqual(run(false));
  });
});
