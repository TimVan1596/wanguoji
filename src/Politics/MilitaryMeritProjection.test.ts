import {expect,it} from 'vitest';
import {createMeritRosterProjection,meritRoster} from './MilitaryNobility';
import {fixture} from '../Simulation/testing/MeritScaleFixture';
import type {WorldEvent} from '../History/WorldHistory';
it.each([100,500,1000])('preserves the original complete %s-person roster, without repeated evidence evaluation as months pass',n=>{
 const {people,formations,events}=fixture(n),cache=createMeritRosterProjection(),original=meritRoster(people,formations,events,'a',60);expect(cache.get(people,formations,events,'a',60)).toEqual(original);const once=cache.diagnostics();
 expect(cache.get(people,formations,[...events],'a',61)).toEqual(meritRoster(people,formations,events,'a',61));expect(cache.diagnostics().evidenceEvaluations).toBe(once.evidenceEvaluations);expect(cache.diagnostics().indexBuilds).toBe(1);
 expect(original.some(r=>!r.merits.captures&&r.merits.defendedCityIds.length)).toBe(true);expect(original.filter(r=>r.merits.captures).every(r=>r.merits.cityIds.length===1&&r.merits.captures===2)).toBe(true);
},30000);
it('invalidates battle dependencies, including a duplicate start outside the defending command',()=>{
 const x=fixture(),cache=createMeritRosterProjection(),get=()=>cache.get(x.people,x.formations,x.events,'a',60);expect(get()).toEqual(meritRoster(x.people,x.formations,x.events,'a',60));
 x.events.push({...x.events.find(e=>e.id==='start-2')!,id:'duplicate',cityId:'wrong'});expect(get()).toEqual(meritRoster(x.people,x.formations,x.events,'a',60));expect(get().some(r=>r.person.personId==='p-2')).toBe(false);
});
it('future proof availability, new captures, cross-country service and hydration with reused IDs remain correct',()=>{
 const x=fixture(),cache=createMeritRosterProjection(),p=x.people[3],f=x.formations[3];const e:any={id:'future',type:'city-captured',year:72,cityId:'future-town',actorFactionId:'a',targetFactionId:'enemy',metadata:{commandId:f.commandId,commanderPersonId:p.personId,wasCapital:0}};p.capturedEventIds.push(e.id);f.captures.push({eventId:e.id,cityId:e.cityId,month:72});x.events.push(e);
 expect(cache.get(x.people,x.formations,x.events,'a',60)).toEqual(meritRoster(x.people,x.formations,x.events,'a',60));expect(cache.get(x.people,x.formations,x.events,'a',72)).toEqual(meritRoster(x.people,x.formations,x.events,'a',72));
 p.factionId='b';expect(cache.get(x.people,x.formations,x.events,'a',73)).toEqual(meritRoster(x.people,x.formations,x.events,'a',73));expect(cache.get(x.people,x.formations,x.events,'b',73)).toEqual(meritRoster(x.people,x.formations,x.events,'b',73));
 const fresh=structuredClone(x);fresh.events.find(e=>e.id==='end-2')!.metadata!.reason='CONTACT_ENDED';expect(cache.get(fresh.people,fresh.formations,fresh.events,'a',73)).toEqual(meritRoster(fresh.people,fresh.formations,fresh.events,'a',73));expect(cache.get(fresh.people,fresh.formations,fresh.events,'a',73).some(r=>r.person.personId==='p-2')).toBe(false);
});
it('unrelated world events do not invalidate established personal battle facts',()=>{
 const x=fixture(),cache=createMeritRosterProjection();cache.get(x.people,x.formations,x.events,'a',60);const count=cache.diagnostics().evidenceEvaluations;x.events=[...x.events,{id:'elsewhere',type:'city-founded',year:61,actorFactionId:'foreign',cityId:'other'} as WorldEvent];
 expect(cache.get(x.people,x.formations,x.events,'a',61)).toEqual(meritRoster(x.people,x.formations,x.events,'a',61));expect(cache.diagnostics().evidenceEvaluations).toBe(count);
});
