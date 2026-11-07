import {expect,it} from 'vitest';
import {militaryChronicleReadingOrder} from './MilitaryChronicleOrder';
import {selectMilitaryMilestones} from './MilitaryChroniclePresentation';
const event=(id:string,type:string)=>({id,type,monthIndex:828,year:828,actorFactionId:'齐',category:'politics',importance:'major',title:id}) as any;
it('orders same-month promotion, coup and dismissal by the real write boundary in both full reading and highlights',()=>{
 const events=[event('z-promotion','military-office-granted'),event('a-coup','court-coup-attempt'),event('b-dismissed','military-court-sanction')];
 const entries=[2,1,0].map(i=>({eventId:events[i].id,worldMonth:828,factionId:'齐',text:events[i].title,source:events[i].type,victory:false}));
 const before=structuredClone(entries),ordered=militaryChronicleReadingOrder(entries,events);
 expect(ordered.map(e=>e.eventId)).toEqual(['z-promotion','a-coup','b-dismissed']);expect(selectMilitaryMilestones(entries,events).map(e=>e.eventId)).toEqual(ordered.map(e=>e.eventId));expect(entries).toEqual(before);
});
it('keeps unknown-source rows stable and never invents same-month order from their names',()=>{
 const rows=['z-unknown','a-unknown'].map(eventId=>({eventId,worldMonth:10,factionId:'齐',text:eventId,source:'missing',victory:false}));expect(militaryChronicleReadingOrder(rows,[])).toEqual(rows);
});
