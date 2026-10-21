import {it,expect} from "vitest";
import {resolvePersonArchiveTarget as resolve} from "./PersonArchiveTarget";
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
