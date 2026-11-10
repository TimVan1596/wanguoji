import {expect,it} from 'vitest';
import {familyBirthParents,planFamilyChildBirth} from './FamilyChildBirth';
import random from '../Simulation/WorldRandom';
const family={familyId:'family-real-charter',surname:'傅',factionId:'qin',epochFounderId:'king',foundedMonth:12},parent={memberId:'father',bornMonth:-300,enteredMonth:12,basisEventId:'real-grant'};
it('plans only an actual current birth with no population ID, military identity or world RNG use',()=>{
 random.initialize('family-test');const before=random.exportState();let child:ReturnType<typeof planFamilyChildBirth>;for(let m=12;m<=300&&!child;m++)child=planFamilyChildBirth(family,parent,m,'fixed','HIGH');expect(child).toBeDefined();expect(child!.bornMonth).toBe(child!.birth.month);expect(child!.enteredMonth).toBe(child!.birth.month);expect(child!.parentMemberId).toBe(parent.memberId);expect(child).not.toHaveProperty('sourceUserId');expect(child).not.toHaveProperty('militaryPersonId');expect(child!.birth.naturalDeathMonth).toBeGreaterThan(child!.bornMonth);expect(planFamilyChildBirth(family,parent,child!.bornMonth,'fixed','HIGH')).toEqual(child);expect(random.exportState()).toEqual(before);
});
it('cannot backdate a pre-charter, pre-registration or post-death child',()=>{
 for(let m=12;m<360;m++){expect(planFamilyChildBirth({...family,foundedMonth:400},parent,m,'fixed','HIGH')).toBeUndefined();expect(planFamilyChildBirth(family,{...parent,enteredMonth:400},m,'fixed','HIGH')).toBeUndefined();expect(planFamilyChildBirth(family,{...parent,deathMonth:m},m,'fixed','HIGH')).toBeUndefined();}
});
it('uses one annual ticket and one delivery month, with distinct identities and bounded calibrated chances',()=>{
 const totals={LOW:0,MEDIUM:0,HIGH:0},months=new Set<number>();
 for(let i=0;i<2000;i++)for(const policy of ['LOW','MEDIUM','HIGH'] as const){let annual=0;for(let m=12;m<24;m++){const child=planFamilyChildBirth(family,{...parent,memberId:'father-'+i},m,'fixed',policy);if(child){annual++;totals[policy]++;months.add(m%12);}}expect(annual).toBeLessThanOrEqual(1);}
 expect(months.size).toBe(12);expect(totals.LOW).toBeLessThan(totals.MEDIUM);expect(totals.MEDIUM).toBeLessThan(totals.HIGH);expect(totals.HIGH).toBeLessThan(300);
});
it('bounds new biological opportunities without changing already registered adult kin',()=>{
 for(const born of [-700,0,100])for(let m=12;m<=240;m++){
  const result=planFamilyChildBirth(family,{...parent,bornMonth:born},m,'fixed','HIGH');
  if(result){expect(m-born).toBeGreaterThanOrEqual(240);expect(m-born).toBeLessThanOrEqual(660);}
 }
});
it('requires a current sourced parent and bounds parent, spacing and living-family growth',()=>{
 const father:any={memberId:'father',name:'傅父',bornMonth:0,enteredMonth:0,generation:0,source:'FOUNDER',militaryPersonId:'officer'};
 const f:any={...family,foundedMonth:0,members:[father]};
 const person:any={personId:'officer',factionId:'qin',status:'ACTIVE',appointments:[],nobilityHistory:[{eventId:'grant',month:12,rank:'BO',factionId:'qin',epochFounderId:'king'}]};
 const events:any[]=[{id:'grant',year:12,type:'military-ennobled'}];
 const c=(month=300):any=>({month,people:[person],events,activeEpochs:new Set(['qin/king']),politicalAccessions:new Map()});
 expect(familyBirthParents(f,c()).map(p=>p.member.memberId)).toEqual(['father']);
 f.members.push({memberId:'one',name:'傅一',parentMemberId:'father',bornMonth:100,enteredMonth:100,generation:1,source:'HOUSEHOLD_BIRTH'},{memberId:'two',name:'傅二',parentMemberId:'father',bornMonth:220,enteredMonth:220,generation:1,source:'HOUSEHOLD_BIRTH'});
 expect(familyBirthParents(f,c())).toEqual([]);
 f.members=[father,{...f.members[1],enteredMonth:288}];expect(familyBirthParents(f,c())).toEqual([]);
 f.members=[father,...Array.from({length:8},(_,i)=>({memberId:`living-${i}`,name:`傅${i}`,parentMemberId:'father',bornMonth:-i-1,enteredMonth:0,generation:1,source:'HOUSEHOLD_BIRTH'}))];expect(familyBirthParents(f,c())).toEqual([]);
 f.members=[father];father.deathMonth=299;expect(familyBirthParents(f,c())).toEqual([]);
 delete father.deathMonth;person.nobilityHistory=[];expect(familyBirthParents(f,c())).toEqual([]);
});
