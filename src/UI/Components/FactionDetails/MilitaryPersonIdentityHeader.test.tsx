import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {expect,it,vi} from "vitest";
import MilitaryPersonIdentityHeader from "./MilitaryPersonIdentityHeader";
import type {MilitaryPerson} from "../../../Politics/MilitaryCommandRegistry";

vi.mock("react/jsx-dev-runtime",async()=>{
  const react=await vi.importActual<typeof import("react")>("react");
  return {jsxDEV:(type:React.ElementType,props:Record<string,unknown>,key?:string)=>react.createElement(type,{...props,key}),Fragment:react.Fragment};
});
const person={personId:"military-person-21",sourceUserId:1143911904,name:"燕-407",personalName:"李承远",status:"ACTIVE",appointments:[]} as unknown as MilitaryPerson;
it("leads with the recorded name and country; raw identity evidence remains in closed narrow-sidebar details",()=>{
  const html=renderToStaticMarkup(<MilitaryPersonIdentityHeader person={person} country="燕国"/>);
  expect(html.replace(/<[^>]*>/g," ").replace(/\s+/g," ")).toContain("李承远 · 燕国 · 现役指挥官");
  expect(html).toContain("李承远");
  expect(html).not.toContain("<details");expect(html).not.toContain("1143911904");expect(html).not.toContain("military-person-21");
  expect(html).not.toContain("燕-407");
});
it("uses the existing unverified-name explanation and preserves deceased identity",()=>{
  const html=renderToStaticMarkup(<MilitaryPersonIdentityHeader person={{...person,personalName:"",status:"DEAD"}} country="燕国"/>);
  expect(html).toContain("姓名未核验的指挥者");expect(html.replace(/<[^>]*>/g," ").replace(/\s+/g," ")).toContain("燕国 · 生死未载");expect(html).not.toContain("李承远");
});

it.each(["杜安","安昭","司马承远","耶律药师奴","爱新觉罗多铎"])("keeps the complete recorded name %s together without guessing a surname",name=>{
 const html=renderToStaticMarkup(<MilitaryPersonIdentityHeader person={{...person,name,personalName:name}} country="齐国"/>);expect(html).toContain(`data-person-full-name="${name}"`);expect(html).toContain(`>${name}</span>`);
});
