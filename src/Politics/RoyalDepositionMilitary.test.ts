import {expect,it} from "vitest";
import {deriveRoyalDepositionMilitary,royalCommandAdvantage} from "./RoyalDepositionMilitary";
import {deriveMilitaryPoliticalInfluence} from "./MilitaryPoliticalInfluence";
import {evaluateDepositionOpportunity,chooseDepositionClaimant} from "./InReignDeposition";
import {validDepositionSelection} from "../Persistence/DepositionSelectionValidation";
import random from "../Simulation/WorldRandom";

function fixture(){
 const input:Parameters<typeof deriveRoyalDepositionMilitary>[0]={factionId:"qin",month:72,rulers:[{id:"son",houseName:"秦氏",givenName:"继",bornYear:-300,naturalDeathYear:900,status:"heir",parentId:"king",militaryIdentity:{personId:"person",sourceUserId:1,sourceUserLabel:"原居民",enteredMonth:0}}],
 people:[{personId:"person",sourceUserId:1,name:"原居民",personalName:"秦继",bornMonth:-300,factionId:"qin",status:"ACTIVE",royalIdentity:{rulerId:"son",factionId:"qin",naturalDeathMonth:900},appointments:[{factionId:"qin",startMonth:0,commandId:"command",officeHistory:[{month:0,office:"PIJIANG",eventId:"office"} as any]}],capturedEventIds:["capture"]}],
 formations:[{commandId:"command",factionId:"qin",commanderPersonId:"person",createdMonth:0,status:"ACTIVE",memberUnitIds:["unit-1","unit-2","unit-3","unit-4"],captures:[{eventId:"capture",cityId:"town",month:24}]}],
 users:[1,2,3,4].map(id=>({userId:id,name:id===1?"原居民":`居民${id}`,bornMonth:-300,factionId:"qin",unitId:`unit-${id}`,personId:id===1?"person":undefined,liveBindingVerified:true})),
 events:[{id:"appointment",type:"military-appointment",year:0,actorFactionId:"qin",metadata:{personId:"person",commandId:"command"}},{id:"office",type:"military-office-granted",year:0,actorFactionId:"qin",metadata:{personId:"person",commandId:"command",office:"PIJIANG"}},{id:"capture",type:"city-captured",year:24,actorFactionId:"qin",targetFactionId:"wei",cityId:"town",metadata:{commandId:"command",commanderPersonId:"person",wasCapital:0}}] as any,influence:{candidates:[],blocked:[],identityBlocked:0}};
 return input;
}
function derive(i:ReturnType<typeof fixture>){i.influence=deriveMilitaryPoliticalInfluence({...i,worldMonth:i.month,status:"ACTIVE",identityStage:"STATE"});return deriveRoyalDepositionMilitary(i);}
it("requires own verified command and real victory, freezes exact members without RNG",()=>{
 const before=random.exportState(),i=fixture(),proof=derive(i)[0];expect(proof).toMatchObject({rulerId:"son",office:"PIJIANG",victories:[{cityId:"town"}]});expect(proof.members).toHaveLength(4);expect(random.exportState()).toEqual(before);
 i.people[0].capturedEventIds=[];expect(derive(i)).toEqual([]);
});
it.each(["retired","dead","foreign","birth","wrong-ruler","wrong-source","ordinary-general","missing-user","invalid-member","duplicate-member","shared-member","lost-command","missing-office","fake-capture","minor","politically-ended"])("refuses %s for own command weighting",mode=>{
 const i=fixture(),p=i.people[0],r=i.rulers[0];
 if(mode==="retired")p.status="RETIRED";if(mode==="dead"){p.status="DEAD";r.deathMonth=60;}if(mode==="foreign")p.factionId="wei";
 if(mode==="birth")r.bornYear--;if(mode==="wrong-ruler")p.royalIdentity!.rulerId="another";if(mode==="wrong-source")r.militaryIdentity!.sourceUserId++;
 if(mode==="ordinary-general")delete p.royalIdentity;if(mode==="missing-user")i.users.shift();if(mode==="invalid-member")i.users[3].liveBindingVerified=false;
 if(mode==="duplicate-member")i.formations[0].memberUnitIds.push("unit-4");if(mode==="shared-member")i.formations.push({...i.formations[0],commandId:"second",commanderPersonId:"other",memberUnitIds:["unit-4"]});
 if(mode==="lost-command")i.formations[0].status="DISBANDED";if(mode==="missing-office")i.events=i.events.filter(e=>e.id!=="office");if(mode==="fake-capture")i.events.find(e=>e.id==="capture")!.metadata!.commanderPersonId="other";
 if(mode==="minor")r.bornYear=0;if(mode==="politically-ended")r.status="abdicated";
 expect(derive(i)).toEqual([]);
});
it("caps city and size contribution and never grows from repeated same-city captures",()=>{
 expect(royalCommandAdvantage(12,1000)).toBe(.25);expect(royalCommandAdvantage(12,0)).toBe(0);
 const i=fixture();for(let n=0;n<20;n++){const id=`repeat-${n}`;i.people[0].capturedEventIds.push(id);i.events.push({...i.events[2],id,year:25+n});i.formations[0].captures.push({eventId:id,cityId:"town",month:25+n});}
 expect(derive(i)[0].advantage).toBeCloseTo(.15);expect(derive(i)[0].victories).toHaveLength(1);
});
it("changes only existing successful selection with bounded influence, no extra draw or chance",()=>{
 const i=fixture(),king:any={id:"king",houseName:"秦氏",givenName:"平",bornYear:-600,naturalDeathYear:900,status:"ruling",accessionYear:0};
 const second={...i.rulers[0],id:"second",givenName:"次",militaryIdentity:undefined};
 const rulers=[king,...i.rulers,second],e=evaluateDepositionOpportunity({factionId:"qin",status:"ACTIVE",identityStage:"STATE",cityCount:1,stability:20,currentRuler:king,rulers,houseName:"秦氏",worldMonth:72,events:[{id:"loss",type:"capital-fallen",year:70,targetFactionId:"qin",historyGroupId:"loss"} as any]});
 const before=random.exportState(),weighted={...e,royalMilitaryClaims:derive(i)};
 const n=10000,count=(v:typeof e)=>Array.from({length:n},(_,k)=>chooseDepositionClaimant(v,72,e.probability*(k+.5)/n)!).filter(c=>c.claimant.ruler.id==="son").length/n;
 expect(e.probability).toBe(.005);expect(weighted.probability).toBe(e.probability);expect(count(e)).toBe(.5);expect(count(weighted)).toBeCloseTo(1.15/2.15,3);expect(count(weighted)).toBeLessThan(.56);
 expect(chooseDepositionClaimant(weighted,72,e.probability)).toBeUndefined();expect(random.exportState()).toEqual(before);
 const choice=chooseDepositionClaimant(weighted,72,0)!;expect(validDepositionSelection(JSON.stringify(choice.evidence),rulers,"king",choice.claimant.ruler.id,72)).toBe(true);
 choice.evidence.candidates[0].weight++;expect(validDepositionSelection(JSON.stringify(choice.evidence),rulers,"king",choice.claimant.ruler.id,72)).toBe(false);
});
