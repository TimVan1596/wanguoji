import {expect,it} from 'vitest';
import {validStewardshipWindow,civilRetirementEvidence,civilPromotionChance} from './CivilCareerRules';
import {civilPromotionEvidence} from './CivilPromotion';
import {personAbilities} from './PersonAbilities';
import worldRandom from '../Simulation/WorldRandom';
const id=Array.from({length:100},(_,i)=>i+1).find(sourceUserId=>personAbilities({kind:'RESIDENT',sourceUserId,bornMonth:-240}).strategy>=80)!;
const term:any={office:'XIANLING',assignmentId:'real-term',personId:'p',sourceUserId:id,bornMonth:-240,startMonth:0,factionId:'qin',receipts:[]};
const window=(start:number)=>({cityId:'city',cityName:'城',controlledSince:0,samples:Array.from({length:36},(_,i)=>({month:start+i,loyalty:80,devastation:0,historyIndex:i+1}))});
it('peaceful service needs a continuous observed period, not high ability or elapsed time alone',()=>{
 expect(civilPromotionEvidence(term,120,100,2,[])).toBeUndefined();const w=window(1);expect(validStewardshipWindow(w,0,36)).toBe(true);expect(validStewardshipWindow({...w,samples:w.samples.filter(s=>s.month!==18)},0,36)).toBe(false);expect(validStewardshipWindow({...w,samples:w.samples.map(s=>s.month===18?{...s,loyalty:60}:s)},0,36)).toBe(false);
 const assessments=[36,72].map((month,i)=>({...window(i*36+1),month,eventId:'assessment-'+month,contribution:1.5}));
 expect(civilPromotionEvidence({...term,stewardshipAssessments:assessments.slice(0,1)},72,100,2,[])).toBeUndefined();const e=civilPromotionEvidence({...term,stewardshipAssessments:assessments},72,100,2,[])!;expect(e.stewardshipEventIds).toEqual(['assessment-36','assessment-72']);expect(e.contribution).toBe(3);expect(e.meritEventIds).toEqual([]);expect(term.receipts).toEqual([]);
 expect(civilPromotionEvidence({...term,office:'JUNSHOU',stewardshipAssessments:assessments},144,100,4,[])).toBeUndefined();
});
it('retirement is a named bounded evaluation, preserves life and RNG, and permits retention',()=>{
 worldRandom.initialize('retirement-proof');const state=worldRandom.exportState(),t={...term,bornMonth:-780};
 const a=civilRetirementEvidence(t,60,'same-world','LOW')!;expect(a.ageMonths).toBe(840);expect(a.chance).toBe(.12);expect(a).toEqual(civilRetirementEvidence(t,60,'same-world','LOW'));expect(civilRetirementEvidence(t,60,'same-world','BASELINE')).toBeUndefined();expect(civilRetirementEvidence({...t,endMonth:60},60,'same-world','LOW')).toBeUndefined();expect(civilRetirementEvidence({...t,bornMonth:-600},60,'same-world','LOW')).toBeUndefined();expect(worldRandom.exportState()).toEqual(state);expect(civilPromotionChance('LOW')).toBe(.35);expect(civilPromotionChance('MEDIUM')).toBe(.25);
});
