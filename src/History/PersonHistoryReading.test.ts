import {expect,it} from 'vitest';
import {personHistoryReading} from './PersonHistoryReading';
const event=(id:string,type:string,metadata:any={},other:any={})=>({id,type,metadata,year:120,category:'military',importance:'normal',title:id,cityId:'linzi',...other} as any);
it('hides abstract target refresh without inventing movement, while preserving the original sources',()=>{const raw=[event('o','military-order-issued',{}, {importance:'major'}),event('a','military-office-granted')],before=JSON.stringify(raw);expect(personHistoryReading(raw).events.map(e=>e.id)).toEqual(['a']);expect(JSON.stringify(raw)).toBe(before);});
it('joins only a capture with its exact CAPTURED siege end and battle evidence',()=>{const raw=[event('end','siege-ended',{reason:'CAPTURED',battleId:'battle'}),event('independent','siege-ended',{reason:'RETREAT',battleId:'other'}),event('victory','city-captured',{siegeEndedEventId:'end',battleId:'battle'})];expect(personHistoryReading(raw).events.map(e=>e.id)).toEqual(['independent','victory']);expect(personHistoryReading(raw).sources.get('victory')).toEqual(['end','victory']);raw[2].metadata.battleId='wrong';expect(personHistoryReading(raw).events).toHaveLength(3);});
it('deduplicates a generic appointment only when person, command and month prove the same formal initial office',()=>{const raw=[event('a','military-appointment',{personId:'p',commandId:'c'}),event('b','military-office-granted',{personId:'p',commandId:'c'}),event('c','military-appointment',{personId:'other',commandId:'d'})];expect(personHistoryReading(raw).events.map(e=>e.id)).toEqual(['b','c']);expect(personHistoryReading(raw).sources.get('b')).toEqual(['a','b']);});

it('merges a real civil death with its same identity office end without altering raw events',()=>{
 const raw=[event('death','military-person-died',{personId:'p'}),event('end','civil-governor-ended',{personId:'p',endReason:'DEATH'},{title:'于安卒，离任御史大夫。'}),event('other','military-person-died',{personId:'q'})],before=JSON.stringify(raw),r=personHistoryReading(raw);
 expect(r.events.map(e=>e.title)).toEqual(['于安卒于御史大夫任内。','other']);expect(r.sources.get('end')).toEqual(['death','end']);expect(JSON.stringify(raw)).toBe(before);
});
it('merges promotion by actual old assignment, never by date alone',()=>{
 const raw=[event('end','civil-governor-ended',{personId:'p',assignmentId:'old',endReason:'PROMOTED'}),event('independent','civil-governor-ended',{personId:'q',assignmentId:'other',endReason:'PROMOTED'}),event('new','civil-governor-appointed',{personId:'p',term:JSON.stringify({personId:'p',promotion:{fromAssignmentId:'old'}})})];
 expect(personHistoryReading(raw).events.map(e=>e.id)).toEqual(['independent','new']);expect(personHistoryReading(raw).sources.get('new')).toEqual(['end','new']);
});
