import {expect,it} from "vitest";
import {royalMilitaryArchive,buildRoyalArchiveGenealogy,royalMilitaryOfficeLabel,militaryIdentityLabels} from "./RoyalArchiveIdentity";
import {deriveGenealogyNodePresentations} from "../UI/Components/FactionDetails/GenealogyNodePresentation";
import {indexGenealogy,genealogyWindow} from "../UI/Components/FactionDetails/genealogyWindow";
import random from "../Simulation/WorldRandom";
function fixture(){
 const parent:any={id:"king",houseName:"秦氏",givenName:"平",bornYear:-600,naturalDeathYear:900,status:"ruling",reignOrdinal:1,accessionYear:0};
 const r:any={id:"son",houseName:"秦氏",givenName:"继",parentId:"king",bornYear:-300,naturalDeathYear:900,status:"kin",militaryIdentity:{personId:"p",sourceUserId:1,sourceUserLabel:"原居民",enteredMonth:0}};
 const p:any={personId:"p",name:"原居民",personalName:"秦继",sourceUserId:1,bornMonth:-300,status:"ACTIVE",factionId:"qin",royalIdentity:{rulerId:r.id,factionId:"qin",naturalDeathMonth:900},appointments:[{commandId:"c",factionId:"qin",startMonth:0,officeHistory:[{office:"PIJIANG",month:0},{office:"JIANGJUN",month:60}]}],capturedEventIds:[]};
 const d:any={factionId:"qin",rulers:[parent,r],currentRulerId:parent.id,heirIds:[],houseName:"秦氏"};
 const events:any[]=[{id:"a",type:"military-appointment",year:0,actorFactionId:"qin",metadata:{personId:"p",royalRulerId:"son",sourceUserId:1,commandId:"c"}}];return {r,p,d,events,parent};
}
it.each(["ACTIVE","RETIRED","DEAD","SUCCESSION","DEPOSITION","DEPOSED","OLD_HOUSE"])("keeps %s military royalty in one true genealogy node without changing candidates",mode=>{
 const {r,p,d,events}=fixture();if(["RETIRED","DEAD"].includes(mode)){p.status=mode;p.appointments[0].endMonth=72;}if(mode==="DEAD"){r.status="dead";p.deathMonth=r.deathMonth=72;}
 if(["SUCCESSION","DEPOSITION","DEPOSED"].includes(mode)){r.reignOrdinal=2;r.accessionYear=72;r.accessionCause=mode==="DEPOSITION"?"DEPOSITION":"SUCCESSION";r.status=mode==="DEPOSED"?"deposed":"ruling";p.status="RETIRED";p.politicalRulerId=r.id;d.currentRulerId=r.id;}
 if(mode==="OLD_HOUSE"){d.houseName="赵氏";r.displacedByUsurpationMonth=72;}
 const before=JSON.stringify({r,p,d,events}),rng=random.exportState();const idx=indexGenealogy(buildRoyalArchiveGenealogy(d,[p],events));
 expect(idx.get("son")?.ruler).toBe(r);expect(idx.get("king")?.children.filter(n=>n.ruler.id===r.id)).toHaveLength(1);expect(d.heirIds).toEqual([]);
 expect(JSON.stringify({r,p,d,events})).toBe(before);expect(random.exportState()).toEqual(rng);
});
it.each(["birth","source","royal-id","life","event","foreign"])("rejects unverified %s bridge",mode=>{
 const {r,p,d,events}=fixture();if(mode==="birth")p.bornMonth--;if(mode==="source")p.sourceUserId++;if(mode==="royal-id")p.royalIdentity.rulerId="same-name";if(mode==="life")p.royalIdentity.naturalDeathMonth++;if(mode==="event")events.length=0;if(mode==="foreign")p.royalIdentity.factionId="wei";
 expect(royalMilitaryArchive(d,[p],events).size).toBe(0);expect(indexGenealogy(buildRoyalArchiveGenealogy(d,[p],events)).has(r.id)).toBe(false);
});
it("does not invent fathers or merge a same-surname person into another dynasty",()=>{
 const {r,p,d,events}=fixture();delete r.parentId;const tree=buildRoyalArchiveGenealogy(d,[p],events);expect(tree.map(n=>n.ruler.id)).toContain("son");expect(tree.find(n=>n.ruler.id==="king")!.children).toEqual([]);
});
it("uses actual time-specific offices and monarch themes above neutral military identity",()=>{
 const {r,p,d,events}=fixture(),f:any={name:"qin",status:"ACTIVE"};expect(royalMilitaryOfficeLabel(p,0)).toBe("现役裨将");expect(royalMilitaryOfficeLabel(p,72)).toBe("现役将军");p.status="RETIRED";expect(royalMilitaryOfficeLabel(p,72)).toBe("曾任将军");
 expect(deriveGenealogyNodePresentations(d,f,events,72).get(r.id)?.theme).toBe("neutral");r.reignOrdinal=2;r.accessionYear=60;r.status="deposed";expect(deriveGenealogyNodePresentations(d,f,events,72).get(r.id)?.theme).toBe("monarch");
 p.politicalRulerId=r.id;expect(militaryIdentityLabels(p,[d],events,72)).toEqual(["宗室将领","曾任君主","后来继位"]);
 d.currentRulerId=r.id;r.status="ruling";expect(militaryIdentityLabels(p,[d],events,72)).toContain("现任君主");
});
it.each([150,1000,10000])("indexes and locally windows all %s historical nodes iteratively",size=>{
 const rulers:any[]=Array.from({length:size},(_,i)=>({id:`r${i}`,parentId:i?`r${i-1}`:undefined,reignOrdinal:i+1,bornYear:i,accessionYear:i,houseName:"秦氏",givenName:"继"}));
 const idx=indexGenealogy(buildRoyalArchiveGenealogy({rulers,currentRulerId:`r${size-1}`,heirIds:[]} as any,[],[]));expect(idx.size).toBe(size);
 const rows=genealogyWindow(idx,`r${size-1}`,new Set());expect(rows.length).toBeLessThanOrEqual(150);expect(rows.at(-1)?.node.ruler.id).toBe(`r${size-1}`);
});
