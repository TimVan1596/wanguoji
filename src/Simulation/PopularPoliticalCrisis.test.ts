import {expect,it} from 'vitest';
import {evaluatePopularPoliticalCrisis as assess,type PopularCrisisFacts} from './PopularPoliticalCrisis';
const f:PopularCrisisFacts={loyalty:35,devastation:75,captureCount:1,lastCapturedMonth:0,worldMonth:12,stability:90,strain:0};
it('reaches a dated severe local postwar crisis without requiring national collapse or a new draw',()=>{const before=JSON.stringify(f);expect(assess(f)).toEqual({eligible:true,reason:'SEVERE_WAR_DAMAGE'});expect(JSON.stringify(f)).toBe(before);});
it.each([{worldMonth:2},{worldMonth:11},{lastCapturedMonth:undefined},{lastCapturedMonth:20},{loyalty:70},{devastation:20}])('does not turn a new occupation or undamaged city into an automatic rebellion: %j',change=>{expect(assess({...f,...change})).toMatchObject({eligible:false});});
it('requires real repeated occupation or unresolved country crisis for the lesser damage paths',()=>{
 expect(assess({...f,devastation:50,captureCount:2}).reason).toBe('REPEATED_OCCUPATION');expect(assess({...f,devastation:50,captureCount:1}).eligible).toBe(false);
 expect(assess({...f,devastation:35,worldMonth:24,stability:55}).reason).toBe('UNRESOLVED_POSTWAR_CRISIS');expect(assess({...f,devastation:35,worldMonth:23,stability:55}).eligible).toBe(false);
});
it('preserves the original low-loyalty crisis and refuses a quiet city despite its old capture count',()=>{
 expect(assess({...f,loyalty:20,devastation:0,stability:50,lastCapturedMonth:undefined}).reason).toBe('ORIGINAL_CRISIS');expect(assess({...f,loyalty:95,captureCount:100}).eligible).toBe(false);
});
