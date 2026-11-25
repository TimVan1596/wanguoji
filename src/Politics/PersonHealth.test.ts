import {expect,it} from 'vitest';
import worldRandom from '../Simulation/WorldRandom';
import {appointmentAbilityWeight} from './AppointmentSelection';
import {appointmentHealthFactor,civilAbilitySource,familyMemberAbilitySource,militaryAbilities,personAbilities,personHealth,residentAbilitySource} from './PersonAbilities';

const source={kind:'RESIDENT' as const,sourceUserId:77,bornMonth:0};

it('has bounded constitutional differences, declines by age, and freezes at actual death',()=>{
 const state=worldRandom.exportState();
 expect(personHealth(source,-1)).toBeUndefined();
 expect(personHealth(source,30*12)).toBe(personHealth(source,49*12));
 expect(personHealth(source,60*12)!).toBeLessThan(personHealth(source,49*12)!);
 expect(personHealth(source,190*12,80*12)).toBe(personHealth(source,80*12));
 expect(personHealth(source,200*12)).toBe(0);
 expect(new Set(Array.from({length:30},(_,sourceUserId)=>personHealth({...source,sourceUserId},60*12))).size).toBeGreaterThan(5);
 expect(worldRandom.exportState()).toEqual(state);
});

it('uses the same birth relationship before and after entering the map or being appointed',()=>{
 const birth={eventId:'family-child-20-born'} as import('./FamilyChildBirth').FamilyChildBirth;
 const prior={memberId:'family-child-20',bornMonth:20,birth} as import('./MilitaryFamily').MilitaryFamilyMember;
 const member={...prior,sourceUserId:77};
 const permanent=familyMemberAbilitySource(prior)!;
 expect(residentAbilitySource(77,20,member)).toEqual(permanent);
 expect(civilAbilitySource({sourceUserId:77,bornMonth:20,familyBirthAbilityId:prior.memberId})).toEqual(permanent);
 const military=militaryAbilities({sourceUserId:77,bornMonth:20,familyLife:{familyId:'family',memberId:prior.memberId,birthEventId:birth.eventId,naturalDeathMonth:1000}});
 expect(military).toEqual(personAbilities(permanent));
 expect(personHealth(military.source,500)).toBe(personHealth(permanent,500));
});

it('prefers military aptitude conservatively and gives lower health a bounded penalty',()=>{
 const high={...personAbilities(source),command:95,strategy:30};
 const low={...high,command:30,strategy:95};
 expect(appointmentAbilityWeight(1,high,'MEDIUM',300)).toBeGreaterThan(appointmentAbilityWeight(1,low,'MEDIUM',300));
 expect(appointmentAbilityWeight(1,low,'MEDIUM',300)).toBeGreaterThan(.5);
 expect(appointmentAbilityWeight(1,high,'MEDIUM',900)).toBeLessThan(appointmentAbilityWeight(1,high,'MEDIUM',300));
 expect(appointmentHealthFactor(source,900)).toBeGreaterThanOrEqual(.92);
});
