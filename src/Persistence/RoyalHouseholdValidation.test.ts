import {expect,it} from 'vitest';
import type {Ruler} from '../Politics/Dynasty';
import type {WorldEvent} from '../History/WorldHistory';
import {registerRoyalPerson} from '../Politics/RoyalPersonRegistration';
import {householdBirthPlan} from '../Politics/RoyalHouseholdBirth';
import {exportRulerSave} from './RulerSaveProjection';
import {validateRoyalHouseholds} from './RoyalHouseholdValidation';
import type {WorldSaveV1} from './WorldSaveSchema';
function fixture(){
 const events:WorldEvent[]=[],write=(e:WorldEvent)=>{events.push(e);return e.id;};
 const king={id:'king',houseName:'嬴氏',givenName:'康',bornYear:-600,naturalDeathYear:1200,status:'ruling',accessionYear:0,reignOrdinal:1} as Ruler;
 const parent={id:'parent',houseName:'嬴氏',givenName:'宁',bornYear:-300,naturalDeathYear:1000,status:'kin'} as Ruler;
 registerRoyalPerson(king,'qin',0,write);registerRoyalPerson(parent,'qin',0,write);
 let child:ReturnType<typeof householdBirthPlan>;for(let month=12;month<=300&&!child;month++)child=householdBirthPlan(parent,month,'fixed','HIGH','king');if(!child)throw Error('fixed birth fixture has no child');
 const b=child.householdBirth;write({id:b.eventId,type:'royal-child-born',category:'politics',importance:'normal',year:b.month,actorFactionId:'qin',rulerId:child.id,title:'出生',metadata:{royalBirth:JSON.stringify(b),parentRulerId:parent.id}});registerRoyalPerson(child,'qin',b.month,write);
 const save={world:{worldMonth:b.month},worldRandom:{seed:'fixed'},registries:{dynastyRoyalBirthPolicy:'HIGH'},worldHistory:{events},dynasties:[{factionId:'qin',houseName:'嬴氏',currentRulerId:king.id,heirIds:[],lastHouseholdBirthMonth:b.month,houseEpochs:[{foundingRulerId:'king',houseName:'嬴氏',startMonth:0}],rulers:[king,parent,child].map(exportRulerSave)}]} as unknown as WorldSaveV1;
 return {save,childId:child.id,parentId:parent.id,month:b.month};
}
it('replays a real current-month birth from a fresh local history index on every validation',()=>{
 const {save,childId}=fixture();expect(validateRoyalHouseholds(save)).toEqual([]);const r:any=(save.dynasties[0].rulers as any[]).find(r=>r.rulerId===childId),ticket=r.householdBirth.ticket;
 r.householdBirth.ticket+=.001;expect(validateRoyalHouseholds(save).length).toBeGreaterThan(0);r.householdBirth.ticket=ticket;expect(validateRoyalHouseholds(save)).toEqual([]);
});
it.each(['parent','name','lifespan','opportunity','scope','erased-proof'])('rejects forged %s without a permissive cached answer',field=>{
 const {save,childId}=fixture(),r:any=(save.dynasties[0].rulers as any[]).find(r=>r.rulerId===childId);
 if(field==='parent')r.parentId='other';if(field==='name')r.givenName='伪名';if(field==='lifespan')r.naturalDeathMonth++;if(field==='opportunity')r.householdBirth.opportunityMonth+=12;if(field==='scope')delete r.successionScope;if(field==='erased-proof'){delete r.successionScope;delete r.householdBirth;}
 expect(validateRoyalHouseholds(save).length).toBeGreaterThan(0);
});
it('honors the actual before/after event boundary for a same-month father death',()=>{
 const {save,parentId,childId,month}=fixture(),r:any=(save.dynasties[0].rulers as any[]).find(r=>r.rulerId===parentId),events=save.worldHistory.events as WorldEvent[];
 r.deathMonth=month;r.status='dead';const death={id:'actual-parent-death',year:month,type:'royal-kin-died',rulerId:parentId,title:'死亡'} as WorldEvent;events.push(death);expect(validateRoyalHouseholds(save)).toEqual([]);
 events.pop();const boundary=events.findIndex(e=>e.rulerId===childId);events.splice(boundary,0,death);expect(validateRoyalHouseholds(save).length).toBeGreaterThan(0);
});

it('does not use a later transfer to rewrite a birth, but excludes a parent already foreign before delivery',()=>{const {save,parentId,childId,month}=fixture(),parent:any=(save.dynasties[0].rulers as any[]).find(r=>r.rulerId===parentId);parent.militaryIdentity={personId:'actual-parent',sourceUserId:1,enteredMonth:0};const events=save.worldHistory.events as WorldEvent[],transfer={id:'actual-transfer',type:'royal-person-transferred',category:'politics',importance:'normal',year:month,rulerId:parentId,title:'转属',metadata:{toFactionId:'wei'}} as WorldEvent;events.push(transfer);expect(validateRoyalHouseholds(save)).toEqual([]);events.pop();events.splice(events.findIndex(e=>e.rulerId===childId),0,transfer);expect(validateRoyalHouseholds(save).length).toBeGreaterThan(0);});
