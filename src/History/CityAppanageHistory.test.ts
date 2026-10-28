import {it,expect} from 'vitest';
import {cityAppanageHistory} from './CityAppanageHistory';
import type {MilitaryPerson} from '../Politics/MilitaryCommandRegistry';
import type {WorldEvent} from './WorldHistory';
function fixture(){
 const person:any={personId:'p',personalName:'姬实',sourceUserId:1,bornMonth:5700,status:'DEAD',deathMonth:6152,appointments:[],capturedEventIds:[],nobilityHistory:[],appanageHistory:[]};const events:any[]=[];
 const noble=(rank:string,month:number)=>{const g={eventId:rank,personId:'p',factionId:'yan',epochFounderId:'house',month,rank};person.nobilityHistory.push(g);events.push({id:rank,type:'military-ennobled',year:month,metadata:{nobility:JSON.stringify(g)}});};
 const record=(kind:string,month:number,source:string)=>{const a={eventId:kind,grantEventId:'GRANTED',kind,month,personId:'p',personalName:'姬实',factionId:'yan',countryName:'燕',epochFounderId:'house',cityId:'dantai-1',cityName:'丹台',nobleGrantEventId:'BO',rank:'BO',rulerId:'r',rulerTitle:'燕王姬廷恭',sourceEventId:source,meritEventId:'capture'};person.appanageHistory.push(a);events.push({id:a.eventId,type:'military-appanage',year:month,cityId:a.cityId,actorFactionId:'yan',metadata:{personId:'p',appanage:JSON.stringify(a)}});};
 events.push({id:'capture',type:'city-recovered',year:6023,cityId:'dantai-1',actorFactionId:'yan'});noble('BO',6024);record('GRANTED',6024,'capture');noble('HOU',6108);events.push({id:'death',type:'military-person-died',year:6152,metadata:{personId:'p'}});record('ENDED',6152,'death');
 return {person:person as MilitaryPerson,events:events as WorldEvent[],record};
}
it('projects the supplied Dantai reference timeline without counting promotion as another grant or backfilling marquis rank',()=>{
 const x=fixture(),f=cityAppanageHistory('dantai-1',[x.person],x.events,6200);expect(f.grants).toBe(1);expect(f.people).toBe(1);expect(f.current).toHaveLength(0);expect(f.entries.map(e=>[e.record.month,e.record.kind,e.rank])).toEqual([[6024,'GRANTED','BO'],[6152,'ENDED','HOU']]);expect(cityAppanageHistory('dantai-1',[x.person],x.events,6110).current).toHaveLength(1);
});
it('matches city IDs and both sides of the stored event proof, not names or copied records',()=>{
 const x=fixture();expect(cityAppanageHistory('dantai-2',[x.person],x.events,6200).grants).toBe(0);x.events.find(e=>e.id==='GRANTED')!.metadata!.appanage='{}';expect(cityAppanageHistory('dantai-1',[x.person],x.events,6200).entries).toEqual([]);
});
it('uses the actual source transaction order for same-month loss and recovery',()=>{
 const x=fixture();x.person.appanageHistory!.pop();x.events.pop();x.events.pop();x.events.push({id:'loss',type:'city-captured',year:6110,cityId:'dantai-1',actorFactionId:'other'} as WorldEvent,{id:'back',type:'city-revolt',year:6110,cityId:'dantai-1',actorFactionId:'yan'} as WorldEvent);x.record('LOST',6110,'loss');x.record('RESTORED',6110,'back');x.person.appanageHistory!.reverse();const f=cityAppanageHistory('dantai-1',[x.person],x.events,6110);expect(f.entries.map(e=>e.record.kind)).toEqual(['GRANTED','LOST','RESTORED']);expect(f.current).toHaveLength(1);
});
