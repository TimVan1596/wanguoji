import {expect,it} from 'vitest';
import {planFamilyPopulationEntry,createFamilyKinIndex,familyGenerationsSinceMerit,type MilitaryFamily} from './MilitaryFamily';
import {legacyFamilyPopulationEntry} from './LegacyFamilyPopulationEntry.fixture';
import rng from '../Simulation/WorldRandom';
function houses():MilitaryFamily[]{return ['z','a','b'].map((key,house)=>{
 const members:MilitaryFamily['members']=[];
 for(let depth=0;depth<4;depth++)for(let i=0;i<2**depth;i++){
  const bornMonth=depth*300-900+i*24;
  members.push({memberId:`${key}-${depth}-${i}`,sourceUserId:house*100+members.length+1,name:`张${i}`,bornMonth,generation:depth,enteredMonth:Math.max(24,bornMonth+240),source:depth?'NATURAL_GROWTH':'FOUNDER',...(depth?{parentMemberId:`${key}-${depth-1}-${Math.floor(i/2)}`}:{})});
 }
 return {familyId:key,surname:'张',founderPersonId:`p-${key}`,factionId:house===2?'other':'qin',epochFounderId:'epoch',foundedMonth:24,sourceEventId:`source-${key}`,members};
 });}
it('matches the frozen z55 planner across identities, ages, deaths, exits and renewed branches',()=>{
 const families=houses(),state=rng.exportState();families[0].members.at(-1)!.deathMonth=650;families[1].members.at(-2)!.exitMonth=600;families[0].renewals=[{memberId:families[0].members[1].memberId,month:900,sourceEventId:'new-merit'}];
 const before=structuredClone(families);let accepted=0;
 for(let id=1000;id<2200;id++){const args=[families,'qin',id%17?'epoch':'foreign',id,180+id%540,720+id%500,'fixed-index-equivalence'] as const;const actual=planFamilyPopulationEntry(...args);expect(actual).toEqual(legacyFamilyPopulationEntry(...args));if(actual)accepted++;}
 expect(accepted).toBeGreaterThan(20);expect(families).toEqual(before);expect(rng.exportState()).toEqual(state);
});
it('rebuilds structural indexes at each boundary, including replaced parents and appended children',()=>{
 const f=houses()[0],parent=f.members.at(-1)!;expect(createFamilyKinIndex(f).children.get(parent.memberId)).toBeUndefined();
 const child={...parent,memberId:'new-child',sourceUserId:99999,parentMemberId:parent.memberId,bornMonth:parent.bornMonth+300,generation:4};f.members.push(child);expect(createFamilyKinIndex(f).children.get(parent.memberId)).toEqual([child]);
 child.parentMemberId=f.members[0].memberId;expect(createFamilyKinIndex(f).children.get(parent.memberId)).toBeUndefined();
 f.renewals=[{memberId:parent.memberId,month:900,sourceEventId:'new'}];expect(familyGenerationsSinceMerit(f,parent,899,createFamilyKinIndex(f))).toBe(3);expect(familyGenerationsSinceMerit(f,parent,900,createFamilyKinIndex(f),new Set([parent.memberId]))).toBe(0);
});
