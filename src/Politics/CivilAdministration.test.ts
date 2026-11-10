import {expect,it} from 'vitest';
import {civilControlledSince,civilGovernanceEffect,civilGovernorCandidates,civilGovernorStatus,eligibleCivilCities,selectCivilGovernorCandidate} from './CivilAdministrationRules';
import {personAbilities} from './PersonAbilities';

const city=(overrides:any={})=>({id:'city',name:'新郑',ownerFactionId:'qin',foundedYear:0,lastCapturedYear:undefined,history:[],destroyed:false,underSiege:false,isInCaptureGrace:()=>false,loyalty:60,devastation:30,...overrides});
const team=(users:any[]=[],overrides:any={})=>({name:'qin',displayName:'秦',status:'ACTIVE',identityStage:'STATE',stateFoundedMonth:0,currentActiveSinceYear:0,cities:[city()],users:new Set(users),...overrides});
const resident=(id:number,bornMonth=-240)=>({id,bornMonth,name:`秦-${id}`,isDestroyed:false,role:'NORMAL',rulerId:undefined,player:{rulerId:undefined},militaryPersonId:undefined});

it('requires an established state, two controlled cities and 24 months without siege or capture grace',()=>{
 const base=city({lastCapturedYear:20}),t=team([],{cities:[base,city({id:'b',lastCapturedYear:20})]});expect(eligibleCivilCities(43,t,[])).toEqual([]);expect(eligibleCivilCities(44,t,[]).map(c=>c.id)).toEqual(['city','b']);
 expect(eligibleCivilCities(44,team([],{cities:[city({underSiege:true}),city({id:'b',lastCapturedYear:30})]}),[])).toEqual([]);
 expect(eligibleCivilCities(44,team([],{cities:[city({lastCapturedYear:30}),city({id:'b',lastCapturedYear:30})]}),[])).toEqual([]);
 expect(civilControlledSince({...base,history:[{year:40,newOwnerFactionId:'qin'}]} as any,{name:'qin',currentActiveSinceYear:0},44)).toBe(40);
});

it('uses real adult residents and keeps ordinary opportunity without inventing people',()=>{
 const t=team([resident(1),resident(2),resident(3,100),{...resident(4),role:'RULER'}]);
 const rows=civilGovernorCandidates(240,t,[],[],'king',()=>undefined);
 expect(rows.map(row=>row.sourceUserId).sort()).toEqual([1,2]);expect(rows.every(row=>row.sourceUserId>0&&Number.isSafeInteger(row.bornMonth))).toBe(true);expect(rows.every(row=>row.identitySource==='ORDINARY_RESIDENT')).toBe(true);
});
it('admits real family, noble, royal and retired identities only through their authoritative records',()=>{
 const users=[resident(1),{...resident(2),militaryPersonId:'family-person'},{...resident(3),militaryPersonId:'noble-person'},{...resident(4),militaryPersonId:'royal-person'},{...resident(5),militaryPersonId:'retired-person'}];
 const people:any[]=[{personId:'family-person',sourceUserId:2,bornMonth:-240,personalName:'甲二',factionId:'qin',status:'ACTIVE',appointments:[]},{personId:'noble-person',sourceUserId:3,bornMonth:-240,personalName:'甲三',factionId:'qin',status:'ACTIVE',appointments:[],nobilityHistory:[{eventId:'grant',rank:'ZI',month:120,factionId:'qin',epochFounderId:'king'}]},{personId:'royal-person',sourceUserId:4,bornMonth:-240,personalName:'甲四',factionId:'qin',status:'ACTIVE',appointments:[],royalIdentity:{rulerId:'royal'}},{personId:'retired-person',sourceUserId:5,bornMonth:-240,personalName:'甲五',factionId:'qin',status:'RETIRED',appointments:[{factionId:'qin',startMonth:60,endMonth:180}]}];
 const family:any={familyId:'family',factionId:'qin',epochFounderId:'king',members:[{memberId:'member',sourceUserId:2,bornMonth:-240,name:'甲二',enteredMonth:0,generation:1,militaryPersonId:'family-person'}]};
 const rows=civilGovernorCandidates(240,team(users),people,[],'king',id=>id===2?{family,member:family.members[0]}:undefined);
 expect(new Set(rows.map(row=>row.identitySource))).toEqual(new Set(['ORDINARY_RESIDENT','FAMILY','NOBLE','ROYAL','RETIRED_MILITARY']));
});

it('applies bounded annual governance only to capable identities and never while invested',()=>{
 let chosen:{id:number;strategy:number}|undefined;for(let id=1;id<1000&&!chosen;id++){const strategy=personAbilities({kind:'RESIDENT',sourceUserId:id,bornMonth:-240}).strategy;if(strategy>=60)chosen={id,strategy};}
 const term:any={sourceUserId:chosen!.id,bornMonth:-240,startMonth:216,royalRulerId:undefined,ended:false};
 expect(civilGovernanceEffect(term,city({loyalty:79,devastation:20}),228,'MEDIUM')).toEqual({loyalty:1,devastation:1});
 expect(civilGovernanceEffect(term,city({loyalty:80,devastation:0}),228,'MEDIUM')).toEqual({loyalty:0,devastation:0});
 expect(civilGovernanceEffect(term,city({underSiege:true}),228,'MEDIUM')).toEqual({loyalty:0,devastation:0});
 expect(civilGovernanceEffect(term,city(),229,'MEDIUM')).toEqual({loyalty:0,devastation:0});
});

it('reports governance state from actual city conditions and separates ended office from death',()=>{
 const term:any={startMonth:216,endMonth:undefined,loyaltyRecovered:0,devastationRecovered:0};
 expect(civilGovernorStatus(term,city({underSiege:true}) as any,240)).toBe('困难');
 expect(civilGovernorStatus(term,city({loyalty:70,devastation:30}) as any,240)).toBe('恢复中');
 expect(civilGovernorStatus({...term,meritEventId:'merit'},city({loyalty:70,devastation:10}) as any,240)).toBe('治理有绩');
 expect(civilGovernorStatus({...term,endMonth:240,endReason:'CITY_LOST'},undefined,240)).toBe('已离任');
});
it('keeps ordinary candidates in a bounded weighted pool while respecting limited rank or status advantages',()=>{
 const rows:any[]=[{personId:'ordinary',weight:1},{personId:'noble',weight:1.2},{personId:'royal',weight:1.25},...Array.from({length:20},(_,i)=>({personId:`r${i}`,weight:.9}))];
 const ranked=rows.sort((a,b)=>b.weight-a.weight),pool=new Set(ranked.slice(0,12).map(row=>row.personId)),picks=new Set(Array.from({length:1000},(_,i)=>selectCivilGovernorCandidate(ranked,(i+.5)/1000)!.personId));expect(picks.has('ordinary')).toBe(true);expect(picks.has('noble')||picks.has('royal')).toBe(true);expect([...picks].every(id=>pool.has(id))).toBe(true);
});
