import {it,expect} from 'vitest';
import {politicalEventCounts} from './PoliticalEventCounts';
it('counts resident-led split foundings and military foundings once, separately from palace acts',()=>{
 const event=(id:string,type:string,metadata:any={},extra:any={}):any=>({id,type,year:120,actorFactionId:id,metadata,...extra});
 const resident=event('resident','empire-split',{leaderPersonId:'p',splitSource:'RESIDENT',foundingRulerId:'r'}),military=event('army','empire-split',{leaderPersonId:'q',splitSource:'MILITARY',foundingRulerId:'s'});
 const coup=event('coup','dynasty-usurped',{militaryUsurperPersonId:'x',militaryUsurperIdentity:JSON.stringify({personId:'x',accessionMonth:120,factionId:'coup'})});
 expect(politicalEventCounts([resident,resident,{...resident,id:'parallel-record'},military,event('depose','ruler-deposed'),coup,event('civil','dynasty-usurped')])).toEqual({ordinaryFoundings:1,militarySecessions:1,depositions:1,militarySupportedDepositions:0,nonMilitaryUsurpations:1,personalMilitaryUsurpations:1});
 expect(politicalEventCounts([event('unknown','empire-split'),event('civil','dynasty-usurped',{militaryParticipant:'mere participation'})]).personalMilitaryUsurpations).toBe(0);
});
