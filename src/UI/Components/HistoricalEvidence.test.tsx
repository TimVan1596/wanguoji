import type React from "react";
import {expect,it,vi} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import Evidence from "./HistoricalEvidence";
import {formatMilitaryVictorySource} from "../../Politics/MilitaryChronicle";
vi.mock("react/jsx-dev-runtime", async()=>{
  const react=await vi.importActual<typeof import("react")>("react");
  return {jsxDEV:(type:React.ElementType,props:Record<string,unknown>,key?:string)=>{const {children,...rest}=props;return react.createElement(type,{...rest,key},...(Array.isArray(children)?children:[children]));},Fragment:react.Fragment};
});
it("narrative hides internal IDs and closed evidence retains canonical references",()=>{
  const event:any={id:"city-captured-123",type:"city-captured",cityId:"c",cityName:"临淄",actorFactionId:"楚",metadata:{commandId:"military-command-3",commanderPersonId:"person-7",commanderPersonalName:"柴翊",wasCapital:0}};
  const text=formatMilitaryVictorySource(event)!;expect(text).toContain("柴翊所属编组参与攻陷临淄");
  expect(text).not.toContain(event.id);expect(text).not.toContain(event.metadata.commandId);expect(text).not.toContain("亲征");
  const html=renderToStaticMarkup(<Evidence eventId={event.id} commandId={event.metadata.commandId} personId={event.metadata.commanderPersonId}/>);
  expect(html).toContain("<summary>史料依据</summary>");expect(html).toContain(event.id);expect(html).toContain(event.metadata.commandId);expect(html).not.toMatch(/<details[^>]*\bopen/);
});
