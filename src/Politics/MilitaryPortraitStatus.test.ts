import {expect,it} from 'vitest';
import {militaryPortraitStatus} from './MilitaryPortraitStatus';
const p:any={personId:'p',appointments:[],politicalHistory:[]};
it('marks only actual dated bans and pardons, never ordinary retirement or a transfer',()=>{
 const officer={...p,status:'RETIRED',factionId:'qi',politicalHistory:[] as any[]};
 expect(militaryPortraitStatus(officer,'qin',100,[],[])).toBeUndefined();
 officer.politicalHistory.push({eventId:'ban',kind:'COURT_BAN',month:24,factionId:'qin',epochFounderId:'ENDED'});
 expect(militaryPortraitStatus(officer,'qin',23,[],[])).toBeUndefined();expect(militaryPortraitStatus(officer,'qin',24,[],[])).toBe('禁仕');
 officer.politicalHistory.push({kind:'COURT_PARDONED',banEventId:'ban',month:48,factionId:'qin'});
 expect(militaryPortraitStatus(officer,'qin',47,[],[])).toBe('禁仕');expect(militaryPortraitStatus(officer,'qin',48,[],[])).toBe('已赦');expect(militaryPortraitStatus(officer,'qi',48,[],[])).toBeUndefined();
});
it('marks secession only in the former country with the actual split and permanent military identity',()=>{
 const ruler:any={id:'king',residentIdentity:{military:{personId:'p'},sourceFactionId:'qin',sourceFactionName:'秦',foundedMonth:30}},houses:any[]=[{rulers:[ruler]}],events:any[]=[{id:'split',type:'empire-split',year:30,targetFactionId:'qin',metadata:{militaryPersonId:'p',foundingRulerId:'king'}}];
 expect(militaryPortraitStatus(p,'qin',29,houses,events)).toBeUndefined();expect(militaryPortraitStatus(p,'qin',30,houses,[])).toBeUndefined();expect(militaryPortraitStatus(p,'qin',30,houses,events)).toBe('叛离');expect(militaryPortraitStatus(p,'new',40,houses,events)).toBeUndefined();
});

it('uses a sourced title forfeiture, never mere title expiry or natural death, as a portrait warning',()=>{
 const h:any={kind:'REVOKED',eventId:'revoked',factionId:'qin',month:60},officer={...p,status:'DEAD',honorHistory:[h]},events:any[]=[{id:h.eventId,type:'military-title-revoked',year:60,actorFactionId:'qin',metadata:{personId:'p',honor:JSON.stringify(h)}}];
 expect(militaryPortraitStatus(officer,'qin',59,[],events)).toBeUndefined();expect(militaryPortraitStatus(officer,'qin',60,[],events)).toBe('追夺');expect(militaryPortraitStatus(officer,'qin',60,[],[])).toBeUndefined();expect(militaryPortraitStatus({...officer,honorHistory:[]},'qin',100,[],events)).toBeUndefined();
});
