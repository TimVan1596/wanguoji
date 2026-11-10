import {expect,it} from 'vitest';
import {familyChildDeathEventError} from './FamilyChildValidation';
const birth={eventId:'family-member-1-born',month:100,naturalDeathMonth:1000};
const family={familyId:'family',factionId:'qin'} as any;
const abstract={memberId:'member',bornMonth:100,deathMonth:1000,deathCause:'NATURAL_DEATH',birth} as any;
const event=(overrides:any={})=>({id:'family-member-death',year:1000,monthIndex:1000,type:'family-member-died',actorFactionId:'qin',metadata:{familyId:'family',memberId:'member',bornMonth:100,deathCause:'NATURAL_DEATH',birthEventId:'family-member-1-born',...overrides}} as any);
it('accepts only the committed abstract-child natural death event at its real event boundary',()=>{
 expect(familyChildDeathEventError(family,abstract,{...event(),id:'family-member-death'},5,2,undefined,1200)).toBeUndefined();
 for(const bad of [
  {...event(),id:'wrong'},
  {...event(),type:'military-person-died'},
  {...event(),year:999,monthIndex:999},
  {...event(),actorFactionId:'chu'},
  {...event(),metadata:{...event().metadata,memberId:'other'}},
  {...event(),metadata:{...event().metadata,birthEventId:'other'}},
  {...event(),metadata:{...event().metadata,recordedMonth:998}},
 ])expect(familyChildDeathEventError(family,abstract,bad,5,2,undefined,1200)).toBeTruthy();
 expect(familyChildDeathEventError(family,abstract,event(),2,2,undefined,1200)).toBe('invalid child death event');
});
it('requires the real military or civilian source event for a mapped child death',()=>{
 const mapped={...abstract,sourceUserId:7,militaryPersonId:'military-person-7',deathMonth:900,deathCause:'BATTLE_DEATH',birth:{...birth,naturalDeathMonth:1200}};
 const mappedEvent={...event(),year:900,monthIndex:900,metadata:{familyId:'family',memberId:'member',bornMonth:100,sourceUserId:7,deathCause:'BATTLE_DEATH'}};
 const militaryEvent={id:'military-person-death-military-person-7-900',year:900,monthIndex:900,type:'military-person-died',actorFactionId:'qin',metadata:{personId:'military-person-7',sourceUserId:7,deathCause:'BATTLE_DEATH'}} as any;
 expect(familyChildDeathEventError(family,mapped,militaryEvent,6,2,4,1200)).toBeUndefined();
 expect(familyChildDeathEventError(family,mapped,mappedEvent,6,2,4,1200)).toBe('invalid child death event');
 expect(familyChildDeathEventError(family,mapped,{...militaryEvent,metadata:{...militaryEvent.metadata,sourceUserId:8}},6,2,4,1200)).toBe('military child death identity mismatch');
 const civilian={...mapped,militaryPersonId:undefined};
 expect(familyChildDeathEventError(family,civilian,mappedEvent,6,2,4,1200)).toBeUndefined();
 expect(familyChildDeathEventError(family,{...abstract,deathMonth:undefined},undefined,undefined,2,undefined,1200)).toBe('missing actual child lifecycle death');
});
