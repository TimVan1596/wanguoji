import {expect,it} from 'vitest';
import type {WorldEvent} from './WorldHistory';
import {summarizeStewardship} from './StewardshipReading';

it('retains raw sources, respects political boundaries, and does not cross appointments',()=>{
 const events=new Map<string,WorldEvent>();
 function row(id:string,month:number,assignmentId:string,type:WorldEvent['type']='civil-stewardship-assessed'){
  events.set(id,{id,type,year:month,title:id,category:'politics',importance:'normal',metadata:{assignmentId}});
  return {id,month,text:id,sources:[]};
 }
 const rows=[row('a',36,'old'),row('b',72,'old'),row('sanction',73,'old','military-court-sanction'),row('c',108,'old'),row('d',144,'new'),row('e',180,'new')];
 const before=JSON.stringify(rows),result=summarizeStewardship(rows,events);
 expect(result.map(r=>r.id)).toEqual(['a','sanction','c','d']);
 expect(result[0].sources).toEqual(['a','b']);
 expect(result[3].sources).toEqual(['d','e']);
 expect(JSON.stringify(rows)).toBe(before);
});
