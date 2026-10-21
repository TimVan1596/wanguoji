import {expect,it} from "vitest";
import {formatMilitaryVictorySource,formatRulerMilitaryEvent,getMilitaryOfficeAtEvent} from "./MilitaryChronicle";
import {freezeMilitaryOfficeAuthority} from "./MilitaryOfficeAuthority";
import {validateMilitaryOfficeAuthorities,validateMilitaryBattleNames} from "../Persistence/MilitaryOfficeAuthorityValidation";
import {createEmptyWorldSaveV18} from "../Persistence/WorldSaveSchema";
import {exportRulerSave} from "../Persistence/RulerSaveProjection";
import {militaryMilestones} from "../UI/Components/FactionDetails/PersonChroniclePresentation";
import {formatHistoryEventTitle} from "../History/HistoryRenderRules";
import worldRandom from "../Simulation/WorldRandom";
const factions:any=new Map([["attacker",{name:"attacker",color:1,displayName:"汉",nameHistory:[{name:"秦",startMonth:0,endMonth:99},{name:"汉",startMonth:100}]}],["defender",{name:"defender",color:2,displayName:"晋",nameHistory:[{name:"魏",startMonth:0,endMonth:99},{name:"晋",startMonth:100}]}]]);
const battle=(id:string,month:number,extra:any={})=>({id,year:month,monthIndex:month,type:"city-captured",category:"war",title:"old title",actorFactionId:"attacker",targetFactionId:"defender",cityId:"suiyang",cityName:"睢阳",metadata:{commanderPersonId:"p",commandId:"c",commanderPersonalName:"鲍成",wasCapital:1},...extra}) as any;
it("one battle uses historical countries and frozen contemporary office in military, royal and world reading views",()=>{
  const e=battle("b",70);e.metadata.commanderOffice="JIANGJUN";
  const person:any={personId:"p",appointments:[{commandId:"c",factionId:"attacker",startMonth:0,officeHistory:[{office:"SHANGJIANGJUN",month:150}]}]};
  const ctx={factions,people:[person]},text=formatMilitaryVictorySource(e,ctx)!;
  expect(text).toBe("秦将军鲍成所部参与攻克魏都睢阳");expect(text).not.toMatch(/汉|晋|上将军|亲征/);
  expect(formatRulerMilitaryEvent(e,{accessionYear:0,endYear:99},"attacker",200,ctx)).toBe(`其治下，${text}`);
  const world=formatHistoryEventTitle(e,factions);expect(world).toBe(text);expect(world.match(/睢阳/g)).toHaveLength(1);
  expect(formatRulerMilitaryEvent(e,{accessionYear:0},"defender",200,ctx)).toBeUndefined();
});
it("same-month promotion cannot overwrite an earlier victory, including old events without a frozen rank",()=>{
  const early=battle("early",60),late=battle("late",60),grant:any={id:"general",year:60,type:"military-office-granted"};
  const p:any={personId:"p",appointments:[{commandId:"c",factionId:"attacker",startMonth:0,officeHistory:[{office:"PIJIANG",month:0,eventId:"initial"},{office:"JIANGJUN",month:60,eventId:"general"},{office:"SHANGJIANGJUN",month:120,eventId:"top"}]}]};
  const ctx={factions,people:[p],events:[early,grant,late]};
  expect(getMilitaryOfficeAtEvent(early,ctx)).toBe("PIJIANG");expect(getMilitaryOfficeAtEvent(late,ctx)).toBe("JIANGJUN");
  expect(formatMilitaryVictorySource(early,ctx)).toContain("秦裨将鲍成");expect(formatMilitaryVictorySource(late,ctx)).toContain("秦将军鲍成");
});
it("recovery and unknown defenders/capital status use only recorded facts",()=>{
  const e=battle("recover",70,{type:"city-recovered"});e.metadata.founderCapital=1;
  expect(formatMilitaryVictorySource(e,{factions})).toBe("秦将领鲍成所部参与收复魏所据的故都睢阳");
  delete e.targetFactionId;e.type="city-captured";e.metadata.wasCapital=undefined;
  expect(formatMilitaryVictorySource(e,{factions})).toBe("秦将领鲍成所部参与攻克睢阳");
  e.previousOwnerFactionId="defender";e.targetFactionId="conflicting";expect(formatMilitaryVictorySource(e,{factions})).toBe("秦将领鲍成所部参与攻克睢阳");
  delete e.metadata.commanderPersonId;expect(formatMilitaryVictorySource(e,{factions})).toBeUndefined();
});
function authorityFixture(){
  const team:any={name:"秦",displayName:"秦",status:"ACTIVE",identityStage:"STATE",stateFoundedMonth:0,sovereigntyRank:"KING",nameHistory:[{name:"秦",startMonth:0}],sovereigntyHistory:[{rank:"KING",startMonth:0}]};
  const ruler:any={id:"old",houseName:"嬴氏",givenName:"文",bornYear:-360,accessionYear:0,status:"ruling"};
  const dynasty:any={factionId:"秦",currentRulerId:"old",rulers:[ruler]};
  const event:any={id:"grant",type:"military-office-granted",year:12,actorFactionId:"秦",factionIds:["秦"],title:"grant",category:"politics",metadata:{personId:"p",commandId:"c",office:"PIJIANG"}};
  return {team,ruler,dynasty,event};
}
it("the simulation writer freezes the actual issuing ruler; later death, succession and renaming never backfill the new ruler",()=>{
  const f=authorityFixture(),rng=worldRandom.exportState(),e=freezeMilitaryOfficeAuthority(f.event,f.team,f.dynasty);
  expect(e.rulerId).toBe("old");expect(e.metadata?.authorizingRulerTitle).toBe("秦王嬴文");expect(f.event.rulerId).toBeUndefined();
  Object.assign(f.ruler,{status:"dead",deathMonth:48,deathReason:"去世",endYear:48});f.dynasty.currentRulerId="next";
  f.dynasty.rulers.push({...f.ruler,id:"next",givenName:"武",status:"ruling",accessionYear:48,endYear:undefined,deathMonth:undefined});
  f.team.displayName="汉";f.team.nameHistory=[{name:"秦",startMonth:0,endMonth:99},{name:"汉",startMonth:100}];
  const save=createEmptyWorldSaveV18();save.world.worldMonth=200;save.factions=[{...f.team,factionId:"秦"}];save.dynasties=[{...f.dynasty,rulers:f.dynasty.rulers.map(exportRulerSave)}];save.worldHistory.events=[e];
  expect(validateMilitaryOfficeAuthorities(save)).toEqual([]);
  const person:any={personId:"p",name:"tag",personalName:"鲍成",appointments:[{officeHistory:[{eventId:"grant",office:"PIJIANG"}]}]};
  const rows=militaryMilestones(person,[{eventId:"grant",worldMonth:12,factionId:"秦",source:"military-office-granted · grant",text:"source",victory:false}], [e]);
  expect(rows[0].text).toBe("秦王嬴文在位时，鲍成获授裨将。");expect(worldRandom.exportState()).toEqual(rng);
  const bad=structuredClone(save);(bad.worldHistory.events as any[])[0].rulerId="next";expect(validateMilitaryOfficeAuthorities(bad)).not.toEqual([]);
});
it.each(["dead","exiled","foreign","provisional"])("does not invent a %s ruler as the issuing authority",kind=>{
  const f=authorityFixture();if(kind==="dead"){f.ruler.status="dead";f.ruler.deathMonth=10;}if(kind==="exiled")f.ruler.status="exiled";if(kind==="foreign")f.dynasty.factionId="魏";if(kind==="provisional")f.team.identityStage="PROVISIONAL";
  expect(freezeMilitaryOfficeAuthority(f.event,f.team,f.dynasty)).toBe(f.event);
});

it("frozen issuer and opposing-country names survive a later rename within the same month",()=>{
  const f=authorityFixture();f.event.year=100;
  const grant=freezeMilitaryOfficeAuthority(f.event,f.team,f.dynasty);
  f.team.displayName="汉";f.team.nameHistory=[{name:"秦",startMonth:0,endMonth:99},{name:"汉",startMonth:100}];
  const save=createEmptyWorldSaveV18();save.world.worldMonth=100;save.factions=[{...f.team,factionId:"秦"}];save.dynasties=[{...f.dynasty,rulers:[exportRulerSave(f.ruler)]}];save.worldHistory.events=[grant];
  expect(grant.metadata?.authorizingRulerTitle).toBe("秦王嬴文");expect(validateMilitaryOfficeAuthorities(save)).toEqual([]);
  const capture=battle("boundary",100);capture.metadata.attackerNameAtEvent="秦";capture.metadata.defenderNameAtEvent="魏";
  expect(formatMilitaryVictorySource(capture,{factions})).toBe("秦将领鲍成所部参与攻克魏都睢阳");
  save.factions=[...factions.values()].map((v:any)=>({...v,factionId:v.name,identityStage:"STATE",stateFoundedMonth:0}));save.worldHistory.events=[capture];
  expect(validateMilitaryBattleNames(save)).toEqual([]);
  capture.metadata.defenderNameAtEvent="不存在的政权";expect(validateMilitaryBattleNames(save)).not.toEqual([]);
});
