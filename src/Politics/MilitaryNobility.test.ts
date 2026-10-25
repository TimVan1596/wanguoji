import {expect,it} from 'vitest';
import {nextNobleGrant,deriveNobleMerits,meritRoster,nobleLabel} from './MilitaryNobility';
const fixture=()=>{
 const p:any={personId:'p',sourceUserId:1,bornMonth:-240,name:'名',personalName:'景厚',status:'ACTIVE',factionId:'qin',appointments:[{factionId:'qin',startMonth:0,commandId:'f',officeHistory:[{office:'XIAOWEI',month:0}]}],capturedEventIds:[]};
 const f:any=[{commandId:'f',commanderPersonId:'p',factionId:'qin',status:'ACTIVE',captures:[],memberUnitIds:['u']}],events:any[]=[];
 const team:any={name:'qin',displayName:'秦',status:'ACTIVE',identityStage:'STATE',stateFoundedMonth:0,sovereigntyRank:'KING',nameHistory:[{name:'秦',startMonth:0}]};
 const d:any={factionId:'qin',currentRulerId:'r',rulers:[{id:'r',houseName:'嬴氏',givenName:'文',status:'ruling',accessionYear:0,reignOrdinal:1,naturalDeathYear:1000}],houseEpochs:[{houseName:'嬴氏',foundingRulerId:'r',startMonth:0}]};
 const capture=(id:string,cityId:string,m=12,important=false)=>{p.capturedEventIds.push(id);f[0].captures.push({eventId:id,cityId,month:m});events.push({id,type:'city-captured',year:m,actorFactionId:'qin',targetFactionId:'wei',cityId,metadata:{commanderPersonId:'p',commandId:'f',wasCapital:important?1:0}});};
 return {p,f,events,team,d,capture};
};
it('awards a separate actual rank from current sovereign and distinct verified cities, never capacity or ownership',()=>{
 const x=fixture();expect(nextNobleGrant(x.p,x.f,x.events,180,x.team,x.d)).toBeUndefined();x.capture('one','a');x.capture('two','b',24,true);
 const before=JSON.stringify(x),g=nextNobleGrant(x.p,x.f,x.events,60,x.team,x.d)!;expect(g).toMatchObject({rank:'BO',previousRank:'NONE',rulerId:'r',rulerTitle:'秦王嬴文',office:'XIAOWEI',countryName:'秦',cityIds:['a','b']});expect(JSON.stringify(x)).toBe(before);
 x.p.nobilityHistory=[g];expect(nextNobleGrant(x.p,x.f,x.events,60,x.team,x.d)).toBeUndefined();for(let i=0;i<20;i++)x.capture('again'+i,'a',72,true);expect(nextNobleGrant(x.p,x.f,x.events,180,x.team,x.d)).toBeUndefined();expect(deriveNobleMerits(x.p,x.f,x.events,'qin',180).cityIds).toHaveLength(2);
});
it.each(['dead','retired','exiled','provisional','dead-ruler','foreign'])('refuses unsafe %s titles',kind=>{
 const x=fixture();x.capture('a','a');x.capture('b','b');
 if(kind==='dead')x.p.status='DEAD';if(kind==='retired')x.p.status='RETIRED';if(kind==='exiled')x.team.status='EXILED';if(kind==='provisional')x.team.identityStage='PROVISIONAL';if(kind==='dead-ruler')x.d.rulers[0].status='dead';if(kind==='foreign')x.p.factionId='chu';
 expect(nextNobleGrant(x.p,x.f,x.events,60,x.team,x.d)).toBeUndefined();
});
it('keeps old-country labels and dynamic ranking from conferring or deleting grants',()=>{
 const x=fixture();x.capture('a','a');x.capture('b','b',24,true);x.p.nobilityHistory=[nextNobleGrant(x.p,x.f,x.events,60,x.team,x.d)];const before=JSON.stringify(x);
 expect(nobleLabel(x.p,'chu',120)).toBe('');expect(nobleLabel(x.p,'qin',120)).toContain('伯爵');expect(meritRoster([x.p],x.f,x.events,'qin',120)[0].person.personId).toBe('p');expect(JSON.stringify(x)).toBe(before);
});
