import {expect,it} from 'vitest';
import {selectMilitaryUsurper} from './MilitaryUsurpation';
import {politicalContest,civilPoliticalSupport} from './PoliticalUsurpation';
import {personAbilities,personAmbition} from './PersonAbilities';
const people:any[]=[{personId:'one',sourceUserId:1,bornMonth:-300,personalName:'程清',status:'ACTIVE'},{personId:'two',sourceUserId:2,bornMonth:-300,personalName:'李清',status:'ACTIVE'}];
const candidate=(id='one'):any=>({personId:id,factionId:'qin',unitCount:2,serviceMonths:120,strength:2,capturedEventIds:['capture'],officeStanding:{office:'JIANGJUN'},disposition:{ambition:70,loyalty:20}});
it('compares bounded actual resources after qualification without changing input or choosing an ineligible high rank',()=>{
 const low=candidate(),high={...candidate('two'),unitCount:4,serviceMonths:240,nobility:{rank:'GONG'},capturedEventIds:['capture','c2','c3','c4']},before=structuredClone([low,high]);
 expect(selectMilitaryUsurper([low,high],people,'田氏')?.personId).toBe('two');expect([low,high]).toEqual(before);
 expect(selectMilitaryUsurper([low,high],[people[0],{...people[1],status:'RETIRED'}],'田氏')?.personId).toBe('one');
 const rows=politicalContest([high,low],people,[],[],300,'epoch');expect(rows[0].capital).toBeLessThanOrEqual(100);expect(rows[0].nobility).toBe(15);
 expect(selectMilitaryUsurper([high],people,'李氏')).toBeUndefined();
});
it('does not merge same names or invent an army for a governor',()=>{
 const p=people.map(p=>({...p,personalName:'程清'}));expect(selectMilitaryUsurper([candidate('two')],p,'田氏')?.personId).toBe('two');
 for(const change of [{unitCount:1},{capturedEventIds:[]},{serviceMonths:59},{disposition:{ambition:10,loyalty:70}}])expect(selectMilitaryUsurper([{...candidate(),...change}],people,'田氏')).toBeUndefined();
});
it('uses only a mature actual governorship, original merit receipt and verified local command relationship',()=>{
 const userId=Array.from({length:500},(_,i)=>i+10).find(sourceUserId=>{const s={kind:'RESIDENT' as const,sourceUserId,bornMonth:0};return personAmbition(s)>=50&&personAbilities(s).strategy>=60;})!;
 const term:any={assignmentId:'term',personId:'civil',sourceUserId:userId,bornMonth:0,personalName:'张平',factionId:'qin',epochFounderId:'epoch',cityId:'city',cityName:'新郑',startMonth:216,appointEventId:'appoint',meritEventId:'merit',meritLoyaltyRecovered:3};
 const events:any[]=[{id:'capture',year:200,type:'city-captured',actorFactionId:'qin',cityId:'city'},{id:'appoint',year:216,type:'civil-governor-appointed',metadata:{assignmentId:'term'}},{id:'merit',year:300,type:'civil-governor-merit',actorFactionId:'qin',metadata:{assignmentId:'term',personId:'civil'}}];
 const sources=[{assignmentId:term.assignmentId,sourceUserId:userId,bornMonth:0,factionId:'qin',loyalty:0}];expect(civilPoliticalSupport(candidate(),people,[term],events,360,'epoch',sources)).toHaveLength(1);expect(civilPoliticalSupport(candidate(),people,[term],events,360,'epoch',[{...sources[0],loyalty:100}])).toEqual([]);expect(civilPoliticalSupport(candidate(),people,[term],events,360,'epoch',[])).toEqual([]);
 const rows=civilPoliticalSupport(candidate(),people,[term],events,360,'epoch');expect(rows).toHaveLength(1);expect(rows[0].bonus).toBeLessThanOrEqual(4);expect(rows[0].captureEventId).toBe('capture');
 for(const t of [{...term,endMonth:350,endReason:'DEATH'},{...term,startMonth:300},{...term,royalRulerId:'royal'},{...term,meritEventId:'missing'},{...term,epochFounderId:'other'}])expect(civilPoliticalSupport(candidate(),people,[t],events,360,'epoch')).toEqual([]);
 expect(civilPoliticalSupport(candidate(),people,[term],[...events,{id:'lost',year:340,type:'city-captured',cityId:'city',actorFactionId:'enemy'}] as any,360,'epoch')).toEqual([]);
});

it('rejects duplicate permanent identity, minority, real disability and actual death before any contest',()=>{const context={terms:[],events:[],month:360,epoch:'epoch'},c=candidate();expect(selectMilitaryUsurper([c],[...people,{...people[0],personId:'copy'}],'田氏',context)).toBeUndefined();for(const change of [{bornMonth:300},{deathMonth:359},{deathCause:'BATTLE_DEATH'},{politicalHistory:[{kind:'COURT_BAN',factionId:'qin',epochFounderId:'epoch',month:350,eventId:'ban'}]}])expect(selectMilitaryUsurper([c],[{...people[0],...change}],'田氏',context)).toBeUndefined();});
