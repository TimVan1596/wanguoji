import {it,expect} from 'vitest';
import {insurgentChronicle} from './InsurgentChronicle';
it('projects only verified command facts into the same ruler life, with no formal military office',()=>{
 const f:any={commandId:'cmd',factionId:'rebel',createdMonth:10,captures:[{eventId:'win',month:20}],leaderDuty:{rulerId:'r',personId:'person',sourceUserId:1,bornMonth:-300,initialMembers:[{userId:1},{userId:2}],endMonth:30}};
 const events:any[]=[{id:'leader-command-cmd',year:10,type:'leader-command-started',actorFactionId:'rebel',rulerId:'r',metadata:{leaderName:'颜宁',commandId:'cmd',personId:'person'}},{id:'siege',year:15,type:'siege-started',actorFactionId:'rebel',cityName:'古城',metadata:{commandId:'cmd',commanderPersonId:'person'}},{id:'failed',year:16,type:'siege-ended',actorFactionId:'rebel',metadata:{commandId:'cmd',commanderPersonId:'person',reason:'REPULSED'}},{id:'win',year:20,type:'city-captured',cityName:'新城',actorFactionId:'rebel',metadata:{commandId:'cmd',commanderPersonId:'person'}},{id:'leader-command-ended-cmd',year:30,type:'leader-command-ended',actorFactionId:'rebel',metadata:{commandId:'cmd',rulerId:'r'}}];
 const before=JSON.stringify([f,events]),rows=insurgentChronicle('r',[f],events,30);expect(rows).toHaveLength(5);expect(rows[0].title).toContain('原有2人');expect(rows.map(e=>e.title).join('')).not.toContain('将军');expect(insurgentChronicle('different',[f],events,30)).toEqual([]);expect(insurgentChronicle('r',[],events,30)).toEqual([]);expect(insurgentChronicle('r',[f],events,16)).toHaveLength(3);expect(new Set(rows.map(e=>e.id)).size).toBe(5);expect(JSON.stringify([f,events])).toBe(before);
});

it('reads command creation before actual same-month capture and ending, even from reversed UI event order',()=>{
 const f:any={commandId:'c',factionId:'f',createdMonth:12,captures:[{eventId:'capture',month:12}],leaderDuty:{rulerId:'r',personId:'p',initialMembers:[{},{}],endMonth:12}};
 const events:any[]=[{id:'end',year:12,type:'leader-command-ended',actorFactionId:'f',metadata:{commandId:'c',rulerId:'r'}},{id:'capture',year:12,type:'city-captured',actorFactionId:'f',cityName:'甲城',metadata:{commandId:'c',commanderPersonId:'p'}},{id:'leader-command-c',year:12,type:'leader-command-started',actorFactionId:'f',rulerId:'r',metadata:{leaderName:'甲',personId:'p',commandId:'c'}}];
 expect(insurgentChronicle('r',[f],events,12).map(e=>e.type)).toEqual(['leader-command-started','city-captured','leader-command-ended']);
});
