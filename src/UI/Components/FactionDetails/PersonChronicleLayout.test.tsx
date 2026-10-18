import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {expect,it,vi} from "vitest";
import PersonChronicleLayout from "./PersonChronicleLayout";
vi.mock("react/jsx-dev-runtime",async()=>{
  const r=await vi.importActual<typeof import("react")>("react");
  return {jsxDEV:(type:React.ElementType,props:Record<string,unknown>,key?:string)=>r.createElement(type,{...props,key}),Fragment:r.Fragment};
});
it.each(["生平本纪","生平"])("%s shares bounded milestones, readable sections and closed original evidence",biographyTitle=>{
  const html=renderToStaticMarkup(<PersonChronicleLayout title={<b>赵彦</b>} biographyTitle={biographyTitle} biography={["有实际任职记录。"]}
    milestoneTitle="重大纪年" milestones={Array.from({length:50},(_,i)=>({id:`e${i}`,content:<p>纪年【{i}】</p>}))}
    assessment={["以所存史料为据。"]} evidence={<span>command-id-user-id</span>}/>);
  expect(html).toContain(biographyTitle);expect(html.match(/纪年【/g)).toHaveLength(8);expect(html).toContain("下一页");
  const evidence=html.slice(html.lastIndexOf("<details"));expect(evidence).toContain("完整史料依据");expect(evidence).toContain("command-id-user-id");
  expect(evidence.match(/^<details[^>]*>/)?.[0]).not.toContain("open");expect(html).not.toContain("史家曰");
  expect(html).toContain("overflow-wrap:anywhere");
});
