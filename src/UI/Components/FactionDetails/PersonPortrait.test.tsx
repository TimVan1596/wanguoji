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
 it("retains full color and the same frozen face after death, with stable varied expressions",()=>{
  const alive=renderToStaticMarkup(<Portrait personId="same-person" age={80}/>),dead=renderToStaticMarkup(<Portrait personId="same-person" age={80} deceased/>);
  expect(dead).not.toMatch(/saturate|grayscale|filter:/);
  expect(dead.match(/<path data-face="true"[^>]*>/)?.[0]).toBe(alive.match(/<path data-face="true"[^>]*>/)?.[0]);
  expect(renderToStaticMarkup(<Portrait personId="same-person" age={80} deceased size={112}/>)).toContain('width="112"');
  const mouths=new Set(Array.from({length:100},(_,i)=>renderToStaticMarkup(<Portrait personId={`expression-${i}`} age={40}/>).match(/M27 47q5[^\"]+/)?.[0]));
  expect(mouths.size).toBeGreaterThanOrEqual(3);
 });
});

it("distinguishes three real peerages without changing face or replacing military rank",()=>{
 const faces=new Set<string>(),insignia=new Set<string>(),before=worldRandom.exportState();
 for(const nobleRank of ['BO','HOU','GONG'] as const){const html=renderToStaticMarkup(<Portrait personId="fixed" role="JIANGJUN" nobleRank={nobleRank} royalKin/>);faces.add(html.match(/<path data-face="true"[^>]*>/)![0]);insignia.add(html);expect(html).toContain(`data-noble-insignia="${nobleRank}"`);expect(html).toContain('data-portrait-role="JIANGJUN"');expect(html).toContain('data-royal-kin="true"');}
 expect(faces.size).toBe(1);expect(insignia.size).toBe(3);expect(worldRandom.exportState()).toEqual(before);
 expect(renderToStaticMarkup(<Portrait personId="fixed" role="KING" nobleRank="GONG"/>)).not.toContain('data-noble-insignia');
});

vi.mock("react/jsx-dev-runtime",async()=>{
 const r=await vi.importActual<typeof import("react")>("react");
 return {jsxDEV:(type:React.ElementType,props:Record<string,unknown>,key?:string)=>r.createElement(type,{...props,key}),Fragment:r.Fragment};
});

it('distinguishes colonel cloth and deputy shoulder panels while preserving the permanent elder face and honors',()=>{
 const render=(role:any)=>renderToStaticMarkup(<Portrait personId="same-stable-face" age={72} role={role} nobleRank="HOU" royalKin deceased/>);
 const colonel=render('XIAOWEI'),deputy=render('PIJIANG');
 expect(colonel).not.toContain('data-office-insignia');expect(deputy).toContain('data-office-insignia="PIJIANG"');
 const face=colonel.match(/data-face="true" d="([^"]+)"/)?.[1];expect(face).toBeTruthy();expect(face).toEqual(deputy.match(/data-face="true" d="([^"]+)"/)?.[1]);
 for(const svg of [colonel,deputy]){expect(svg).toContain('data-noble-insignia="HOU"');expect(svg).toContain('data-royal-kin="true"');expect(svg).toContain('data-age-stage="elder"');}
});
it.each([34,48,112])('keeps distinct leader, royal and imperial regalia at %ipx while preserving the permanent face',size=>{
 const faces=new Set<string>();
 for(const role of ['LEADER','KING','EMPEROR'] as const){const html=renderToStaticMarkup(<Portrait personId='one-life' role={role} age={62} size={size} color={0x224466}/>);expect(html).toContain(`width="${size}"`);faces.add(html.match(/<path data-face="true"[^>]*>/)![0]);if(role==='LEADER')expect(html).not.toContain('data-sovereign-regalia');else{expect(html).toContain(`data-sovereign-regalia="${role}"`);expect(html).toContain(`data-sovereign-robe="${role}"`);expect(html).not.toContain('data-office-insignia');}}
 expect(faces.size).toBe(1);
});
