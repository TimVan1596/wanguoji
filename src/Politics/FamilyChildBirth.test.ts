import {expect,it} from 'vitest';
import {planFamilyChildBirth} from './FamilyChildBirth';
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
