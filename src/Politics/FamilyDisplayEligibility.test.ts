import {expect,it} from 'vitest';
import {familyDisplayEligible} from './FamilyDisplayEligibility';
const family:any={factionId:'qin',epochFounderId:'epoch',members:[{memberId:'founder',militaryPersonId:'one',enteredMonth:0,bornMonth:-240,sourceUserId:1}],nobleSuccession:[{kind:'ENDED',month:120}]};
it('hides only an ended solitary charter; preserves active titles, children and any actual succession',()=>{
 const before=structuredClone(family);expect(familyDisplayEligible(family,200,[],[])).toBe(false);expect(family).toEqual(before);
 expect(familyDisplayEligible({...family,nobleSuccession:[]},200,[],[])).toBe(true);
 expect(familyDisplayEligible({...family,members:[...family.members,{enteredMonth:100,bornMonth:100,source:'HOUSEHOLD_BIRTH'}]},200,[],[])).toBe(true);
 expect(familyDisplayEligible({...family,nobleSuccession:[{kind:'SUCCEEDED',month:100},...family.nobleSuccession]},200,[],[])).toBe(true);
 expect(familyDisplayEligible(family,100,[],[])).toBe(true);
});
it('preserves genuine multi-person royal pedigree when a solitary founder became monarch',()=>{
 const people:any=[{personId:'one',politicalRulerId:'r'}],dynasties:any=[{rulers:[{id:'r',bornYear:-240},{id:'child',parentId:'r'}]}];expect(familyDisplayEligible(family,200,people,dynasties)).toBe(true);
});
