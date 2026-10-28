import {expect,it} from 'vitest';
import {createMeritRosterProjection,meritRoster} from './MilitaryNobility';
import type {MilitaryPerson,MilitaryFormation} from './MilitaryCommandRegistry';
import type {WorldEvent} from '../History/WorldHistory';
function fixture(n=12){
 const people:MilitaryPerson[]=[],formations:MilitaryFormation[]=[],events:WorldEvent[]=[];
 const add=(e:any)=>events.push(e);
 for(let i=0;i<n;i++){
  const personId=`p-${i}`,commandId=`c-${i}`,factionId=i%4===0?'b':'a',p:MilitaryPerson={personId,sourceUserId:i,name:'label-'+i,personalName:'同名',bornMonth:-300,factionId,status:i%3?'DEAD':'ACTIVE',deathMonth:i%3?40:undefined,appointments:[{factionId,commandId,startMonth:0,endMonth:i%3?40:undefined}],capturedEventIds:[]},f:MilitaryFormation={commandId,commanderPersonId:personId,factionId,status:p.status==='ACTIVE'?'ACTIVE':'DISBANDED',memberUnitIds:['u-'+i],createdMonth:0,captures:[]};
  people.push(p);formations.push(f);add({id:'appt-'+i,type:'military-appointment',year:0,actorFactionId:factionId,metadata:{personId,commandId,unitCount:1}});
  if(i%3===1){for(let j=0;j<2;j++){const id=`capture-${i}-${j}`,cityId='town-'+i;add({id,type:'city-captured',year:12+j,cityId,actorFactionId:factionId,targetFactionId:'enemy',metadata:{commanderPersonId:personId,commandId,wasCapital:1}});p.capturedEventIds.push(id);f.captures.push({eventId:id,cityId,month:12+j});}}
  if(i%3===2){const battleId='battle-'+i,cityId='fort-'+i;add({id:'start-'+i,type:'siege-started',year:12,cityId,actorFactionId:'enemy',targetFactionId:factionId,metadata:{battleId}});add({id:'end-'+i,type:'siege-ended',year:18,cityId,actorFactionId:'enemy',targetFactionId:factionId,metadata:{battleId,reason:'REPULSED',defenders:2}});add({id:'defense-'+i,type:'siege-defended',year:18,cityId,actorFactionId:factionId,targetFactionId:'enemy',metadata:{battleId,personId,commandId,defenders:2}});}
 }
 return {people,formations,events};
}
it.each([100,500,1000])('preserves the original complete %s-person roster, without repeated evidence evaluation as months pass',n=>{
 const {people,formations,events}=fixture(n),cache=createMeritRosterProjection(),original=meritRoster(people,formations,events,'a',60);expect(cache.get(people,formations,events,'a',60)).toEqual(original);const once=cache.diagnostics();
 expect(cache.get(people,formations,[...events],'a',61)).toEqual(meritRoster(people,formations,events,'a',61));expect(cache.diagnostics().evidenceEvaluations).toBe(once.evidenceEvaluations);expect(cache.diagnostics().indexBuilds).toBe(1);
 expect(original.some(r=>!r.merits.captures&&r.merits.defendedCityIds.length)).toBe(true);expect(original.filter(r=>r.merits.captures).every(r=>r.merits.cityIds.length===1&&r.merits.captures===2)).toBe(true);
},30000);
it('invalidates battle dependencies, including a duplicate start outside the defending command',()=>{
 const x=fixture(),cache=createMeritRosterProjection(),get=()=>cache.get(x.people,x.formations,x.events,'a',60);expect(get()).toEqual(meritRoster(x.people,x.formations,x.events,'a',60));
 x.events.push({...x.events.find(e=>e.id==='start-2')!,id:'duplicate',cityId:'wrong'});expect(get()).toEqual(meritRoster(x.people,x.formations,x.events,'a',60));expect(get().some(r=>r.person.personId==='p-2')).toBe(false);
});
it('future proof availability, new captures, cross-country service and hydration with reused IDs remain correct',()=>{
 const x=fixture(),cache=createMeritRosterProjection(),p=x.people[3],f=x.formations[3];const e:any={id:'future',type:'city-captured',year:72,cityId:'future-town',actorFactionId:'a',targetFactionId:'enemy',metadata:{commandId:f.commandId,commanderPersonId:p.personId,wasCapital:0}};p.capturedEventIds.push(e.id);f.captures.push({eventId:e.id,cityId:e.cityId,month:72});x.events.push(e);
 expect(cache.get(x.people,x.formations,x.events,'a',60)).toEqual(meritRoster(x.people,x.formations,x.events,'a',60));expect(cache.get(x.people,x.formations,x.events,'a',72)).toEqual(meritRoster(x.people,x.formations,x.events,'a',72));
 p.factionId='b';expect(cache.get(x.people,x.formations,x.events,'a',73)).toEqual(meritRoster(x.people,x.formations,x.events,'a',73));expect(cache.get(x.people,x.formations,x.events,'b',73)).toEqual(meritRoster(x.people,x.formations,x.events,'b',73));
 const fresh=structuredClone(x);fresh.events.find(e=>e.id==='end-2')!.metadata!.reason='CONTACT_ENDED';expect(cache.get(fresh.people,fresh.formations,fresh.events,'a',73)).toEqual(meritRoster(fresh.people,fresh.formations,fresh.events,'a',73));expect(cache.get(fresh.people,fresh.formations,fresh.events,'a',73).some(r=>r.person.personId==='p-2')).toBe(false);
});
it('unrelated world events do not invalidate established personal battle facts',()=>{
 const x=fixture(),cache=createMeritRosterProjection();cache.get(x.people,x.formations,x.events,'a',60);const count=cache.diagnostics().evidenceEvaluations;x.events=[...x.events,{id:'elsewhere',type:'city-founded',year:61,actorFactionId:'foreign',cityId:'other'} as WorldEvent];
 expect(cache.get(x.people,x.formations,x.events,'a',61)).toEqual(meritRoster(x.people,x.formations,x.events,'a',61));expect(cache.diagnostics().evidenceEvaluations).toBe(count);
});
