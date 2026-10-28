import {expect,it} from 'vitest';
import {daliangAppanageFixture} from '../../../Simulation/testing/CityAppanageViewFixture';
import {cityAppanageHistory,prepareAppanageHistory} from '../../../History/CityAppanageHistory';
import {appanagePortrait,appanageStatus,appanageSummary,appanageTimelineLabel} from './AppanagePresentation';
import {appanageChanges} from '../../../Politics/MilitaryAppanage';
it('groups Daliang’s six real lifecycle records into two grant relations with original dates and sovereigns',()=>{
 const x=daliangAppanageFixture(),before=JSON.stringify(x),f=cityAppanageHistory(x.cityId,x.people,x.events,x.month);
 expect(f.entries).toHaveLength(6);expect(f.relations).toHaveLength(2);expect(f.grants).toBe(2);expect(f.people).toBe(2);expect(f.current).toHaveLength(0);
 expect(f.relations.map(r=>[r.grant.person.personalName,r.grant.record.month,r.endMonth,appanageStatus(r),appanageSummary(r)])).toEqual([['居惟礼',420,516,'已终结','本人去世终结'],['嬴秉敬',1536,1678,'已终结','曾失地，后恢复 · 本人去世终结']]);
 expect(f.relations[1].timeline.map(e=>[e.record.month,appanageTimelineLabel(e.record)])).toEqual([[1536,'授邑'],[1656,'失地'],[1667,'恢复'],[1678,'终结 · 本人去世']]);expect(JSON.stringify(x)).toBe(before);
});
it('keeps the original portrait office, title and flag despite later promotion, accession or foreign service',()=>{
 const x=daliangAppanageFixture(),p=x.people[1],a=p.appanageHistory![0];p.appointments[0].officeHistory!.push({office:'SHANGJIANGJUN',month:1600,eventId:'later',serviceMonths:88,captureEventIds:[]});p.politicalRulerId='later-king';p.factionId='foreign';
 const portrait=appanagePortrait(p,a,{color:0x00ff00,colorHistory:[{color:0xff0000,startMonth:0,endMonth:1599,reason:'START'},{color:0x00ff00,startMonth:1600,reason:'CHANGE'}]},1680);
 expect(portrait).toMatchObject({personId:p.personId,role:'PIJIANG',nobleRank:'BO',color:0xff0000,age:30,deceased:true});
});
it('shared city/person/state index retains exactly the full source lifecycle, including pending death and recovery',()=>{
 const x=daliangAppanageFixture(),index=prepareAppanageHistory(x.events);
 for(const p of x.people)for(const a of p.appanageHistory!)expect(appanageChanges(p,a,index.related(p,a),x.month)).toEqual(appanageChanges(p,a,x.events,x.month));
 const pending=structuredClone(x);pending.people[1].appanageHistory=pending.people[1].appanageHistory!.slice(0,1);const f=cityAppanageHistory(x.cityId,pending.people,pending.events,1660);expect(f.relations[1].state).toBe('LOST');expect(cityAppanageHistory(x.cityId,pending.people,pending.events,1680).relations[1]).toMatchObject({state:'ENDED',endMonth:1678});
});
it.each(['ACCESSION','TRANSFER','TITLE_REVOKED','DYNASTY_ENDED','STATE_ENDED','CITY_DESTROYED'])('keeps %s source facts when using the shared historical index',reason=>{
 const x=daliangAppanageFixture(),p=x.people[1],grant=p.appanageHistory![0],month=grant.month+1;
 p.appanageHistory=[grant];p.deathMonth=undefined;p.status='ACTIVE';p.royalIdentity={rulerId:'royal'} as any;
 const facts:Record<string,any>={ACCESSION:{type:'ruler-succession',metadata:{nextRulerId:'royal'}},TRANSFER:{type:'military-command-ended',actorFactionId:grant.factionId,metadata:{personId:p.personId,endReason:'TRANSFERRED'}},TITLE_REVOKED:{type:'military-title-revoked',metadata:{personId:p.personId,honor:JSON.stringify({factionId:grant.factionId,epochFounderId:grant.epochFounderId})}},DYNASTY_ENDED:{type:'dynasty-usurped',actorFactionId:grant.factionId},STATE_ENDED:{type:'faction-exiled',targetFactionId:grant.factionId},CITY_DESTROYED:{type:'city-destroyed',cityId:grant.cityId}};
 const events=[...x.events.filter(e=>(e.monthIndex??e.year)<=grant.month),{id:'end-source',year:month,monthIndex:month,...facts[reason]}],index=prepareAppanageHistory(events);
 expect(appanageChanges(p,grant,index.related(p,grant),month)).toEqual(appanageChanges(p,grant,events,month));expect(cityAppanageHistory(x.cityId,[p],events,month,index).relations[0]).toMatchObject({state:'ENDED',endMonth:month,last:{reason}});
});
