import {describe,it,expect} from "vitest";
import {royalPortraitContext,militaryPortraitContext} from "./PortraitPresentation";
import type {MilitaryPerson} from "../../../Politics/MilitaryCommandRegistry";
const faction={color:0x0000ff,identityStage:"STATE",stateFoundedMonth:24,colorHistory:[{color:0xff0000,startMonth:0,endMonth:99,reason:"FOUNDING"},{color:0x0000ff,startMonth:100,reason:"USURPATION"}],sovereigntyHistory:[{rank:"LEADER" as const,startMonth:0,endMonth:23},{rank:"KING" as const,startMonth:24,endMonth:59},{rank:"EMPEROR" as const,startMonth:60}]};
describe("portrait historical office and color",()=>{
 it("does not dress provisional leaders as emperors or recolor a former monarch after a same-month revolution",()=>{
  expect(royalPortraitContext({bornYear:-300,accessionYear:0},faction,12)).toMatchObject({role:"LEADER",color:0xff0000});
  expect(royalPortraitContext({bornYear:-300,accessionYear:0},faction,36).role).toBe("KING");
  expect(royalPortraitContext({bornYear:-300,accessionYear:0},faction,72).role).toBe("EMPEROR");
  expect(royalPortraitContext({bornYear:-300,accessionYear:0,endYear:100,deathMonth:100,deathReason:"自然去世"},faction,500)).toMatchObject({role:"EMPEROR",color:0xff0000,deceased:true,month:99});
 });
 it("uses the viewed country's actual final military office, never later foreign promotion",()=>{
  const p={personId:"p",status:"ACTIVE",factionId:"foreign",appointments:[{factionId:"old",startMonth:12,endMonth:100,officeHistory:[{office:"PIJIANG",month:12},{office:"JIANGJUN",month:80}]},{factionId:"foreign",startMonth:100,officeHistory:[{office:"SHANGJIANGJUN",month:100}]}]} as MilitaryPerson;
  expect(militaryPortraitContext(p,"old",faction,200)).toMatchObject({role:"JIANGJUN",color:0xff0000,month:99,historical:true});
  expect(militaryPortraitContext(p,"foreign",faction,200)).toMatchObject({role:"SHANGJIANGJUN",color:0x0000ff,historical:false});
 });
});
it('applies only titles effective at the viewed month, including after-service revocation',()=>{
 const p:any={personId:'p',status:'RETIRED',factionId:'foreign',royalIdentity:{rulerId:'real'},appointments:[{factionId:'old',startMonth:0,endMonth:100,officeHistory:[{office:'JIANGJUN',month:0}]}],nobilityHistory:[{eventId:'g',factionId:'old',epochFounderId:'king',rank:'HOU',month:72}],honorHistory:[{kind:'REVOKED',factionId:'old',epochFounderId:'king',month:120}]};
 expect(militaryPortraitContext(p,'old',faction,60)).toMatchObject({nobleRank:undefined,royalKin:true});expect(militaryPortraitContext(p,'old',faction,90)).toMatchObject({nobleRank:'HOU',role:'JIANGJUN'});expect(militaryPortraitContext(p,'old',faction,200)).toMatchObject({nobleRank:undefined,role:'JIANGJUN',month:99});expect(militaryPortraitContext(p,'foreign',faction,90).nobleRank).toBeUndefined();
});
