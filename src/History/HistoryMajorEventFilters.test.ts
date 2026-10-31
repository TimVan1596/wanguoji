import {expect,it} from 'vitest';
import {matchesMajorEventFilter as matches,VISIBLE_MAJOR_EVENT_FILTERS,normalizeVisibleMajorEventFilter} from './HistoryMajorEventFilters';
import {WorldHistoryStore} from './WorldHistory';
import {queryHistoryPage} from './HistoryPageQuery';
it('groups browsing without conflating exact event types and preserves legacy filter keys',()=>{
 expect(VISIBLE_MAJOR_EVENT_FILTERS.map(x=>x.label)).toEqual(['全部大事','册封','建国与复国','称帝','政变与分裂','亡国','归附与合邦']);
 for(const type of ['dynasty-usurped','ruler-deposed','empire-split','rebel-faction-founded','frontier-faction-founded'])expect(matches({type} as any,'revolution')).toBe(true);
 expect(matches({type:'faction-restored'} as any,'founding')).toBe(true);expect(matches({type:'faction-merged'} as any,'submission')).toBe(true);
 expect(matches({type:'empire-split'} as any,'founding')).toBe(false);expect(normalizeVisibleMajorEventFilter('restoration')).toBe('founding');
});
it('pages political founding groups once while retaining their canonical sources',()=>{
 const store=new WorldHistoryStore();
 for(let i=0;i<5;i++){
  store.addEvent({id:'revolt'+i,type:'city-revolt',year:i,category:'politics',actorFactionId:'new'+i,targetFactionId:'old',factionIds:['old','new'+i],historyGroupId:'g'+i,title:'城邑起事',importance:'normal'});
  store.addEvent({id:'split'+i,type:'empire-split',year:i,category:'politics',actorFactionId:'new'+i,targetFactionId:'old',factionIds:['old','new'+i],historyGroupId:'g'+i,title:'真实军事割据',importance:'major'});
 }
 const before=store.exportState(),page=queryHistoryPage(store,{visibleCount:3,filter:'featured',eventTypeFilter:'revolution'});
 expect(page.events).toHaveLength(3);expect(page.hasMore).toBe(true);expect(new Set(page.events.map(e=>e.id)).size).toBe(3);
 expect(store.exportState()).toEqual(before);
});
