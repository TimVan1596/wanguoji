import {it,expect} from "vitest";
import {validateResidentIdentities} from "./ResidentIdentityValidation";
import {createEmptyWorldSaveV1} from "./WorldSaveSchema";
const fixture=()=>{
 const s=createEmptyWorldSaveV1();s.world.worldMonth=24;
 s.factions=[{factionId:"parent"},{factionId:"rebel",origin:{parentFactionId:"parent",foundingRulerId:"r"}}] as any;
 s.cities=[{cityId:"city"}] as any;
 const residentIdentity={personId:"resident-x",sourceUserId:7,sourceUserLabel:"parent-001",bornMonth:-300,sourceFactionId:"parent",sourceFactionName:"旧邦",foundedMonth:12,cityId:"city",cityName:"起城"};
 s.dynasties=[{factionId:"rebel",currentRulerId:"r",rulers:[{rulerId:"r",bornMonth:-300,naturalDeathMonth:600,accessionMonth:12,relationType:"FOUNDER",status:"ruling",residentIdentity}]}];
 s.users=[{userId:7,name:"parent-001",bornMonth:-300,historicalPersonId:"resident-x",role:"RULER",rulerId:"r",factionId:"rebel"}] as any;
 s.worldHistory={events:[{id:"accession",type:"ruler-acceded",rulerId:"r",metadata:{residentPersonId:"resident-x",sourceUserId:7,sourceFactionId:"parent",foundingCityId:"city"}}]};return s;
};
it("requires one live entity matching the permanent resident birth, original label and royal role",()=>{
 const s=fixture();expect(validateResidentIdentities(s)).toEqual([]);
 s.users.push({...s.users[0],userId:99,historicalPersonId:undefined});expect(validateResidentIdentities(s)).toContain("resident person has duplicate live entities");
});
it("map detachment is permitted but a dead person cannot retain a live entity",()=>{
 const s=fixture(),r=(s.dynasties[0].rulers as any[])[0];r.status="exiled";s.users=[];
 expect(validateResidentIdentities(s)).toEqual([]);r.status="dead";r.deathMonth=20;
 s.users=fixture().users;expect(validateResidentIdentities(s)).toContain("resident person life/entity mismatch");
});
it("retains source and rejects birth/provenance or military recapture without its original battle",()=>{
 const s=fixture();(s.dynasties[0].rulers as any[])[0].residentIdentity.bornMonth--;
 expect(validateResidentIdentities(s)).toContain("resident founder identity/provenance mismatch");
 const t=fixture();(t.worldHistory.events as any[]).push({id:"restore",type:"faction-restored",actorFactionId:"rebel",cityId:"city",year:18,metadata:{restorationTrigger:"MILITARY_RECAPTURE",captureEventId:"missing",remnantPopulation:0}});
 expect(validateResidentIdentities(t)).toContain("military restoration lacks matching capture evidence");
});

it("defers malformed base records to the primary validator without throwing",()=>{
 const s=fixture();s.users.push(null as any);s.factions.push(null as any);s.cities.push(null as any);(s.worldHistory.events as any[]).unshift(null);
 expect(()=>validateResidentIdentities(s)).not.toThrow();
});

it("regional-6: repeated occupation includes a real dated political transfer, without treating it as a military victory",()=>{
 const s=fixture();s.world.worldMonth=684;
 const events=s.worldHistory.events as any[];
 events.push({id:"capture",type:"city-captured",cityId:"city",year:631,actorFactionId:"parent",targetFactionId:"rebel"},
 {id:"revolt",type:"city-revolt",cityId:"city",year:648,actorFactionId:"rebel",targetFactionId:"parent",metadata:{revoltOrigin:"FOUNDING"}},
 {id:"founding",type:"rebel-faction-founded",cityId:"city",year:684,metadata:{popularCrisisReason:"REPEATED_OCCUPATION",popularCrisisFacts:JSON.stringify({loyalty:30,devastation:57,captureCount:5,lastCapturedMonth:648,worldMonth:684,stability:30,strain:0})}});
 expect(validateResidentIdentities(s)).toEqual([]);
 for(const patch of [{targetFactionId:"rebel"},{actorFactionId:"unknown"},{year:685},{metadata:{revoltOrigin:"FAKE"}}]){
  const bad=structuredClone(s);Object.assign((bad.worldHistory.events as any[]).find(e=>e.id==="revolt"),patch);
  expect(validateResidentIdentities(bad)).toContain("ordinary founding crisis facts lack valid dated evidence");
 }
});
