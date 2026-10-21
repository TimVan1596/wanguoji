import type React from "react";
import {expect,it,vi} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
vi.mock("react/jsx-dev-runtime",async()=>{const r=await vi.importActual<typeof import("react")>("react");return {jsxDEV:(type:React.ElementType,props:Record<string,unknown>,key?:string)=>r.createElement(type,{...props,key}),Fragment:r.Fragment};});
const {people}=vi.hoisted(()=>({people:new Map<string,any>()}));
vi.mock("../../../Politics/MilitaryCommandRegistry",()=>({default:{getPerson:(id:string)=>people.get(id),getFormations:()=>[]}}));
vi.mock("../../../Politics/Dynasty",()=>({default:{get:()=>undefined}}));
vi.mock("../../../History/WorldHistory",()=>({default:{getEvents:()=>[]}}));
import {RoyalMilitaryRoster} from "./RoyalMilitaryPanel";
it("titles the separate royal military roster and mounts only five, active first then most recent ended",()=>{
 people.clear();
 const rulers=Array.from({length:7},(_,i)=>({id:`r${i}`,militaryIdentity:{personId:`p${i}`}} as any));
 for(let i=0;i<7;i++)people.set(`p${i}`,{personId:`p${i}`,personalName:`宗室${i}`,royalIdentity:{rulerId:`r${i}`,factionId:"qin"},status:i===0?"ACTIVE":i===6?"DEAD":"RETIRED",appointments:[{factionId:"qin",commandId:`c${i}`,startMonth:0,endMonth:i===0?undefined:i*12,officeHistory:[{office:"PIJIANG",month:0,eventId:`grant${i}`}]}],capturedEventIds:[]});
 const html=renderToStaticMarkup(<RoyalMilitaryRoster rulers={rulers} month={120}/>);
 expect(html).toContain("宗室军旅");expect(html).toContain("展开全部（7人）");expect(html.match(/data-royal-military-person=/g)).toHaveLength(5);
 const ids=[...html.matchAll(/data-royal-military-person="(.*?)"/g)].map(m=>m[1]);expect(ids).toEqual(["p0","p6","p5","p4","p3"]);
 expect(html).toContain("已故");expect(html).toContain("继承资格另见上方");expect(html).not.toMatch(/上一页|下一页|overflow-y|military-person-event/);
});
