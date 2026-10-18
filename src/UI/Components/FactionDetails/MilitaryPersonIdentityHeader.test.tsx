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
  expect(html).toContain("李承远 · 燕国现役指挥官");
  expect(html.indexOf("李承远")).toBeLessThan(html.indexOf("<details"));
  const details=html.slice(html.indexOf("<details"));
  expect(details).toContain("身份与史料依据");expect(details).toContain("military-person-21");expect(details).toContain("1143911904");
  expect(details).toContain("燕-407");expect(html).toContain("overflow-wrap:anywhere");
  expect(details.match(/^<details[^>]*>/)?.[0]).not.toContain("open");
});
it("uses the existing unverified-name explanation and preserves deceased identity",()=>{
  const html=renderToStaticMarkup(<MilitaryPersonIdentityHeader person={{...person,personalName:"",status:"DEAD"}} country="燕国"/>);
  expect(html).toContain("姓名未核验的指挥者");expect(html).toContain("燕国已故");expect(html).not.toContain("李承远");
});
