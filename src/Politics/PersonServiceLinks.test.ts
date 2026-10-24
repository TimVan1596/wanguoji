import {it,expect} from "vitest";
import {personServiceLinks,preAccessionMilitary} from "./PersonServiceLinks";
import type {Ruler} from "./Dynasty";
import type {MilitaryPerson,MilitaryFormation} from "./MilitaryCommandRegistry";
import type {WorldEvent} from "../History/WorldHistory";
const person={personId:"p",sourceUserId:1,name:"source",personalName:"李景",factionId:"new",bornMonth:-300,status:"RETIRED",politicalRulerId:"new",capturedEventIds:[],appointments:[{factionId:"old",commandId:"c",startMonth:10,endMonth:40,endReason:"TRANSFERRED",officeHistory:[{office:"PIJIANG",month:10,eventId:"g",captureEventIds:[],serviceMonths:0},{office:"JIANGJUN",month:22,eventId:"promote",captureEventIds:[],serviceMonths:12}]}]} as MilitaryPerson;
const rulers=[{id:"a",accessionYear:0,endYear:20,reignOrdinal:1},{id:"b",accessionYear:20,reignOrdinal:2}] as Ruler[];
const grant={id:"g",category:"politics",title:"真实授职",importance:"major",type:"military-office-granted",year:10,actorFactionId:"old",rulerId:"a",metadata:{personId:"p",commandId:"c",office:"PIJIANG",previousOffice:"NONE"}} as WorldEvent;
it("partitions service between real historical rulers and never uses a foreign current monarch",()=>{
 const rows=personServiceLinks("old",rulers,[person],[],[grant],50);
 expect(rows.map(r=>[r.rulerId,r.startMonth,r.endMonth])).toEqual([["a",10,19],["b",20,39]]);
 expect(rows[0].personalGrantEventIds).toEqual(["g"]);expect(rows[1].personalGrantEventIds).toEqual([]);
 expect(rows[1].offices).toEqual(["PIJIANG","JIANGJUN"]);
 expect(personServiceLinks("foreign",rulers,[person],[],[grant],50)).toEqual([]);
});
it("excludes zero overlap, unenthroned kin and unsupported personal appointment claims",()=>{
 const rs=[{id:"kin",accessionYear:0},{id:"end",accessionYear:40,endYear:50,reignOrdinal:1},{id:"wrong",accessionYear:0,endYear:20,reignOrdinal:1}] as Ruler[];
 const rows=personServiceLinks("old",rs,[person],[],[grant],60);
 expect(rows.map(r=>r.rulerId)).toEqual(["wrong"]);expect(rows[0].personalGrantEventIds).toEqual([]);
});
it("only projects a fully bound identity's real pre-accession military events",()=>{
 const r={id:"new",bornYear:-300,accessionYear:40,residentIdentity:{personId:"p",sourceUserId:1,sourceUserLabel:"source",bornMonth:-300,sourceFactionId:"old",foundedMonth:40,military:{personId:"p",commandId:"c"}}} as Ruler;
 const formations=[{commandId:"c",commanderPersonId:"p",factionId:"old",captures:[]}] as unknown as MilitaryFormation[];
 const result=preAccessionMilitary(r,[person],formations,[grant]);
 expect(result?.entries.map(e=>e.eventId)).toEqual(["g"]);
 expect(preAccessionMilitary({...r,bornYear:-301},[person],formations,[grant])).toBeUndefined();
 expect(preAccessionMilitary({...r,residentIdentity:undefined},[person],formations,[grant])).toBeUndefined();
 expect(preAccessionMilitary(r,[{...person,sourceUserId:2}],formations,[grant])).toBeUndefined();
 expect(preAccessionMilitary({...r,accessionYear:10},[person],formations,[grant])?.entries).toEqual([]);
});

it("projects 庄德恭's appointment, office, orders and verified capture through the same public military facts",()=>{
 const p={...structuredClone(person),personalName:"庄德恭"};p.appointments=[{factionId:"赵",startMonth:624,endMonth:672,endReason:"TRANSFERRED",commandId:"career",officeHistory:[{office:"PIJIANG",month:624,eventId:"office",serviceMonths:0,captureEventIds:[]}]}];p.capturedEventIds=["capture"];
 const formation={commandId:"career",commanderPersonId:"p",factionId:"赵",status:"DISBANDED",createdMonth:624,memberUnitIds:["u1","u2"],captures:[{eventId:"capture",cityId:"xinzheng",month:670}]} as MilitaryFormation;
 const event=(id:string,type:WorldEvent["type"],month:number,metadata:Record<string,any>={},extra:Partial<WorldEvent>={})=>({id,type,year:month,monthIndex:month,actorFactionId:"赵",factionIds:["赵"],category:"politics",title:"原始审计文本",importance:"normal",metadata:{personId:"p",commandId:"career",...metadata},...extra} as WorldEvent);
 const events=[event("appointment","military-appointment",624),event("office","military-office-granted",624,{office:"PIJIANG",previousOffice:"NONE",serviceMonths:0}),event("order1","military-order-issued",624,{}, {cityName:"姑臧"}),event("order2","military-order-issued",648,{}, {cityName:"新郑"}),event("capture","city-captured",670,{commanderPersonId:"p",commanderPersonalName:"庄德恭",commanderOffice:"PIJIANG",wasCapital:0,attackerNameAtEvent:"赵",defenderNameAtEvent:"郑"},{targetFactionId:"郑",cityId:"xinzheng",cityName:"新郑"})];
 const ruler={id:"new",bornYear:p.bornMonth,accessionYear:672,residentIdentity:{personId:"p",sourceUserId:p.sourceUserId,sourceUserLabel:p.name,bornMonth:p.bornMonth,sourceFactionId:"赵",foundedMonth:672,military:{personId:"p",commandId:"career"}}} as Ruler;
 const before=JSON.stringify({p,events,formation,ruler});
 const projected=preAccessionMilitary(ruler,[p],[formation],events)!;
 expect(projected.entries.map(e=>e.eventId)).toEqual(["office","capture"]);
 expect(projected.representative.map(e=>e.text)).toEqual(["赵授庄德恭为裨将。","赵攻克郑城新郑，赵裨将庄德恭所部参战。"]);
 expect(projected.representative.map(e=>e.text).join("")).not.toMatch(/0个月|军令|编组|审计|亲征/);
 expect(JSON.stringify({p,events,formation,ruler})).toBe(before);
});
