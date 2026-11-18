import {expect,it} from 'vitest';
import {personCareerEvents,personCareerMilestones} from './PersonCareerTimeline';
it('merges real civil and military events in recorded same-month order without borrowing faction history',()=>{
 const events:any[]=[{id:'end',year:12,title:'离任',metadata:{personId:'p'}},{id:'foreign',year:10,title:'国事',actorFactionId:'f'},{id:'army',year:12,title:'始任校尉',metadata:{commanderPersonId:'p'}},{id:'civil',year:1,title:'任郡守',metadata:{personId:'p'}},{id:'future',year:13,metadata:{personId:'p'}}];
 const before=JSON.stringify(events);
 expect(personCareerEvents(events,'p',12).map(e=>e.id)).toEqual(['civil','end','army']);
 expect(personCareerMilestones(events,'p',12,[{eventId:'army',worldMonth:12,text:'原始军旅证据'}]).map(e=>e.id)).toEqual(['civil','end','army']);
 expect(JSON.stringify(events)).toBe(before);
});
