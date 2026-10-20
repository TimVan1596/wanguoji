import {describe,it,expect} from "vitest";
import {validateRulerLifeRecord} from "./RulerLifeValidation";
describe("deposition accession remains a historical cause after later political endings",()=>{
 const snapshot=(month:number)=>({month,population:4,territoryShare:.2,cityCount:1,stability:30});
 const ruler={rulerId:"successor",bornMonth:-240,accessionMonth:12,accessionCause:"DEPOSITION",reignOrdinal:2,endMonth:120,politicalEndMonth:120,chronicle:{accessionSnapshot:snapshot(12),latestSnapshot:snapshot(120),endSnapshot:snapshot(120),notableEventIds:[]}};
 it.each(["合邦退位","纳土退位"])("accepts a later living abdication: %s",endReason=>{
  expect(validateRulerLifeRecord({...ruler,status:"abdicated",endReason},130)).toEqual([]);
 });
 it("accepts later political termination without inventing death",()=>{
  expect(validateRulerLifeRecord({...ruler,status:"politically-ended",endReason:"政治终结"},130)).toEqual([]);
 });
 it("still rejects a non-office status and missing accession proof",()=>{
  expect(validateRulerLifeRecord({...ruler,status:"kin"},130)).toContain("ruler successor: invalid deposition accession");
  expect(validateRulerLifeRecord({...ruler,status:"politically-ended",endReason:"政治终结",accessionMonth:undefined},130)).toContain("ruler successor: invalid deposition accession");
 });
});
