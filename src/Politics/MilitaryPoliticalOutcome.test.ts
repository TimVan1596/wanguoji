import {expect,it} from 'vitest';
import {militaryPoliticalOutcome} from './MilitaryPoliticalOutcome';
it('preserves old merit and peerage while scoping later departure and formal revocation to real country and month',()=>{
 const person:any={personId:'p',nobilityHistory:[{factionId:'qin',month:10}],honorHistory:[]};
 const ruler:any={id:'founder',residentIdentity:{military:{personId:'p'},sourceFactionId:'qin',sourceFactionName:'秦',foundedMonth:30}};
 const dynasties:any[]=[{rulers:[ruler]}],events:any[]=[{id:'split',type:'empire-split',year:30,targetFactionId:'qin',metadata:{militaryPersonId:'p',foundingRulerId:'founder'}}];
 expect(militaryPoliticalOutcome(person,'qin',29,dynasties,events)).toEqual([]);
 expect(militaryPoliticalOutcome(person,'other',40,dynasties,events)).toEqual([]);
 expect(militaryPoliticalOutcome(person,'qin',40,dynasties,[])).toEqual([]);
 expect(militaryPoliticalOutcome(person,'qin',40,dynasties,events)).toEqual(['后叛离秦','原册封为历史记录']);
 const honor={kind:'REVOKED',eventId:'revoked',factionId:'qin',month:45};person.honorHistory.push(honor);
 expect(militaryPoliticalOutcome(person,'qin',50,dynasties,events)).not.toContain('旧爵已追夺');
 events.push({id:'revoked',type:'military-title-revoked',year:45,actorFactionId:'qin',metadata:{personId:'p',honor:JSON.stringify(honor)}});
 expect(militaryPoliticalOutcome(person,'qin',44,dynasties,events)).not.toContain('旧爵已追夺');
 expect(militaryPoliticalOutcome(person,'qin',45,dynasties,events)).toEqual(['后叛离秦','旧爵已追夺']);
 expect(person.nobilityHistory).toHaveLength(1);
});
