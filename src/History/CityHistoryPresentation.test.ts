import {expect,it} from 'vitest';
import {importantCityHistory} from './CityHistoryPresentation';
const event=(type:string,month:number,battleId='b',extra:any={})=>({id:type+month,type,year:month,title:type+month,cityId:'c',actorFactionId:'a',targetFactionId:'d',metadata:{battleId,reason:'CONTACT_ENDED',commandId:'f',...extra}} as any);
it('folds only proven short contact pairs and preserves all original history',()=>{
 const events=[event('siege-started',1),event('siege-ended',2),event('captured',3)],history=events.map(e=>({year:e.year,type:e.type,title:e.title}));const before=JSON.stringify({events,history});
 expect(importantCityHistory(history,events,'c')).toEqual([history[2]]);expect(JSON.stringify({events,history})).toBe(before);
});
it('retains long battles, actual repulses, unfinished or ambiguous facts and different commanders',()=>{
 for(const end of [event('siege-ended',8),event('siege-ended',2,'b',{reason:'REPULSED'}),event('siege-ended',2,'b',{commandId:'other'}),event('siege-ended',2,'other')]){
  const events=[event('siege-started',1),end],h=events.map(e=>({year:e.year,type:e.type,title:e.title}));expect(importantCityHistory(h,events,'c')).toEqual(h);
 }
 const e=[event('siege-started',1),event('siege-ended',2)],h=e.map(x=>({year:x.year,type:x.type,title:x.title}));expect(importantCityHistory(h,[...e,{...e[1],id:'ambiguous'}],'c')).toContain(h[1]);expect(importantCityHistory(h,[],'c')).toEqual(h);
});
