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
