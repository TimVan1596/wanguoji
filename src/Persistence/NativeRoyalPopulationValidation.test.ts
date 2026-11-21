import {expect,it} from 'vitest';
import {validateNativeRoyalPopulation} from './NativeRoyalPopulationValidation';
import {getRulerUserId} from '../Politics/RoyalPopulationIdentity';
it('requires the current native crown to use its permanent population identity even if both ID and marker were forged',()=>{
 const save:any={world:{worldMonth:120},dynasties:[{factionId:'齐',currentRulerId:'king',rulers:[{rulerId:'king',houseName:'田氏',givenName:'绍',bornMonth:-600,accessionMonth:0,reignOrdinal:1,status:'ruling'}]}],users:[{userId:getRulerUserId('king'),nativeRoyalRulerId:'king',bornMonth:-600,role:'RULER',rulerId:'king'}]};
 expect(validateNativeRoyalPopulation(save)).toEqual([]);
 const bad=structuredClone(save);delete bad.users[0].nativeRoyalRulerId;bad.users[0].userId=42;bad.users[0].bornMonth=-300;expect(validateNativeRoyalPopulation(bad)).toContain('invalid native royal permanent population identity');
});
