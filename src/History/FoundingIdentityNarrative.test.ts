import {describe,it,expect} from "vitest";
import {formatFoundingIdentity} from "./FoundingIdentityNarrative";
import type {WorldEvent} from "./WorldHistory";
const event=(metadata:Record<string,string|number>):WorldEvent=>({id:"split",year:120,monthIndex:120,type:"empire-split",category:"politics",title:"分裂",importance:"major",metadata});
const facts={foundingRulerName:"邓庭宣",leaderSourceCityName:"咸阳",leaderOriginalFactionName:"楚",leaderPersonId:"person-1",foundingIdentityStage:"PROVISIONAL",foundingSovereigntyRank:"LEADER"};
describe("frozen founding identity narrative",()=>{
 it("uses frozen resident origin and an uprising seat rather than a formal capital or restoration",()=>{
  const text=formatFoundingIdentity(event(facts),"咸阳义军")!;
  expect(text).toContain("原为楚居民");expect(text).toContain("首任首领");expect(text).toContain("咸阳为起事据点");expect(text).not.toMatch(/首任君主|重新归附|正式国都/);
 });
 it("reads original office and actual partial followers, without later military or personal motives",()=>{
  const evidence={personId:"person-1",personalName:"邓庭宣",office:"JIANGJUN",participants:[{userId:1},{userId:2},{userId:3}]};
  const text=formatFoundingIdentity(event({...facts,splitSource:"MILITARY",militarySplitEvidence:JSON.stringify(evidence)}),"咸阳义军")!;
  const viewed={...event({...facts,splitSource:"MILITARY",militarySplitEvidence:JSON.stringify(evidence)}),targetFactionId:"chu"};
  expect(formatFoundingIdentity(viewed,"咸阳义军","chu")).toContain("原楚将军邓庭宣举兵叛离");expect(formatFoundingIdentity(viewed,"咸阳义军","new")).toContain("首任首领");
  expect(text).toContain("楚将军邓庭宣");expect(text).toContain("率2名旧部于咸阳起事");expect(text).not.toMatch(/上将军|野心|猜忌|居民/);
 });
 it("does not invent a founder or original homeland when frozen facts are absent",()=>{
  expect(formatFoundingIdentity(event({foundingRulerName:"邓庭宣"}),"咸阳义军")).toBeUndefined();
 });
});
