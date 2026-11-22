import {it,expect} from "vitest";
import {familyMemberArchiveTarget,resolvePersonArchiveTarget as resolve} from "./PersonArchiveTarget";
const factions=[{name:"extinct",status:"EXTINCT"},{name:"current",status:"ACTIVE"}];
const dynasties=[{factionId:"extinct",rulers:[{id:"r-old",reignOrdinal:1},{id:"kin"}]}];
const people=[{personId:"p",appointments:[{factionId:"extinct"},{factionId:"current"}]}];
it("opens stable IDs in extinct historical countries without requiring current office",()=>{
 expect(resolve({kind:"RULER",factionId:"extinct",id:"r-old"},factions,dynasties,people)?.tab).toBe("house");
 expect(resolve({kind:"MILITARY",factionId:"extinct",id:"p"},factions,dynasties,people)?.tab).toBe("military");
});
it("rejects name matching, foreign IDs, unenthroned kin and missing countries",()=>{
 for(const t of [{kind:"RULER" as const,factionId:"current",id:"r-old"},{kind:"RULER" as const,factionId:"extinct",id:"kin"},{kind:"MILITARY" as const,factionId:"extinct",id:"same-name"},{kind:"MILITARY" as const,factionId:"missing",id:"p"}])expect(resolve(t,factions,dynasties,people)).toBeUndefined();
});

it('routes a permanent family identity by actual royal, civil and military careers, never by title or name',()=>{
 const row:any={member:{name:'某王同名',memberId:'member'},person:{personId:'p'},appointments:[],civilTerms:[]};
 expect(familyMemberArchiveTarget(row)).toBeUndefined();row.inherited={rank:'GONG'};expect(familyMemberArchiveTarget(row)).toBeUndefined();
 row.civilTerms=[{personId:'p',factionId:'foreign',startMonth:100}];expect(familyMemberArchiveTarget(row)).toEqual({kind:'CIVIL',factionId:'foreign',id:'p'});
 row.appointments=[{factionId:'home',startMonth:90}];expect(familyMemberArchiveTarget(row)?.kind).toBe('CIVIL');row.appointments[0].startMonth=101;expect(familyMemberArchiveTarget(row)).toEqual({kind:'MILITARY',factionId:'home',id:'p'});
 row.political={factionId:'new-house',r:{id:'actual-monarch'}};expect(familyMemberArchiveTarget(row)).toEqual({kind:'RULER',factionId:'new-house',id:'actual-monarch'});
});
