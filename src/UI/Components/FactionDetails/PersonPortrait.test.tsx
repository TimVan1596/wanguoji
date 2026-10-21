import React from "react";
import {describe,it,expect,vi} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import Portrait,{portraitTraits} from "./PersonPortrait";
import worldRandom from "../../../Simulation/WorldRandom";
describe("lightweight identity portrait",()=>{
 it("preserves identity across ages and reloads without consuming world RNG",()=>{
  worldRandom.initialize("portrait");const before=worldRandom.exportState();
  const young=portraitTraits("permanent-person",8),old=portraitTraits("permanent-person",80);
  expect(young.seed).toBe(old.seed);expect(young.robe).toBe(old.robe);expect(young.stage).not.toBe(old.stage);
  expect(portraitTraits("permanent-person",80)).toEqual(old);
  expect(renderToStaticMarkup(<Portrait personId="permanent-person" age={80}/>)).toContain('data-age-stage="elder"');
  expect(worldRandom.exportState()).toEqual(before);
 });
 it("does not infer age or gender from a name",()=>{
  expect(portraitTraits("person").stage).toBe("unknown");
  const html=renderToStaticMarkup(<Portrait personId="person"/>);
  expect(html).not.toContain("<image");expect(html).not.toContain("http");
 });
 it("keeps the same face through every real office and flag transition while distinguishing uniforms",()=>{
  const before=worldRandom.exportState(),faces=new Set<string>(),uniforms=new Set<string>();
  for(const role of ["LEADER","KING","EMPEROR","PIJIANG","JIANGJUN","SHANGJIANGJUN"] as const){
   const html=renderToStaticMarkup(<Portrait personId="same-person" age={40} role={role} color={0x224477}/>);
   faces.add(html.match(/<path data-face="true"[^>]*>/)![0]);uniforms.add(html);
   expect(html).toContain(`data-portrait-role="${role}"`);
  }
  expect(faces.size).toBe(1);expect(uniforms.size).toBe(6);expect(worldRandom.exportState()).toEqual(before);
  expect(renderToStaticMarkup(<Portrait personId="same-person" age={80} deceased/>)).toContain('data-deceased="true"');
 });
 it("produces distinct immutable facial detail combinations without generating new people",()=>{
  const shapes=new Set(Array.from({length:100},(_,i)=>{const {seed:_seed,stage:_stage,robe:_robe,...face}=portraitTraits(`person-${i}`,40);return JSON.stringify(face);}));
  expect(shapes.size).toBeGreaterThan(90);
 });
});

vi.mock("react/jsx-dev-runtime",async()=>{
 const r=await vi.importActual<typeof import("react")>("react");
 return {jsxDEV:(type:React.ElementType,props:Record<string,unknown>,key?:string)=>r.createElement(type,{...props,key}),Fragment:r.Fragment};
});
