import {expect,it} from 'vitest';
import {personOfficeSummary} from './PersonOfficeSummary';
const person:any={bornMonth:-552,status:'DEAD',deathMonth:216,deathCause:'BATTLE_DEATH',factionId:'燕',appointments:[{factionId:'燕',commandId:'one',startMonth:180,endMonth:216,endReason:'DEATH',officeHistory:[{month:180,office:'XIAOWEI'}]}]};
it('shows real birth, lifespan, last local office and battle death without calling it retirement',()=>{
 const r=personOfficeSummary({person,terms:[],factionId:'燕',month:1000});expect(r.age).toContain('享年64岁');expect(r.age).toContain('纪元前46年1月');expect(r.age).toContain('18年1月');expect(r.office).toBe('校尉');expect(r.state).toBe('战死');expect(r.active).toBe(false);expect(r.tenure).toContain('15年1月');
});
it('uses actual current civil office after military retirement and preserves both careers',()=>{
 const p={...person,status:'RETIRED',deathMonth:undefined,deathCause:undefined};const terms:any[]=[{factionId:'燕',cityName:'蓟',bornMonth:p.bornMonth,startMonth:300}];const r=personOfficeSummary({person:p,terms,factionId:'燕',month:408,knownAlive:true});expect(r.office).toBe('蓟郡守');expect(r.kind).toBe('文官');expect(r.tenure).toContain('在任9年');expect(r.tenure).toContain('15年1月初任');expect(r.age).toContain('现年80岁');expect(r.state).toBe('在任');
});
it('does not infer death, current service or a later foreign rank from missing population',()=>{
 const p={...person,status:'RETIRED',deathMonth:undefined,appointments:[...person.appointments,{factionId:'楚',startMonth:400,officeHistory:[{month:400,office:'SHANGJIANGJUN'}]}],factionId:'楚'};const r=personOfficeSummary({person:p,terms:[],factionId:'燕',month:500});expect(r.age).toContain('年龄未载');expect(r.office).toBe('校尉');expect(r.state).toBe('已转属');expect(r.active).toBe(false);expect(r.tenure).not.toContain('今');
});
