import {expect,it} from 'vitest';
import {politicalSuccessionCandidates} from './PoliticalSuccession';
import random from '../Simulation/WorldRandom';
const person:any={personId:'civil',sourceUserId:7,bornMonth:-500,personalName:'王宗仪',factionId:'qin',status:'RETIRED',appointments:[],civilOrigin:{assignmentId:'first'}};
const term:any={personId:'civil',sourceUserId:7,bornMonth:-500,factionId:'qin',epochFounderId:'old-king',office:'YUSHI_DAFU',startMonth:0,appointEventId:'appointed',meritEventId:'merit',loyaltyRecovered:6,devastationRecovered:4};
const events:any[]=[{id:'appointed',year:0,type:'civil-governor-appointed'},{id:'merit',year:36,type:'civil-governor-merit'}];
const residents=[{id:7,bornMonth:-500,loyalty:80}],run=(p:any=person,t:any=term,e=events)=>politicalSuccessionCandidates([p],[t],e,'qin','old-king',120,'嬴氏',residents);
it('uses actual senior political service for vacant succession without inventing command or drawing world RNG',()=>{random.initialize('lawful-succession');const before=random.exportState(),row=run()[0];expect(row.source).toBe('CIVIL');expect(row.eventIds).toEqual(['appointed','merit']);expect(row.serviceMonths).toBe(120);expect(person.appointments).toEqual([]);expect(random.exportState()).toEqual(before);});
it('excludes dead, foreign, already enthroned, ordinary and unverified candidates',()=>{
 for(const p of [{...person,deathMonth:119},{...person,factionId:'chu'},{...person,politicalRulerId:'r'},{...person,bornMonth:0}])expect(run(p)).toEqual([]);
 expect(run(person,{...term,office:'XIANLING'})).toEqual([]);expect(run(person,term,events.slice(0,1))).toEqual([]);expect(politicalSuccessionCandidates([person,person],[term],events,'qin','old-king',120,'嬴氏',residents)).toEqual([]);
});
it('requires military rank evidence rather than allowing a title to invent a former army',()=>{
 const p={...person,appointments:[{commandId:'c',factionId:'qin',startMonth:0,endMonth:100,officeHistory:[{eventId:'rank',month:60,office:'JIANGJUN'}]}]},e:any[]=[{id:'military-appointment-c',year:0},{id:'rank',year:60}];
 expect(politicalSuccessionCandidates([p],[],e,'qin','old-king',120,'嬴氏',residents)[0].source).toBe('MILITARY');expect(politicalSuccessionCandidates([p],[],[],'qin','old-king',120,'嬴氏',residents)).toEqual([]);
});
