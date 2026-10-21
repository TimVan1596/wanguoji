import {expect,it} from "vitest";
import {validateRoyalMilitaryIdentities as validate} from "./RoyalMilitaryValidation";
import {createEmptyWorldSaveV1} from "./WorldSaveSchema";
const fixture=()=>{
 const s=createEmptyWorldSaveV1();s.world.worldMonth=30;
 const militaryIdentity={personId:"military-person-1",sourceUserId:7,sourceUserLabel:"李景",enteredMonth:12};
 s.dynasties=[{factionId:"a",currentRulerId:"father",rulers:[{rulerId:"father"},{rulerId:"son",houseName:"李氏",givenName:"景",parentId:"father",bornMonth:-300,naturalDeathMonth:600,status:"heir",militaryIdentity}]}];
 s.registries.militaryCommandRegistry.people=[{personId:militaryIdentity.personId,sourceUserId:7,name:"李景",personalName:"李景",bornMonth:-300,factionId:"a",status:"ACTIVE",appointments:[{factionId:"a",startMonth:12,commandId:"c"}],capturedEventIds:[],royalIdentity:{rulerId:"son",factionId:"a",naturalDeathMonth:600}}];
 s.users=[{userId:7,name:"李景",factionId:"a",bornMonth:-300,role:"NORMAL",militaryPersonId:militaryIdentity.personId,historicalPersonId:militaryIdentity.personId}] as any;
 s.worldHistory.events=[{type:"military-appointment",year:12,actorFactionId:"a",metadata:{personId:militaryIdentity.personId,sourceUserId:7}}];return s;
};
it("links royal parentage, existing lifespan and one real military body without relying on names",()=>{
 expect(validate(fixture())).toEqual([]);
 for(const mutate of [(s:any)=>s.dynasties[0].rulers[1].parentId="unknown",(s:any)=>s.registries.militaryCommandRegistry.people[0].royalIdentity.naturalDeathMonth++,(s:any)=>s.users[0].historicalPersonId="someone-else",(s:any)=>s.users.push({...s.users[0],userId:9}),(s:any)=>s.dynasties[0].rulers[1].militaryIdentity.sourceUserId++]){
  const s=fixture();mutate(s);expect(validate(s).length).toBeGreaterThan(0);
 }
});
it("requires one death across the royal and military records and no surviving body",()=>{
 const s=fixture(),r=(s.dynasties[0].rulers as any[])[1],p=s.registries.militaryCommandRegistry.people[0];
 r.status="dead";r.deathMonth=24;expect(validate(s).length).toBeGreaterThan(0);
 p.status="DEAD";p.deathMonth=24;s.users=[];expect(validate(s)).toEqual([]);
});
it("allows detached living kin, and permits political conversion only after closing the actual military office",()=>{
 const s=fixture(),r=(s.dynasties[0].rulers as any[])[1],p=s.registries.militaryCommandRegistry.people[0];
 p.status="RETIRED";s.users=[];expect(validate(s)).toEqual([]);
 r.reignOrdinal=2;r.status="ruling";expect(validate(s).length).toBeGreaterThan(0);
 p.politicalRulerId="son";expect(validate(s)).toEqual([]);p.status="ACTIVE";expect(validate(s).length).toBeGreaterThan(0);
});
it("malformed royalty is rejected without consulting live state or throwing",()=>{
 const s=fixture();(s.dynasties[0].rulers as any[])[1].houseName=null;
 expect(()=>validate(s)).not.toThrow();expect(validate(s).length).toBeGreaterThan(0);
});
