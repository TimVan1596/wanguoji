import {expect,it} from "vitest";
import {composeMilitaryBiography,composeRulerBiography} from "./PersonBiography";
import {deriveRulerPresentationEvidence as deriveRulerHistoricalEvidence,deriveRulerHistoricalEvidence as frozenTitleEvidence} from "./RulerHistoriography";
import {createRulerChronicle,getRulerHistoricalEvents} from "./RulerChronicle";
import type {Ruler} from "./Dynasty";
import {WorldHistoryStore} from "../History/WorldHistory";
import {deriveMilitaryChronicle} from "./MilitaryChronicle";
import {readFileSync} from "node:fs";

function context(dead=false){
  const chronicle=createRulerChronicle({month:0,population:8,territoryShare:.2,cityCount:3,stability:70});
  const ruler={id:"r1",houseName:"嬴氏",givenName:"文衡",bornYear:-360,accessionYear:0,status:dead?"dead":"ruling",chronicle,
    ...(dead?{endYear:120,deathMonth:120,deathReason:"去世"}:{}),templeName:dead?"太宗":undefined,posthumousEpithet:dead?"文":undefined} as Ruler;
  const history=new WorldHistoryStore();
  return {ruler,dynasty:{rulers:[ruler]},faction:{name:"秦"},events:history.getEvents(),worldMonth:120,history};
}
it("counts real recorded recoveries and captures consistently, while preserving the stored cumulative count",()=>{
  const c=context();c.ruler.chronicle!.citiesCapturedPersonally=3;
  c.history.addCityCaptured(12,"秦","赵","赵","邯郸","city1",false,false,0,undefined,"r1","g1");
  c.history.addCityRecovered(24,"秦","楚","秦","临淄","city2",false,0,"r1","g2");
  c.history.addCityRecovered(36,"秦","楚","秦","临淄","city2",false,0,"r1","g3");
  c.events=c.history.getEvents();
  const evidence=deriveRulerHistoricalEvidence(c),bio=composeRulerBiography(evidence,"嬴文衡",0);
  expect(bio.stats.personalCityCaptures).toBe(3);expect(evidence.politicalFacts.filter(f=>f.type==="city-recovered")).toHaveLength(2);
  expect(frozenTitleEvidence(c).politicalFacts.filter(f=>f.type==="city-recovered")).toHaveLength(0);
  expect(c.ruler.chronicle!.citiesCapturedPersonally).toBe(3);
  expect(bio.life.join("")).not.toMatch(/登基.*邯郸|亲率|亲征|享年|举行/);expect(bio.voice).toBeUndefined();
});
it("national victory and duplicated capital facts do not manufacture personal action",()=>{
  const c=context();
  c.history.addCityCaptured(12,"秦","赵","赵","邯郸","city1",false,false,0,undefined,undefined,"g");
  c.events=c.history.getEvents();c.events.push({...c.events[0],id:"same-city-capital",type:"capital-fallen",metadata:{wasCapital:1}});
  const bio=composeRulerBiography(deriveRulerHistoricalEvidence(c),"嬴文衡",0);
  expect(bio.stats.personalCityCaptures).toBe(0);expect(bio.stats.nationalCapitalCaptures).toBe(1);
  expect(bio.stats.nationalCityCaptures).toBe(0);
  // One lost-city occurrence is not one permanently lost city.
  c.ruler.chronicle!.citiesLostDuringReign=24;
  expect(composeRulerBiography(deriveRulerHistoricalEvidence(c),"嬴文衡",0).assessment.join("")).not.toContain("净失24座");
});
it("real capital-loss/recovery companion records with different political groups count as one personal victory",()=>{
  const c=context();
  const fallen=c.history.addCapitalFallen(24,"秦","楚","秦","临淄","city",true,0,undefined,"r1","capital-group");
  const recovery=c.history.addCityRecovered(24,"秦","楚","秦","临淄","city",true,0,"r1","collapse-group");
  c.events=c.history.getEvents();
  const bio=composeRulerBiography(deriveRulerHistoricalEvidence(c),"嬴文衡",0);
  expect(bio.stats.personalCityCaptures).toBe(1);expect(bio.stats.personalCapitalCaptures).toBe(1);
  expect(getRulerHistoricalEvents(c.events,c.ruler as any,"秦",120,[],100).map(e=>e.id)).toEqual([recovery]);
  expect(c.history.getEvents().map(e=>e.id)).toEqual([fallen,recovery]);
  const defender=context();defender.ruler.id="defender";defender.faction.name="楚";defender.events=c.events;
  const losingView=composeRulerBiography(deriveRulerHistoricalEvidence(defender),"楚君",0);
  expect(losingView.stats.capitalLosses).toBe(1);expect(losingView.stats.crisisEpisodes).toBe(1);expect(losingView.stats.personalCityCaptures).toBe(0);
  // A second actual recovery is a new capture, not another perspective of the first.
  c.history.addCityRecovered(36,"秦","楚","秦","临淄","city",true,0,"r1","next-capture");
  c.events=c.history.getEvents();expect(composeRulerBiography(deriveRulerHistoricalEvidence(c),"嬴文衡",0).stats.personalCityCaptures).toBe(2);
});
it("does not rewrite titles or finalize a living ruler; a landless exile is never praised for governance",()=>{
  const c=context();c.ruler.status="exiled";c.ruler.chronicle!.accessionSnapshot.cityCount=0;c.ruler.chronicle!.accessionSnapshot.territoryShare=0;
  c.events=[{id:"exile",type:"faction-exiled",year:0,monthIndex:0,targetFactionId:"秦",factionIds:["秦"],category:"politics",importance:"major",title:"秦失土流亡"}];
  const before=JSON.stringify(c.ruler),bio=composeRulerBiography(deriveRulerHistoricalEvidence(c),"嬴文衡",0);
  expect(bio.life.join("")).toContain("流亡");expect(bio.assessment.join("")).toContain("未有在国施政");expect(bio.voice).toBeUndefined();
  expect(JSON.stringify(c.ruler)).toBe(before);
});
it("an order-only military life has no victory or posthumous voice; retirement is distinct from death",()=>{
  const person:any={personId:"p",sourceUserId:1,personalName:"赵彦",name:"赵-407",bornMonth:-360,status:"RETIRED",factionId:"赵",capturedEventIds:[],appointments:[{commandId:"c",factionId:"赵",startMonth:12,endMonth:36,endReason:"AGE_RETIREMENT"}]};
  const formation:any={commandId:"c",commanderPersonId:"p",factionId:"赵",status:"DISBANDED",memberUnitIds:[],captures:[]};
  const order:any={id:"order",year:24,type:"military-order-issued",actorFactionId:"赵",cityId:"x",cityName:"蓟",metadata:{personId:"p",commandId:"c"}};
  const entries=deriveMilitaryChronicle(person,[formation],[order],120),bio=composeMilitaryBiography(person,entries,"赵");
  expect(bio.victories).toHaveLength(0);expect(bio.assessment).toContain("受命");expect(bio.ending).toBe("年老退职。");expect(bio.voice).toBeUndefined();
  person.status="DEAD";person.deathMonth=48;person.deathCause="NATURAL_DEATH";
  expect(composeMilitaryBiography(person,entries,"赵").ending).toContain("自然去世");
});
it("both biographies use the shared component and royal evidence receives canonical, ungrouped events",()=>{
  const source=readFileSync(new URL("../UI/Components/FactionDetails/index.tsx",import.meta.url),"utf8");
  expect(source.match(/<PersonChronicleLayout/g)).toHaveLength(2);
  expect(source).not.toContain("events={groupedEvents}");expect(source).toContain("原始任期累计（未改写）");
  const c=context();expect(getRulerHistoricalEvents(c.events,c.ruler as any,"秦",120,[])).toEqual([]);
});

it('verified siege participation is distinct from a capture and never determines a later battle-death location',()=>{
 const p:any={personalName:'成明仁',personId:'p',name:'p',status:'DEAD',deathCause:'BATTLE_DEATH',deathMonth:3576,appointments:[]};
 const bio=composeMilitaryBiography(p,[{eventId:'siege',source:'siege-started · siege',cityId:'ying',worldMonth:3480,text:'所部围攻郢',victory:false,factionId:'chu'}],'chu');
 expect(bio.assessment).toContain('围攻');expect(bio.assessment).toContain('未有取城');expect(bio.ending).toContain('战死');expect(bio.ending).not.toContain('郢');
});
