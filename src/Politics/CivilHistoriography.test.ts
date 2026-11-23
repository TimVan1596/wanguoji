import {expect,it} from 'vitest';
import {civilCareerReading} from './CivilHistoriography';
it('uses dated real recoveries and assessments, never high strategy, future achievements or imaginary public affection',()=>{
 const term:any={office:'XIANLING',startMonth:0,cityName:'城',receipts:[{month:12,loyalty:1,devastation:1},{month:120,loyalty:1,devastation:1}],stewardshipAssessments:[{month:36}],endMonth:180,endReason:'RETIREMENT'};
 const p:any={strategy:100,appointments:[],nobilityHistory:[],politicalHistory:[]},before=JSON.stringify({term,p}),early=civilCareerReading([term],p,24),late=civilCareerReading([term],p,180);
 expect(early.assessment.join('')).toContain('贡献2点');expect(early.assessment.join('')).not.toMatch(/守成考课|致仕|百姓爱戴|忠贞|才能卓著/);expect(late.assessment.join('')).toContain('致仕');expect(late.assessment.join('')).toContain('1次守成考课');expect(JSON.stringify({term,p})).toBe(before);
});
