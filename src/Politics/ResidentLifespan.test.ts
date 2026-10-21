import {describe,it,expect} from "vitest";
import {createSurvivingResidentDeathMonth as death} from "./RulerLifespanRules";
describe("already surviving resident lifespan",()=>{
 for(const age of [18,40,65,88,93,120,200])it(`conditions on actual survival at ${age} without rewriting birth`,()=>{
  const spans=Array.from({length:1000},(_,i)=>death(-age*12,0,max=>Math.floor((i+.5)*max/1000)));
  expect(spans.every(m=>Number.isSafeInteger(m)&&m>0)).toBe(true);
  if(age>=120)expect(Math.max(...spans)).toBeLessThan(12); // Extreme age is not granted another year.
  else expect(new Set(spans).size).toBeGreaterThan(10);
  expect(spans.filter(m=>m===12).length).toBeLessThan(100);
  expect(spans.some(m=>m<36)).toBe(age>=65);
 });
 it("has no one-year floor or reset; exact twelve-month death can still occur naturally",()=>{
  const xs=Array.from({length:10000},(_,i)=>death(-88*12,0,max=>Math.floor((i+.5)*max/10000)));
  expect(xs.some(x=>x===1)).toBe(true);expect(xs.some(x=>x===12)).toBe(true);expect(xs.some(x=>x>60)).toBe(true);
  expect(death(-1056,100,max=>Math.floor(max*.123456))).toBe(death(-1056,100,max=>Math.floor(max*.123456)));
 });
 it("retains the original two draw bounds instead of consuming an extra lottery",()=>{
  const bounds:number[]=[];
  death(-1056,0,max=>{bounds.push(max);return bounds.length===1?50:3;});
  expect(bounds).toEqual([100,20]);
 });
});
