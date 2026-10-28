import {expect,it} from 'vitest';
import {militaryLifePairs,militaryDeathWording} from './MilitaryLifePresentation';
import {groupHistoryNarratives} from '../History/HistoryNarrativeGrouper';
import {militaryMilestones} from './MilitaryChroniclePresentation';
import {formatHistoryEventTitle} from '../History/HistoryRenderRules';
import random from '../Simulation/WorldRandom';
function fixture(){
 const g={eventId:'noble',personId:'yang',personalName:'杨世睦',sourceUserId:1,bornMonth:2400,factionId:'wei',countryName:'魏',epochFounderId:'house',rulerId:'wei-king',rulerTitle:'魏王魏景良',month:2760,rank:'BO',previousRank:'NONE'};
 const a={...g,eventId:'estate',grantEventId:'estate',kind:'GRANTED',nobleGrantEventId:'noble',cityId:'ying',cityName:'郢',sourceEventId:'merit',meritEventId:'merit'};
 const e=(x:any,type:string,key:string)=>({id:x.eventId,type,year:x.month,monthIndex:x.month,actorFactionId:x.factionId,rulerId:x.rulerId,cityId:x.cityId,title:'原始独立史料',metadata:{personId:x.personId,[key]:JSON.stringify(x)}} as any);
 return {g,a,events:[e(g,'military-ennobled','nobility'),e(a,'military-appanage','appanage')],e};
}
it('merges the referenced same-month Wei grant in both readers, preserving original IDs, records and RNG',()=>{
 const {events}=fixture(),before=JSON.stringify(events),rng=random.exportState(),pair=militaryLifePairs(events)[0],group=groupHistoryNarratives(events);
 expect(pair.text).toBe('魏王魏景良以军功封杨世睦为伯爵，并赐郢为食邑。');expect(group).toHaveLength(1);expect(group[0].metadata?.sourceEventIds).toBe('noble,estate');expect(formatHistoryEventTitle(group[0],new Map())).toBe(pair.text);
 const rows=events.map(e=>({eventId:e.id,worldMonth:e.year,factionId:e.actorFactionId,text:e.title,source:e.type+' · '+e.id,victory:false}));
 const view=militaryMilestones({personId:'yang',personalName:'杨世睦',name:'杨世睦'} as any,rows as any,events);expect(view).toHaveLength(1);expect(view[0].text).toBe(pair.text);expect(view[0].source).toContain('estate');expect(JSON.stringify(events)).toBe(before);expect(random.exportState()).toEqual(rng);
});
it.each(['person','month','ruler','epoch','reference','rank'])('does not merge mismatched %s evidence or a standalone award',field=>{
 const x=fixture();if(field==='person')x.a.personId='other';if(field==='month')x.a.month++;if(field==='ruler')x.a.rulerId='other';if(field==='epoch')x.a.epochFounderId='other';if(field==='reference')x.a.nobleGrantEventId='wrong';if(field==='rank')x.a.rank='HOU';x.events[1]=x.e(x.a,'military-appanage','appanage');expect(militaryLifePairs(x.events)).toEqual([]);expect(groupHistoryNarratives(x.events)).toHaveLength(2);expect(groupHistoryNarratives(x.events.slice(0,1))).toHaveLength(1);
});
it.each(['NATURAL_DEATH','BATTLE_DEATH','SIEGE_LOSS',undefined])('uses actual %s death evidence, never the epithet, for the same-month posthumous narrative',cause=>{
 const x=fixture(),death:any={id:'death',type:'military-person-died',year:2880,actorFactionId:'wei',metadata:{personId:'yang',deathCause:cause}},honor={eventId:'honor',kind:'POSTHUMOUS',personId:'yang',personalName:'杨世睦',factionId:'wei',countryName:'魏',epochFounderId:'house',rulerId:'wei-king',rulerTitle:'魏王魏景良',month:2880,deathMonth:2880,grantEventId:'noble',rank:'BO',sourceEventId:'death',epithet:'武烈'};
 const events=[x.events[0],death,x.e(honor,'military-posthumous','honor')],pair=militaryLifePairs(events)[0];expect(pair.text).toBe(`杨世睦${militaryDeathWording(cause)}，同月获魏王魏景良追谥“武烈”。`);expect(groupHistoryNarratives(events)).toHaveLength(2);
 const rows=events.slice(1).map(e=>({eventId:e.id,worldMonth:e.year,factionId:'wei',text:e.title,source:e.type+' · '+e.id,victory:false}));expect(militaryMilestones({personId:'yang',personalName:'杨世睦',name:'杨世睦',deathCause:cause} as any,rows,events)[0].text).toBe(pair.text);
 honor.month+=12;events[2]=x.e(honor,'military-posthumous','honor');expect(militaryLifePairs(events)).toEqual([]);honor.month-=12;honor.sourceEventId='unrelated';events[2]=x.e(honor,'military-posthumous','honor');expect(militaryLifePairs(events)).toEqual([]);
});
