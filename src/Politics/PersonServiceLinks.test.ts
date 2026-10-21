import {it,expect} from "vitest";
import {personServiceLinks,preAccessionMilitary} from "./PersonServiceLinks";
import type {Ruler} from "./Dynasty";
import type {MilitaryPerson,MilitaryFormation} from "./MilitaryCommandRegistry";
import type {WorldEvent} from "../History/WorldHistory";
const person={personId:"p",sourceUserId:1,name:"source",bornMonth:-300,status:"RETIRED",politicalRulerId:"new",capturedEventIds:[],appointments:[{factionId:"old",commandId:"c",startMonth:10,endMonth:40,endReason:"TRANSFERRED",officeHistory:[{office:"PIJIANG",month:10,eventId:"g"},{office:"JIANGJUN",month:22,eventId:"promote"}]}]} as MilitaryPerson;
const rulers=[{id:"a",accessionYear:0,endYear:20,reignOrdinal:1},{id:"b",accessionYear:20,reignOrdinal:2}] as Ruler[];
const grant={id:"g",type:"military-office-granted",year:10,actorFactionId:"old",rulerId:"a",metadata:{personId:"p",commandId:"c",office:"PIJIANG",previousOffice:"NONE"}} as WorldEvent;
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
