import {expect,it} from "vitest";
import {getRulerHistoricalEvents} from "./RulerChronicle";
import {selectMilitaryMilestones} from "../UI/Components/FactionDetails/PersonChroniclePresentation";
import worldRandom from "../Simulation/WorldRandom";
const event=(id:string,type:string,month:number,extra:any={})=>({id,type,year:month,monthIndex:month,actorFactionId:"秦",factionIds:["秦"],title:id,importance:"major",category:"politics",...extra}) as any;
const ruler={id:"king",accessionYear:0,endYear:600};
it("keeps accession, actual ending and political turns ahead of wars, representing early/middle/late life",()=>{
  const events=[event("accession","ruler-acceded",0,{rulerId:"king"}),
    ...Array.from({length:40},(_,i)=>event(`war${i}`,"city-captured",i<30?i+1:200+(i-30)*40,{cityId:i<30?"one-city":`city${i}`,actorFactionId:"秦",targetFactionId:"魏"})),
    event("exile","faction-exiled",250,{actorFactionId:"魏",targetFactionId:"秦"}),event("restore","faction-restored",350),
    event("unify","world-unification",550),event("death","ruler-died",600,{metadata:{rulerId:"king"}})];
  const original=JSON.stringify(events),rng=worldRandom.exportState();
  const rows=getRulerHistoricalEvents(events,ruler,"秦",600,[],8);
  expect(rows).toHaveLength(8);expect(rows.map(e=>e.id)).toEqual(expect.arrayContaining(["accession","death","exile","restore","unify"]));
  expect(rows.filter(e=>e.cityId==="one-city").length).toBeLessThanOrEqual(1);
  expect(rows.map(e=>e.year)).toEqual(rows.map(e=>e.year).sort((a,b)=>a-b));
  expect(getRulerHistoricalEvents([...events].reverse(),ruler,"秦",600,[],8).map(e=>e.id)).toEqual(rows.map(e=>e.id));
  expect(JSON.stringify(events)).toBe(original);expect(worldRandom.exportState()).toEqual(rng);
});
it("retains the true succession ending when a separate death event is absent, and enforces eight even for many political landmarks",()=>{
  const events=[event("accession","ruler-acceded",0,{rulerId:"king"}),...Array.from({length:15},(_,i)=>event(`restore${i}`,"faction-restored",i*30+1)),event("succession","ruler-succession",600,{metadata:{previousRulerId:"king",nextRulerId:"next"}})];
  const rows=getRulerHistoricalEvents(events,ruler,"秦",600,[],8);
  expect(rows).toHaveLength(8);expect(rows.map(e=>e.id)).toContain("accession");expect(rows.map(e=>e.id)).toContain("succession");
  expect(rows.some(e=>e.year>200&&e.year<400)).toBe(true);
});
it("does not confuse a later death with political termination or include a foreign ruler's death",()=>{
  const events=[event("accession","ruler-acceded",0,{rulerId:"king"}),event("end","faction-extinct",40,{targetFactionId:"秦"}),event("own-death","ruler-died",80,{metadata:{rulerId:"king"}}),event("foreign","ruler-died",80,{rulerId:"other"})];
  expect(getRulerHistoricalEvents(events,{...ruler,endYear:40},"秦",100,[],8).map(e=>e.id)).toEqual(["accession","end","own-death"]);
});
it("military summary preserves office progression and the political/life ending instead of twenty similar victories",()=>{
  const events=[event("initial","military-office-granted",0),event("general","military-office-granted",60),event("top","military-office-granted",120),
    ...Array.from({length:20},(_,i)=>event(`capture${i}`,"city-captured",i*12+2,{cityId:`city${i%3}`,metadata:{wasCapital:i===10?1:0}})),
    event("politics","ruler-deposed",200),event("retire","military-command-ended",260,{metadata:{endReason:"AGE_RETIREMENT"}}),event("dead","military-person-died",300)];
  const entries=events.map(e=>({eventId:e.id,worldMonth:e.year,factionId:"秦",text:e.title,source:`${e.type} · ${e.id}`,victory:e.type==="city-captured"}));
  const selected=selectMilitaryMilestones(entries,events);
  expect(selected).toHaveLength(8);expect(selected.map(e=>e.eventId)).toEqual(expect.arrayContaining(["initial","general","top","politics","retire","dead","capture10"]));
  expect(selected.map(e=>e.worldMonth)).toEqual(selected.map(e=>e.worldMonth).sort((a,b)=>a-b));
  expect(selectMilitaryMilestones([...entries].reverse(),[...events].reverse()).map(e=>e.eventId)).toEqual(selected.map(e=>e.eventId));
  expect(selectMilitaryMilestones(entries.slice(0,3),events)).toEqual(entries.slice(0,3));expect(entries).toHaveLength(26);
});
