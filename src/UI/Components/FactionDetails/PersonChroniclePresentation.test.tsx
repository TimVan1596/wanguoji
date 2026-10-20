import React from "react";
import {expect,it,vi} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import {militaryMilestones} from "./PersonChroniclePresentation";
import {composeMilitaryBiography} from "../../../Politics/PersonBiography";
import PersonChronicleLayout from "./PersonChronicleLayout";
import PersonArchiveCard from "./PersonArchiveCard";
import HistoricalEventArchive from "./HistoricalEventArchive";
import worldRandom from "../../../Simulation/WorldRandom";
vi.mock("react/jsx-dev-runtime",async()=>{const r=await vi.importActual<typeof import("react")>("react");return {jsxDEV:(type:React.ElementType,props:Record<string,unknown>,key?:string)=>r.createElement(type,{...props,key}),Fragment:r.Fragment};});
function fixture(){
  const person:any={personId:"p",name:"赵-407",personalName:"赵彦",factionId:"赵",status:"ACTIVE",appointments:[{commandId:"c",factionId:"赵",startMonth:0,officeHistory:[{office:"PIJIANG",eventId:"grant",month:0}]}]};
  const events:any[]=[{id:"appoint",type:"military-appointment",metadata:{}},{id:"grant",type:"military-office-granted",metadata:{}},{id:"order",type:"military-order-issued",cityName:"临淄",importance:"normal",metadata:{}},{id:"capture",type:"city-captured",cityId:"linzi",actorFactionId:"赵",targetFactionId:"齐",cityName:"临淄",metadata:{wasCapital:1,commanderPersonId:"p",commandId:"c",commanderPersonalName:"赵彦"}}];
  const entries:any[]=events.map((e,i)=>({eventId:e.id,worldMonth:i<2?0:i,commandId:"c",factionId:"赵",text:i===2?"军令不代表攻陷":"据本次任职0个月",source:`${e.type} · ${e.id}`,victory:i===3}));
  return {person,events,entries};
}
it("keeps canonical orders and evidence intact while the public milestones show formal office and actual battles",()=>{
  const f=fixture(),before=JSON.stringify(f),rng=worldRandom.exportState();
  const rows=militaryMilestones(f.person,f.entries,f.events);
  expect(rows.map(e=>e.eventId)).toEqual(["grant","capture"]);
  expect(rows.map(e=>e.text)).toEqual(["赵授职，赵彦获授裨将。","赵将领赵彦所部参与攻取齐都临淄。"]);
  expect(rows.map(e=>e.text).join("")).not.toMatch(/核验|编组|不代表|0个月|亲自|亲征/);
  expect(JSON.stringify(f)).toBe(before);expect(worldRandom.exportState()).toEqual(rng);
  f.events[2].importance="major";
  expect(militaryMilestones(f.person,f.entries,f.events).find(e=>e.eventId==="order")?.text).toBe("赵彦奉命以临淄为进军目标。");
});
it("death and retirement narratives retain their distinct factual meanings without inventing a defence or combat wound",()=>{
  const f=fixture();Object.assign(f.person,{status:"DEAD",deathMonth:24,deathCause:"SIEGE_LOSS"});
  const ending=composeMilitaryBiography(f.person,f.entries,"赵").ending!;
  expect(ending).toContain("战乱中去世");expect(ending).not.toMatch(/死守|守城|人口|城下|战伤/);
  const death:any={eventId:"death",worldMonth:24,source:"military-person-died · death",text:"去世",victory:false};
  expect(militaryMilestones(f.person,[death],[])[0].text).toBe("赵彦在战乱中去世。");
});
it("the shared royal/military reader shows one closed detail entrance, with no per-milestone audit controls",()=>{
  const f=fixture(),milestones=militaryMilestones(f.person,f.entries,f.events);
  const html=renderToStaticMarkup(<PersonChronicleLayout title="赵彦" biographyTitle="生平" biography={["曾任军职。"]} milestoneTitle="军旅纪事"
    milestones={milestones.map(e=>({id:e.eventId,content:<p>{e.text}</p>}))} assessment={[]}
    evidence={<span>{f.entries.map(e=>e.source).join("；")}</span>}/>);
  const publicPart=html.slice(0,html.indexOf("<summary>详细记录</summary>"));
  expect(publicPart).not.toMatch(/史料依据|military-command|military-order-issued|军令不代表|据本次任职/);
  expect(html).toContain("military-order-issued · order");
  expect(html.match(/<summary>详细记录<\/summary>/g)).toHaveLength(1);
  expect(html.slice(html.lastIndexOf("<details"))).not.toMatch(/^<details[^>]* open/);
});
it("archive headings use the same native control for rulers and officers instead of blue name links",()=>{
  const html=renderToStaticMarkup(<PersonArchiveCard heading={<>赵彦 · 赵国 · 将军<br/>12年1月—今</>} expanded active onSelect={()=>{}}><p>履历</p></PersonArchiveCard>);
  expect(html).toContain("aria-expanded=\"true\"");expect(html).toContain("button");expect(html).not.toContain("<a ");expect(html).toContain("overflow-wrap:anywhere");expect(html).toContain("12年1月—今");
});


it("collapsed historical cards do not mount biographies or their long record trees", () => {
  let mounts = 0;
  function Records() { mounts++; return <HistoricalEventArchive title="军旅纪事" defaultOpen entries={Array.from({length:100},(_,i)=>({id:`e${i}`,content:<p>完整记录【{i}】</p>}))}/>; }
  const closed = renderToStaticMarkup(<PersonArchiveCard heading="历任将领" expanded={false} onSelect={()=>{}}><Records/></PersonArchiveCard>);
  expect(mounts).toBe(0); expect(closed).not.toContain("完整记录【");
  const opened = renderToStaticMarkup(<PersonArchiveCard heading="历任将领" expanded onSelect={()=>{}}><Records/></PersonArchiveCard>);
  expect(mounts).toBe(1); expect(opened.match(/完整记录【/g)).toHaveLength(100); expect(opened).toContain("完整记录【99】");
  expect(opened).not.toMatch(/overflow-y|overflow:auto|overflow:hidden|max-height|上一页|下一页|加载更多/);
});
