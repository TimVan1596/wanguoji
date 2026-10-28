import {it,expect} from 'vitest';
import {appanageChanges,appanageEndReason,type MilitaryAppanage} from './MilitaryAppanage';
import type {MilitaryPerson} from './MilitaryCommandRegistry';
import type {WorldEvent} from '../History/WorldHistory';
const p={personId:'p',politicalRulerId:'r',royalIdentity:undefined} as MilitaryPerson;
const g={eventId:'g',grantEventId:'g',kind:'GRANTED',personId:'p',factionId:'home',epochFounderId:'king',cityId:'town',month:12,sourceEventId:'capture'} as MilitaryAppanage;
const event=(type:string,id:string,fields:any={})=>({id,type,year:13,monthIndex:13,...fields}) as WorldEvent;
it('preserves actual same-month loss and recovery, and never generates a second grant',()=>{
 const events=[event('military-appanage','g'),event('city-captured','loss',{cityId:'town',actorFactionId:'enemy'}),event('city-revolt','back',{cityId:'town',actorFactionId:'home'})];
 const changes=appanageChanges(p,g,events,13);expect(changes.map(a=>a.kind)).toEqual(['LOST','RESTORED']);expect(changes.map(a=>a.sourceEventId)).toEqual(['loss','back']);expect(appanageChanges(p,changes[1],events,13)).toEqual([]);
});
it('orders death, succession, transfer, revocation, dynasty end, state end and destruction by their real original facts',()=>{
 for(const [e,reason] of [[event('military-person-died','death',{metadata:{personId:'p'}}),'DEATH'],[event('ruler-acceded','accession',{rulerId:'r'}),'ACCESSION'],[event('military-command-ended','transfer',{actorFactionId:'home',metadata:{personId:'p',endReason:'TRANSFERRED'}}),'TRANSFER'],[event('military-title-revoked','revoked',{metadata:{personId:'p',honor:JSON.stringify({factionId:'home',epochFounderId:'king'})}}),'TITLE_REVOKED'],[event('dynasty-usurped','newhouse',{actorFactionId:'home',rulerId:'other'}),'DYNASTY_ENDED'],[event('faction-exiled','exile',{targetFactionId:'home'}),'STATE_ENDED'],[event('city-destroyed','destroyed',{cityId:'town'}),'CITY_DESTROYED']] as const){expect(appanageEndReason(g,p,e)).toBe(reason);const changes=appanageChanges(p,g,[event('military-appanage','g'),e],13);expect(changes[0].reason).toBe(reason);expect(appanageChanges(p,changes[0],[e],14)).toEqual([]);}
});
it('ordinary retirement, orders, foreign city battles and another ruler’s legitimate succession do not end or restore an estate',()=>{
 for(const e of [event('military-command-ended','retire',{metadata:{personId:'p',endReason:'AGE_RETIREMENT'}}),event('military-order-issued','order'),event('city-captured','elsewhere',{cityId:'other'}),event('ruler-succession','otherking',{metadata:{nextRulerId:'other'}})])expect(appanageChanges(p,g,[event('military-appanage','g'),e],13)).toEqual([]);
 expect(appanageChanges(p,g,[event('military-appanage','g'),event('city-captured','future',{cityId:'town',actorFactionId:'enemy',monthIndex:14})],13)).toEqual([]);
});
