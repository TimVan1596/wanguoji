import type React from "react";
import {expect,it,vi} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
vi.mock("react/jsx-dev-runtime",async()=>{const r=await vi.importActual<typeof import("react")>("react");return {jsxDEV:(type:React.ElementType,props:Record<string,unknown>,key?:string)=>r.createElement(type,{...props,key}),Fragment:r.Fragment};});
const {people}=vi.hoisted(()=>({people:new Map<string,any>()}));
vi.mock("../../../Politics/MilitaryCommandRegistry",()=>({default:{getPeople:()=>[...people.values()],getPerson:(id:string)=>people.get(id),getFormations:()=>[]}}));
vi.mock("../../../Politics/Dynasty",()=>({default:{get:()=>undefined}}));
vi.mock("../../../History/WorldHistory",()=>({default:{getEvents:()=>[...people.values()].map(p=>({type:"military-appointment",year:0,actorFactionId:"qin",metadata:{commandId:p.appointments[0].commandId,personId:p.personId,royalRulerId:p.royalIdentity.rulerId,sourceUserId:p.sourceUserId}}))}}));
import {RoyalMilitaryRoster,sortRoyalMilitaryRows} from "./RoyalMilitaryPanel";
it("summarizes every verified career and defaults to a collapsed header without person shortcuts",()=>{
 people.clear();
 const rulers=Array.from({length:7},(_,i)=>({id:`r${i}`,bornYear:-300,naturalDeathYear:900,militaryIdentity:{personId:`p${i}`,sourceUserId:i,sourceUserLabel:`source${i}`,enteredMonth:0}} as any));
 for(let i=0;i<7;i++)people.set(`p${i}`,{personId:`p${i}`,factionId:"qin",sourceUserId:i,name:`source${i}`,bornMonth:-300,personalName:`宗室${i}`,royalIdentity:{rulerId:`r${i}`,factionId:"qin",naturalDeathMonth:900},status:i===0?"ACTIVE":i===6?"DEAD":"RETIRED",appointments:[{factionId:"qin",commandId:`c${i}`,startMonth:0,endMonth:i===0?undefined:i*12,officeHistory:[{office:"PIJIANG",month:0,eventId:`grant${i}`}]}],capturedEventIds:[]});
 const html=renderToStaticMarkup(<RoyalMilitaryRoster factionId="qin" rulers={rulers} month={120}/>);
 expect(html).toContain("累计7人 · 现役1人 · 历任6人");expect(html).toContain('aria-expanded="false"');expect(html).not.toContain("data-royal-military-person=");expect(html).not.toContain("定位宗室将领");
 expect(html).not.toMatch(/展开全部|上一页|下一页|overflow-y|military-person-event/);
});

it('orders real local active service before recent departures and does not count foreign active service as local',()=>{
 const person=(status:string,factionId:string,endMonth?:number)=>({status,factionId,appointments:[{factionId:'qin',endMonth}]} as any);
 const rows:Array<[string,any]>=[['old',person('RETIRED','qin',10)],['foreign',person('ACTIVE','chu',20)],['dead',person('DEAD','qin',30)],['active',person('ACTIVE','qin')]];
 expect(sortRoyalMilitaryRows(rows,'qin').map(([id])=>id)).toEqual(['active','dead','foreign','old']);expect(rows[0][0]).toBe('old');
});
