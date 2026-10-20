import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {expect,it,vi} from "vitest";
import PersonChronicleLayout from "./PersonChronicleLayout";
vi.mock("react/jsx-dev-runtime",async()=>{
  const r=await vi.importActual<typeof import("react")>("react");
  return {jsxDEV:(type:React.ElementType,props:Record<string,unknown>,key?:string)=>r.createElement(type,{...props,key}),Fragment:r.Fragment};
});
it.each(["生平本纪","生平"])("%s shares complete document-flow milestones, readable sections and closed original evidence",biographyTitle=>{
  const html=renderToStaticMarkup(<PersonChronicleLayout title={<b>赵彦</b>} biographyTitle={biographyTitle} biography={["有实际任职记录。"]}
    milestoneTitle="重大纪年" milestones={Array.from({length:50},(_,i)=>({id:`e${i}`,content:<p>纪年【{i}】</p>}))}
    assessment={["以所存史料为据。"]} evidence={<span>command-id-user-id</span>}/>);
  expect(html).toContain(biographyTitle);expect(html.match(/纪年【/g)).toHaveLength(50);expect(html).not.toMatch(/上一页|下一页/);expect(html).toContain("纪年【49】");
  const evidence=html.slice(html.lastIndexOf("<details"));expect(evidence).toContain("详细记录");expect(evidence).not.toContain("command-id-user-id");
  expect(evidence.match(/^<details[^>]*>/)?.[0]).not.toContain("open");expect(html).not.toContain("史家曰");
  expect(html).toContain("overflow-wrap:anywhere");
  expect(html).not.toMatch(/overflow-y|overflow:auto|overflow:hidden|max-height/);
});

it("labels an eight-event selection explicitly while the complete archive remains in details without paging or nested scroll",()=>{
  const all=Array.from({length:21},(_,i)=>({id:`record${i}`,content:<p>原纪年【{i}】</p>}));
  const html=renderToStaticMarkup(<PersonChronicleLayout title="秦王" biographyTitle="生平本纪" biography={[]}
    milestoneTitle="重大纪年" milestoneTotal={all.length} allMilestones={()=>all} milestones={[...all.slice(0,4),...all.slice(-4)]} assessment={[]}
    evidence={<div>{all.map(e=><div key={e.id}>{e.content}</div>)}</div>}/>);
  const publicPart=html.slice(0,html.indexOf("<summary>详细记录</summary>"));
  expect(publicPart.match(/原纪年【/g)).toHaveLength(8);expect(publicPart).toContain("重大纪年（精选8条／共21条）");
  expect(html).not.toContain("原纪年【10】");expect(html).not.toContain("原纪年【20】");expect(html).toContain("展开全部（共21条）");
  expect(html).not.toMatch(/上一页|下一页|加载更多|overflow-y|max-height/);
});
