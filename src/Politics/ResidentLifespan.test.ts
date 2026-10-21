import {describe,it,expect} from "vitest";
import {createSurvivingResidentDeathMonth as death} from "./RulerLifespanRules";
describe("already surviving resident lifespan",()=>{
 for(const age of [18,40,65,88,93,120,200])it(`conditions on actual survival at ${age} without rewriting birth`,()=>{
  const spans=Array.from({length:1000},(_,i)=>death(-age*12,0,()=>Math.floor((i+.5)*0x1000000/1000)));
  expect(spans.every(m=>Number.isSafeInteger(m)&&m>0)).toBe(true);
  expect(new Set(spans).size).toBeGreaterThan(age===200?0:10);
  expect(spans.filter(m=>m===12).length).toBeLessThan(100);
  expect(spans.some(m=>m<36)).toBe(age>=65);
 });
 it("has no one-year floor or reset; exact twelve-month death can still occur naturally",()=>{
  const xs=Array.from({length:10000},(_,i)=>death(-88*12,0,()=>Math.floor((i+.5)*0x1000000/10000)));
  expect(xs.some(x=>x===1)).toBe(true);expect(xs.some(x=>x===12)).toBe(true);expect(xs.some(x=>x>60)).toBe(true);
  expect(death(-1056,100,()=>123456)).toBe(death(-1056,100,()=>123456));
 });
});
