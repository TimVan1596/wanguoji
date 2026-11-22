import {expect,it} from 'vitest';
import {civilCrossCareerEvidence} from './CrossCareerCompetition';
it('requires an actual ended military service and never invents governance credit or changes permanent abilities',()=>{
 const t:any={personId:'p',sourceUserId:7,bornMonth:-300,startMonth:100},p:any={personId:'p',sourceUserId:7,bornMonth:-300,appointments:[{commandId:'c',startMonth:0,endMonth:60,endReason:'AGE_RETIREMENT'}]},events:any[]=[{id:'military-appointment-c',type:'military-appointment',year:0,metadata:{personId:'p'}},{id:'military-command-ended-c',type:'military-command-ended',year:60,metadata:{personId:'p'}}];
 expect(['BASELINE','LOW','MEDIUM'].map(policy=>civilCrossCareerEvidence(t,p,events,policy as any).multiplier)).toEqual([1,1.05,1.1]);expect(civilCrossCareerEvidence(t,p,[]).multiplier).toBe(1);expect(civilCrossCareerEvidence(t,{...p,sourceUserId:8},events).multiplier).toBe(1);expect(civilCrossCareerEvidence(t,{...p,appointments:[{...p.appointments[0],endMonth:120}]},events).multiplier).toBe(1);
});
