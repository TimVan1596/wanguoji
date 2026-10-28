import {expect,it} from 'vitest';
import {currentNobleGrant,deriveNobleMerits,meritRoster,nextNobleGrant} from './MilitaryNobility';
import {mayReceiveMilitaryHonor,nextMilitaryHonors} from './MilitaryHonors';
const fixture=()=>{
 const p:any={personId:'p',sourceUserId:1,bornMonth:-300,name:'user',personalName:'景厚',status:'ACTIVE',factionId:'a',appointments:[{factionId:'a',commandId:'f',startMonth:0,officeHistory:[{office:'SHANGJIANGJUN',month:0}]}],capturedEventIds:[]};
 const f:any[]=[{commandId:'f',commanderPersonId:'p',factionId:'a',status:'ACTIVE',memberUnitIds:['u'],captures:[]}],e:any[]=[],t:any={name:'a',displayName:'齐',status:'ACTIVE',identityStage:'STATE',stateFoundedMonth:0,sovereigntyRank:'KING',nameHistory:[{name:'齐',startMonth:0}]},d:any={factionId:'a',currentRulerId:'r',houseEpochs:[{houseName:'田氏',startMonth:0,foundingRulerId:'r'}],rulers:[{id:'r',houseName:'田氏',givenName:'明',status:'ruling',accessionYear:0,reignOrdinal:1,naturalDeathYear:1000}]};
 const capture=(id:string,cityId=id,important=false)=>{p.capturedEventIds.push(id);f[0].captures.push({eventId:id,cityId,month:24});e.push({id,type:'city-captured',year:24,cityId,actorFactionId:'a',targetFactionId:'b',metadata:{commandId:'f',commanderPersonId:'p',wasCapital:important?1:0}})};
 const award=(month=180)=>{const g=nextNobleGrant(p,f,e,month,t,d)!;p.nobilityHistory??=[];p.nobilityHistory.push(g);e.push({id:g.eventId,type:'military-ennobled',year:month,metadata:{nobility:JSON.stringify(g)}});return g;};
 const dead=()=>{p.status='DEAD';p.deathMonth=240;p.deathCause='BATTLE_DEATH';p.appointments[0].endMonth=240;p.appointments[0].endReason='DEATH';e.push({id:'death',type:'military-person-died',year:240,actorFactionId:'a',metadata:{personId:'p',deathCause:p.deathCause}});};
 const propose=(m=252)=>nextMilitaryHonors(p,f,e,m,[t],[d]);
 return {p,f,e,t,d,capture,award,dead,propose};
};
it('does not fill historical heroes with empty service or ordinary sustained siege',()=>{
 const x=fixture();expect(meritRoster([x.p],x.f,x.e,'a',300)).toEqual([]);
 x.e.push({id:'s',type:'siege-started',year:12,cityId:'c',actorFactionId:'a',targetFactionId:'b',metadata:{battleId:'b',commandId:'f',personId:'p',attackers:1}},{id:'e',type:'siege-ended',year:20,cityId:'c',actorFactionId:'a',targetFactionId:'b',metadata:{battleId:'b',commandId:'f',personId:'p',attackers:1,reason:'CONTACT_ENDED'}});
 expect(deriveNobleMerits(x.p,x.f,x.e,'a',300).siegeEventIds).toEqual(['e']);expect(meritRoster([x.p],x.f,x.e,'a',300)).toEqual([]);
});
it('projects real zero-capture defense separately and keeps deterministic ranking',()=>{
 const x=fixture();x.e.push({id:'s',type:'siege-started',year:12,cityId:'c',actorFactionId:'b',targetFactionId:'a',metadata:{battleId:'b'}},{id:'e',type:'siege-ended',year:20,cityId:'c',actorFactionId:'b',targetFactionId:'a',metadata:{battleId:'b',reason:'REPULSED',defenders:2}},{id:'def',type:'siege-defended',year:20,cityId:'c',actorFactionId:'a',targetFactionId:'b',metadata:{battleId:'b',commandId:'f',personId:'p',defenders:2}});
 const m=deriveNobleMerits(x.p,x.f,x.e,'a',30);expect(m.cityIds).toEqual([]);expect(m.defendedCityIds).toEqual(['c']);expect(meritRoster([x.p],x.f,x.e,'a',30)).toHaveLength(1);
 const before=JSON.stringify(x.p);expect(meritRoster([x.p],x.f,x.e,'a',30)).toEqual(meritRoster([x.p],x.f,x.e,'a',30));expect(JSON.stringify(x.p)).toBe(before);
});
it('formally evaluates only an actual dead decorated combat veteran, once',()=>{
 const x=fixture();x.capture('1');x.capture('2');x.award();expect(mayReceiveMilitaryHonor(x.p,252)).toBe(false);expect(x.propose()).toEqual([]);x.dead();expect(mayReceiveMilitaryHonor(x.p,252)).toBe(true);const before=JSON.stringify(x),h=x.propose()[0];expect(h).toMatchObject({kind:'POSTHUMOUS',epithet:'武烈',rulerId:'r',deathMonth:240,month:252});expect(JSON.stringify(x)).toBe(before);x.p.honorHistory=[h];expect(mayReceiveMilitaryHonor(x.p,252)).toBe(false);expect(x.propose()).toEqual([]);expect(x.propose(228)).toEqual([]);
});
it.each(['no-title','no-merit','no-death','no-king','exiled','former-king','new-dynasty'])('rejects unsupported posthumous %s',kind=>{
 const x=fixture();x.capture('1');x.capture('2');x.award();x.dead();
 if(kind==='no-title')x.p.nobilityHistory=[];if(kind==='no-merit')x.p.capturedEventIds=[];if(kind==='no-death')x.e.pop();if(kind==='no-king')x.d.rulers[0].status='dead';if(kind==='exiled')x.t.status='EXILED';if(kind==='former-king')x.p.politicalRulerId='king';if(kind==='new-dynasty'){x.d.rulers.push({...x.d.rulers[0],id:'new',reignOrdinal:2});x.d.currentRulerId='new';x.d.houseEpochs.push({houseName:'田氏',startMonth:248,foundingRulerId:'new'});}
 expect(x.propose()).toEqual([]);
});
it('ordinary transfer is never rebellion, and effective revoked titles cannot supply political standing',()=>{
 const x=fixture();x.capture('1');x.capture('2');const g=x.award();x.p.factionId='b';x.p.status='RETIRED';expect(x.propose()).toEqual([]);
 x.p.honorHistory=[{kind:'REVOKED',month:252,factionId:'a',epochFounderId:g.epochFounderId}];expect(currentNobleGrant(x.p,'a',240)).toEqual(g);expect(currentNobleGrant(x.p,'a',252)).toBeUndefined();expect(x.p.nobilityHistory).toEqual([g]);
});
it.each([1,2])('uses %s distinct important city results for a noncombat posthumous evaluation',important=>{
 const x=fixture();for(let i=0;i<4;i++)x.capture('c'+i,'c'+i,i<important);x.award(180);x.award(192);x.dead();x.p.deathCause='NATURAL_DEATH';x.e.at(-1).metadata.deathCause='NATURAL_DEATH';
 expect(mayReceiveMilitaryHonor(x.p,252)).toBe(true);expect(x.propose()[0]).toMatchObject({kind:'POSTHUMOUS',epithet:important===1?'武襄':'武毅',reason:'DISTINGUISHED_SERVICE',rank:'HOU'});
});

it('honor prefilter keeps unresolved political revocations, and respects the original award/revocation date',()=>{
 const x=fixture();x.capture('1');x.capture('2');const g=x.award();x.p.politicalRulerId='real-founder';
 expect(mayReceiveMilitaryHonor(x.p,179)).toBe(false);expect(mayReceiveMilitaryHonor(x.p,240)).toBe(true);
 x.p.honorHistory=[{kind:'REVOKED',month:252,factionId:'a',epochFounderId:g.epochFounderId}];
 expect(mayReceiveMilitaryHonor(x.p,240)).toBe(true);expect(mayReceiveMilitaryHonor(x.p,252)).toBe(false);
});
