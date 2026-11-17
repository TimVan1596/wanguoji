import {afterEach,expect,it} from 'vitest';
import {generateResidentPersonalName,splitEstablishedPersonalName,type NameCulture} from './NameCulture';
import {civilPopulationIdentity,emptyCivilState,replaceCivilState} from './CivilCareerIdentity';
import {residentNaturalDeathMonth} from '../Simulation/ResidentLife';
import {deriveMilitaryLifeSchedule} from './MilitaryLifeRules';
import random from '../Simulation/WorldRandom';
afterEach(()=>replaceCivilState(emptyCivilState()));
it.each<NameCulture>(['HAN','KHITAN','JURCHEN','MONGOL','MANCHU'])('freezes a full %s name independently of military sequences and main RNG',culture=>{
 const before=random.exportState(),input={seed:'z62',sourceUserId:1000000012,bornMonth:-240,culture},name=generateResidentPersonalName(input);
 expect(name).not.toMatch(/-\d/);expect(generateResidentPersonalName(JSON.parse(JSON.stringify(input)))).toBe(name);
 const parts=splitEstablishedPersonalName(name)!;expect(parts.houseName.replace(/氏$/,'')+parts.givenName).toBe(name);expect(random.exportState()).toEqual(before);
});
it('keeps equal user IDs with distinct birth identities separate and survives JSON hydration',()=>{
 const state=emptyCivilState();state.terms=[{sourceUserId:1,bornMonth:12,personId:'a',personalName:'欧阳承远'},{sourceUserId:1,bornMonth:24,personId:'b',personalName:'耶律药师奴'}] as any;
 replaceCivilState(JSON.parse(JSON.stringify(state)));expect(civilPopulationIdentity(1,12)?.personId).toBe('a');expect(civilPopulationIdentity(1,24)?.personId).toBe('b');expect(civilPopulationIdentity(2,12)).toBeUndefined();
});
it('preserves ordinary population natural lifespan on first military appointment',()=>{
 const naturalDeathMonth=residentNaturalDeathMonth(1,-240);expect(deriveMilitaryLifeSchedule({personId:'resident-1--240',bornMonth:-240,civilOrigin:{naturalDeathMonth}}).naturalDeathMonth).toBe(naturalDeathMonth);
});
